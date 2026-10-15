"""Capability graphs and max-flow remediation (plan §7.6, §15).

An agent is *toxic* iff it is reachable from an untrusted source, reachable from a secret source,
and can reach an external sink (``r4``). Four candidate cuts are each a complete fix by
construction:

====  =========================  ==================================================================
C1    U -> K                     every toxic flow contains an untrusted -> external path
C2    S -> K                     every toxic flow contains a secret -> external path
C3    U -> T_S                   T_S = agents reachable from S that reach K; after the cut no agent
                                 of T_S is reachable from U (deleting edges never enlarges T_S)
C4    S -> T_U                   symmetric to C3
====  =========================  ==================================================================

Each candidate is verified on a temporary copy of the graph (apply, then ``r4`` must be empty).
Nothing here hard-codes expected results (plan rule 11): everything is computed.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass, field
from pathlib import Path

import yaml
from falkordb import FalkorDB

from api.graph.client import NamedGraph, connect
from api.remediation.mincut import CapEdge, extract_cut
from api.runtime.errors import NotFoundError, ProvenanceError
from api.settings import Settings

TOPOLOGY_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "topologies"
FLOW_TOLERANCE = 1e-6


@dataclass(frozen=True)
class CapNode:
    name: str
    kind: str  # source | agent | store | sink
    trust: str = ""  # sources: untrusted | internal | secret
    external: bool = False  # sinks


@dataclass
class Topology:
    name: str
    nodes: list[CapNode]
    edges: list[CapEdge]
    _by_name: dict[str, CapNode] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        self._by_name = {n.name: n for n in self.nodes}

    @property
    def untrusted(self) -> list[str]:
        return sorted(n.name for n in self.nodes if n.kind == "source" and n.trust == "untrusted")

    @property
    def secret(self) -> list[str]:
        return sorted(n.name for n in self.nodes if n.kind == "source" and n.trust == "secret")

    @property
    def external_sinks(self) -> list[str]:
        return sorted(n.name for n in self.nodes if n.kind == "sink" and n.external)

    @property
    def agents(self) -> list[str]:
        return sorted(n.name for n in self.nodes if n.kind == "agent")


def available_topologies() -> list[str]:
    return sorted(p.stem for p in TOPOLOGY_DIR.glob("*.yaml"))


def load_topology(name: str) -> Topology:
    path = TOPOLOGY_DIR / f"{name}.yaml"
    if not path.is_file() or name not in available_topologies():
        raise NotFoundError(f"topology {name!r}")
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    spec = data["nodes"]
    nodes = (
        [CapNode(s["name"], "source", trust=s["trust"]) for s in spec["sources"]]
        + [CapNode(a, "agent") for a in spec["agents"]]
        + [CapNode(s, "store") for s in spec["stores"]]
        + [CapNode(k["name"], "sink", external=bool(k["external"])) for k in spec["sinks"]]
    )
    names = [n.name for n in nodes]
    if len(names) != len(set(names)):
        raise ValueError(f"{name}: duplicate node names")
    edges: list[CapEdge] = []
    for src, dst, cost in data["edges"]:
        if src not in names or dst not in names:
            raise ValueError(f"{name}: edge {src}->{dst} references an unknown node")
        if not isinstance(cost, int) or not 1 <= cost <= 10:
            raise ValueError(f"{name}: cost of {src}->{dst} must be an integer 1-10")
        edges.append(CapEdge(src, dst, f"{src}->{dst}", cost))
    if len({e.cap_id for e in edges}) != len(edges):
        raise ValueError(f"{name}: duplicate edges")
    return Topology(data["name"], nodes, edges)


def _describe(edge: CapEdge) -> str:
    return f"{edge.src} may send data to {edge.dst}"


def _flat(rows: list[list]) -> list[str]:
    return sorted(row[0] for row in rows)


class CapabilityService:
    """Owns the ``pw_cap_<topology>`` graphs (global demo data, not tenant-scoped: see A-07)."""

    def __init__(
        self, settings: Settings, *, prefix: str = "pw_cap_", timeout_ms: int | None = 5000
    ):
        self._settings = settings
        self._prefix = prefix
        self._timeout_ms = timeout_ms
        self._db: FalkorDB | None = None
        self._lock = threading.RLock()

    # ------------------------------------------------------------------ plumbing
    @property
    def db(self) -> FalkorDB:
        if self._db is None:
            self._db = connect(self._settings)
        return self._db

    def graph_name(self, topology: str) -> str:
        return f"{self._prefix}{topology}"

    def _graph(self, topology: str) -> NamedGraph:
        load_topology(topology)  # NotFoundError for unknown topologies
        name = self.graph_name(topology)
        if name not in self.db.list_graphs():
            self.reset(topology)
        return NamedGraph(self.db, name, self._timeout_ms)

    def reset(self, topology: str) -> NamedGraph:
        """Reload the capability graph from its YAML (undoes every applied revocation)."""
        topo = load_topology(topology)
        with self._lock:
            name = self.graph_name(topology)
            if name in self.db.list_graphs():
                self.db.select_graph(name).delete()
            graph = NamedGraph(self.db, name, self._timeout_ms)
            graph.run(
                "r0_seed_nodes",
                rows=[
                    {
                        "name": n.name,
                        "kind": n.kind,
                        "trust": n.trust or None,
                        "external": n.external if n.kind == "sink" else None,
                    }
                    for n in topo.nodes
                ],
            )
            graph.run(
                "r0_seed_edges",
                rows=[
                    {
                        "src": e.src,
                        "dst": e.dst,
                        "cap_id": e.cap_id,
                        "cost": e.cost,
                        "description": _describe(e),
                    }
                    for e in topo.edges
                ],
            )
            return graph

    def delete(self, topology: str) -> None:
        name = self.graph_name(topology)
        if name in self.db.list_graphs():
            self.db.select_graph(name).delete()

    # ------------------------------------------------------------------ reads
    @staticmethod
    def _edges(graph: NamedGraph) -> list[CapEdge]:
        return [
            CapEdge(src, dst, cap_id, int(cost))
            for src, dst, cap_id, cost in graph.run("r1_all_edges")
        ]

    def toxic_agents(self, topology: str) -> list[str]:
        return _flat(self._graph(topology).run("r4_toxic_agents"))

    def state(self, topology: str) -> dict:
        topo = load_topology(topology)
        graph = self._graph(topology)
        live = {e.cap_id for e in self._edges(graph)}
        toxic = _flat(graph.run("r4_toxic_agents"))
        return {
            "topology": topology,
            "nodes": [
                {
                    "name": n.name,
                    "kind": n.kind,
                    "trust": n.trust or None,
                    "external": n.external if n.kind == "sink" else None,
                    "toxic": n.name in toxic,
                }
                for n in topo.nodes
            ],
            "edges": [
                {
                    "src": e.src,
                    "dst": e.dst,
                    "cap_id": e.cap_id,
                    "cost": e.cost,
                    "revoked": e.cap_id not in live,
                }
                for e in topo.edges
            ],
            "toxic_agents": toxic,
        }

    def witness(self, topology: str, agent: str) -> dict:
        rows = self._graph(topology).run("r7_toxic_witness", agent=agent)
        if not rows:
            return {
                "agent": agent,
                "toxic": False,
                "from_untrusted": [],
                "from_secret": [],
                "to_external": [],
            }
        untrusted, secret, external = rows[0]
        return {
            "agent": agent,
            "toxic": True,
            "from_untrusted": untrusted,
            "from_secret": secret,
            "to_external": external,
        }

    # ------------------------------------------------------------------ candidate cuts
    def _flows(
        self, graph: NamedGraph, sources: list[str], targets: list[str]
    ) -> tuple[float, dict[str, float]]:
        rows = graph.run("r2_maxflow", source_names=sources, target_names=targets)
        max_flow, cap_ids, flows = rows[0]
        return float(max_flow), dict(zip(cap_ids, flows, strict=True))

    def _candidate(
        self,
        graph: NamedGraph,
        edges: list[CapEdge],
        cid: str,
        name: str,
        sources: list[str],
        targets: list[str],
    ) -> dict:
        if not sources or not targets:  # nothing to separate: no cut is needed
            return {
                "id": cid,
                "name": name,
                "cap_ids": [],
                "edges": [],
                "total_cost": 0,
                "max_flow": 0.0,
                "invalid_reason": None,
                "needs_cut": False,
            }
        max_flow, flows = self._flows(graph, sources, targets)
        cut = extract_cut(edges, flows, set(sources))
        total = sum(e.cost for e in cut)
        invalid = (
            None
            if abs(total - max_flow) <= FLOW_TOLERANCE
            else (f"cut cost {total} differs from maxFlow {max_flow}")
        )
        return {
            "id": cid,
            "name": name,
            "cap_ids": [e.cap_id for e in cut],
            "edges": [
                {"cap_id": e.cap_id, "src": e.src, "dst": e.dst, "cost": e.cost} for e in cut
            ],
            "total_cost": total,
            "max_flow": max_flow,
            "invalid_reason": invalid,
            "needs_cut": True,
        }

    def _verify(self, topology: str, cap_ids: list[str]) -> bool:
        """Apply the cut to a TEMPORARY copy of the graph; ``r4`` must then be empty."""
        source = self.graph_name(topology)
        temp = f"{source}__verify"
        if temp in self.db.list_graphs():
            self.db.select_graph(temp).delete()
        self.db.select_graph(source).copy(temp)
        try:
            graph = NamedGraph(self.db, temp, self._timeout_ms)
            if cap_ids:
                graph.run("r3_apply_revocation", cap_ids=cap_ids)
            return not graph.run("r4_toxic_agents")
        finally:
            self.db.select_graph(temp).delete()

    def suggest(self, topology: str) -> list[dict]:
        """The four candidates C1-C4, verified, cheapest first."""
        topo = load_topology(topology)
        with self._lock:
            graph = self._graph(topology)
            edges = self._edges(graph)
            reach_u = set(_flat(graph.run("r5_reachable_agents", source_names=topo.untrusted)))
            reach_s = set(_flat(graph.run("r5_reachable_agents", source_names=topo.secret)))
            to_external = set(_flat(graph.run("r6_agents_reaching_external")))
            t_s, t_u = sorted(reach_s & to_external), sorted(reach_u & to_external)
            specs = [
                ("C1", "Cut untrusted -> external", topo.untrusted, topo.external_sinks),
                ("C2", "Cut secret -> external", topo.secret, topo.external_sinks),
                (
                    "C3",
                    "Cut untrusted -> agents that touch secrets and reach outside",
                    topo.untrusted,
                    t_s,
                ),
                (
                    "C4",
                    "Cut secret -> agents that ingest untrusted data and reach outside",
                    topo.secret,
                    t_u,
                ),
            ]
            candidates = []
            for cid, name, sources, targets in specs:
                cand = self._candidate(graph, edges, cid, name, sources, targets)
                cand["verified"] = cand["invalid_reason"] is None and self._verify(
                    topology, cand["cap_ids"]
                )
                if cand["invalid_reason"] is None and not cand["verified"]:
                    cand["invalid_reason"] = "toxic agents remain after applying the cut"
                cand["description"] = (
                    f"{name}: revoke {len(cand['cap_ids'])} flow(s), cost {cand['total_cost']}"
                    if cand["needs_cut"]
                    else f"{name}: no cut needed"
                )
                candidates.append(cand)
            return sorted(candidates, key=lambda c: (c["total_cost"], c["id"]))

    # ------------------------------------------------------------------ human action
    def apply(self, topology: str, cap_ids: list[str]) -> dict:
        """Revoke flows on the REAL graph (human only); returns the toxic agents before/after."""
        ids = sorted(set(cap_ids))
        if not ids:
            raise ProvenanceError("no flows to revoke")
        with self._lock:
            graph = self._graph(topology)
            live = {e.cap_id for e in self._edges(graph)}
            unknown = [i for i in ids if i not in live]
            if unknown:
                raise NotFoundError(f"unknown or already revoked flows: {unknown}")
            before = _flat(graph.run("r4_toxic_agents"))
            revoked = graph.run("r3_apply_revocation", cap_ids=ids)[0][0]
            if revoked != len(ids):
                raise ProvenanceError(f"revoked {revoked} of {len(ids)} flows")
            after = _flat(graph.run("r4_toxic_agents"))
            return {
                "topology": topology,
                "cap_ids": ids,
                "revoked": revoked,
                "toxic_before": before,
                "toxic_after": after,
            }
