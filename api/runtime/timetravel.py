"""Time travel (plan §14): the lineage graph as it was at logical time ``t``, plus two markers.

Only existing queries are used (``q7``, ``q7b``, ``q6b``, ``q8``, ``q0_max_ts``); the taint markers
are computed in Python over the returned subgraph (A-09). Nothing here reads artifact content.

Caveats shown to the user: ``status`` and ``quarantined`` flags are the CURRENT values (they are
mutable properties, not versioned), and artifacts without any lineage edge yet are not listed.
"""

from __future__ import annotations

from collections import defaultdict, deque

from api.graph.client import NamedGraph

NODE_COLUMNS = (
    "id", "label", "kind", "trust", "sanitized", "approved", "quarantined",
    "agent_id", "session_id", "key", "created_at",
)  # fmt: skip
BIG = 10**9


def max_clock(graph: NamedGraph) -> int:
    """The latest logical time in the graph (0 for an empty one)."""
    rows = graph.run("q0_max_ts")
    value = rows[0][0] if rows else None
    return int(value) if value is not None else 0


def _details(graph: NamedGraph, ids: list[str]) -> list[dict]:
    rows = graph.run("q6b_node_details", ids=sorted(set(ids)))
    return sorted((dict(zip(NODE_COLUMNS, r, strict=True)) for r in rows), key=lambda n: n["id"])


def _edges_at(graph: NamedGraph, t: int) -> list[dict]:
    rows = graph.run("q7_graph_at_time", t=t)
    return sorted(
        ({"src": s, "dst": d, "rel": r} for s, d, r in rows),
        key=lambda e: (e["src"], e["dst"], e["rel"]),
    )


def doubly_tainted_artifacts(graph: NamedGraph) -> list[dict]:
    """Drafts whose lineage reaches BOTH an untrusted source (without crossing a sanitized or an
    approved artifact) and a secret source (without crossing an approved one): the gate's q2a/q2b
    semantics, evaluated for every draft. Sorted by creation time."""
    edges = _edges_at(graph, BIG)
    ids = {e["src"] for e in edges} | {e["dst"] for e in edges}
    nodes = {n["id"]: n for n in _details(graph, list(ids))}
    adjacency: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        adjacency[e["src"]].append(e["dst"])

    def reaches(start: str, trust: str, blocked_by: tuple[str, ...]) -> bool:
        def blocked(node_id: str) -> bool:
            return any(nodes[node_id].get(flag) for flag in blocked_by)

        if blocked(start):
            return False
        seen, queue = {start}, deque([start])
        while queue:
            for nxt in adjacency[queue.popleft()]:
                if nxt in seen or blocked(nxt):
                    continue
                if nodes[nxt]["label"] == "Source" and nodes[nxt]["trust"] == trust:
                    return True
                seen.add(nxt)
                queue.append(nxt)
        return False

    result = [
        n
        for n in nodes.values()
        if n["kind"] == "draft"
        and reaches(n["id"], "untrusted", ("sanitized", "approved"))
        and reaches(n["id"], "secret", ("approved",))
    ]
    return sorted(result, key=lambda n: (n["created_at"], n["id"]))


def markers(graph: NamedGraph) -> dict:
    """``poisoned_memory_written``: the first team-memory artifact that descends from an untrusted
    source; ``draft_doubly_tainted``: the first draft that descends from both kinds of source."""
    inventory = graph.run(
        "q8_memory_inventory"
    )  # (memory_id, key, kind, by, day, quarantined, origins)
    poisoned_ids = [row[0] for row in inventory if row[6]]
    poisoned = _details(graph, poisoned_ids) if poisoned_ids else []
    first_memory = min(poisoned, key=lambda n: (n["created_at"], n["id"]), default=None)
    tainted = doubly_tainted_artifacts(graph)
    first_draft = tainted[0] if tainted else None
    return {
        "poisoned_memory_written": (
            {
                "t": first_memory["created_at"],
                "artifact_id": first_memory["id"],
                "key": first_memory["key"],
            }
            if first_memory
            else None
        ),
        "draft_doubly_tainted": (
            {
                "t": first_draft["created_at"],
                "artifact_id": first_draft["id"],
                "key": first_draft["key"],
            }
            if first_draft
            else None
        ),
    }


def graph_at(graph: NamedGraph, t: int) -> dict:
    """The lineage graph (nodes with metadata, edges, actions) at logical time ``t``."""
    edges = _edges_at(graph, t)
    actions = [
        {"action_id": a, "status": s, "payload_id": p}
        for a, s, p in graph.run("q7b_actions_at_time", t=t)
    ]
    actions.sort(key=lambda a: a["action_id"])
    ids = {e["src"] for e in edges} | {e["dst"] for e in edges} | {a["payload_id"] for a in actions}
    tainted = [n["id"] for n in doubly_tainted_artifacts(graph) if n["created_at"] <= t]
    return {
        "t": t,
        "max_t": max_clock(graph),
        "nodes": _details(graph, list(ids)) if ids else [],
        "edges": edges,
        "actions": actions,
        "doubly_tainted": tainted,
        "markers": markers(graph),
    }
