"""Capability graph, max-flow cuts, verification, apply, optimum (plan §15, §22-P6).

Nothing is hard-coded (rule 11): tests check properties and agreement with independent computations.
"""

from __future__ import annotations

import itertools
import random
import re
import secrets
from collections import defaultdict, deque

import pytest
import yaml

from api.main import create_app
from api.remediation import capability_graph as cg
from api.remediation.capability_graph import CapabilityService, load_topology
from api.remediation.mincut import CapEdge, extract_cut
from api.runtime.errors import NotFoundError, ProvenanceError
from eval import remediation_optimum as opt
from tests.conftest import FIXTURES, make_client

PLAN = (FIXTURES.parent / "plan.md").read_text(encoding="utf-8")
TOPOLOGIES = ["tinyqueue3", "enterprise12"]


@pytest.fixture
def service(db, settings):
    prefix = f"pw_cap_test_{secrets.token_hex(3)}_"
    svc = CapabilityService(settings, prefix=prefix)
    yield svc
    for name in db.list_graphs():
        if name.startswith(prefix):
            db.select_graph(name).delete()


# -------------------------------------------------- independent max flow
def edmonds_karp(
    edges: list[CapEdge], sources: set[str], targets: set[str]
) -> tuple[int, dict[str, int]]:
    """Reference max flow (multi-source, multi-target) for cross-checking mincut.py."""
    capacity: dict[tuple[str, str], int] = defaultdict(int)
    for e in edges:
        capacity[(e.src, e.dst)] += e.cost
    flow: dict[tuple[str, str], int] = defaultdict(int)
    adjacency: dict[str, set[str]] = defaultdict(set)
    for u, v in list(capacity):
        adjacency[u].add(v)
        adjacency[v].add(u)
    total = 0
    while True:
        parent = {s: None for s in sources}
        queue = deque(sorted(sources))
        end = None
        while queue and end is None:
            u = queue.popleft()
            for v in sorted(adjacency[u]):
                if v not in parent and capacity[(u, v)] - flow[(u, v)] > 0:
                    parent[v] = u
                    if v in targets:
                        end = v
                        break
                    queue.append(v)
        if end is None:
            break
        path, node = [], end
        while parent[node] is not None:
            path.append((parent[node], node))
            node = parent[node]
        push = min(capacity[p] - flow[p] for p in path)
        for u, v in path:
            flow[(u, v)] += push
            flow[(v, u)] -= push
        total += push
    return total, {e.cap_id: max(0, flow[(e.src, e.dst)]) for e in edges}


def reachable(edges: list[CapEdge], starts: set[str], removed: set[str] = frozenset()) -> set[str]:
    adjacency: dict[str, list[str]] = defaultdict(list)
    for e in edges:
        if e.cap_id not in removed:
            adjacency[e.src].append(e.dst)
    seen, queue = set(starts), deque(starts)
    while queue:
        for nxt in adjacency[queue.popleft()]:
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return seen


# -------------------------------------------------- mincut (pure)
def test_a_simple_cut_is_the_saturated_bottleneck():
    edges = [CapEdge("s", "a", "s->a", 10), CapEdge("a", "t", "a->t", 5)]
    cut = extract_cut(edges, {"s->a": 5, "a->t": 5}, {"s"})
    assert [(e.cap_id, e.cost) for e in cut] == [("a->t", 5)]


def test_the_residual_bfs_walks_backwards_over_flow_carrying_edges():
    """s->u (5), s->v (1), v->u (1), u->t (2). With flow s->v=1, v->u=1, s->u=1, u->t=2 vertex v is
    reachable from s ONLY by cancelling flow on v->u. Without the backward step the 'cut' would be
    {u->t, s->v} costing 3 although the max flow is 2."""
    edges = [
        CapEdge("s", "u", "s->u", 5),
        CapEdge("s", "v", "s->v", 1),
        CapEdge("v", "u", "v->u", 1),
        CapEdge("u", "t", "u->t", 2),
    ]
    flows = {"s->u": 1.0, "s->v": 1.0, "v->u": 1.0, "u->t": 2.0}

    cut = extract_cut(edges, flows, {"s"})

    assert [(e.cap_id, e.cost) for e in cut] == [("u->t", 2)]
    # and a different max flow (all through s->u) gives the same cut: the minimal cut is unique
    other = extract_cut(edges, {"s->u": 2.0, "u->t": 2.0}, {"s"})
    assert [e.cap_id for e in other] == ["u->t"]


def test_without_flow_or_without_sources_there_is_nothing_to_cut():
    assert extract_cut([], {}, {"s"}) == []
    assert extract_cut([CapEdge("x", "y", "x->y", 3)], {}, set()) == []


@pytest.mark.parametrize("seed", range(200))
def test_extracted_cuts_equal_the_max_flow_and_separate_sources_from_targets(seed):
    """Property test against an independent Edmonds-Karp on random graphs."""
    rng = random.Random(seed)
    nodes = [f"n{i}" for i in range(rng.randint(5, 9))]
    pairs = [(u, v) for u in nodes for v in nodes if u != v and rng.random() < 0.3]
    edges = [CapEdge(u, v, f"{u}->{v}", rng.randint(1, 10)) for u, v in pairs]
    sources, targets = {nodes[0], nodes[1]}, {nodes[-1], nodes[-2]}
    value, flows = edmonds_karp(edges, sources, targets)

    cut = extract_cut(edges, {k: float(v) for k, v in flows.items()}, sources)

    assert sum(e.cost for e in cut) == value
    assert not (reachable(edges, sources, {e.cap_id for e in cut}) & targets)


# -------------------------------------------------- topologies and graph
FIXTURE_MARKERS = {
    "enterprise12": "### 8.6 `fixtures/topologies/enterprise12.yaml`",
    "tinyqueue3": "### 8.7 `fixtures/topologies/tinyqueue3.yaml`",
}


@pytest.mark.parametrize("name", TOPOLOGIES)
def test_topology_fixtures_are_verbatim_copies_of_the_plan(name):
    start = PLAN.index(FIXTURE_MARKERS[name])
    block = re.compile(r"```[a-z]*\n(.*?)```", re.S).search(PLAN, start).group(1)
    on_disk = (FIXTURES / "topologies" / f"{name}.yaml").read_text(encoding="utf-8")
    assert on_disk.rstrip("\n") == block.rstrip("\n")


def test_both_topologies_load_with_the_documented_shape():
    big, small = load_topology("enterprise12"), load_topology("tinyqueue3")
    assert (len(big.edges), len(big.agents), len(big.untrusted), len(big.secret)) == (30, 12, 3, 2)
    assert big.external_sinks == ["email_out", "public_github", "slack_public"]
    assert (len(small.edges), small.agents, small.external_sinks) == (
        9,
        ["fixer", "release", "triage"],
        ["public_release_page"],
    )
    assert all(
        1 <= e.cost <= 10 and e.cap_id == f"{e.src}->{e.dst}" for e in big.edges + small.edges
    )
    with pytest.raises(NotFoundError):
        load_topology("nope")
    with pytest.raises(NotFoundError):
        load_topology("../registry")


def test_the_loader_rejects_broken_topologies(tmp_path, monkeypatch):
    good = yaml.safe_load((FIXTURES / "topologies" / "tinyqueue3.yaml").read_text(encoding="utf-8"))
    monkeypatch.setattr(cg, "TOPOLOGY_DIR", tmp_path)
    for label, mutate in {
        "unknown node": lambda d: d["edges"].append(["ghost", "triage", 3]),
        "cost out of range": lambda d: d["edges"].__setitem__(0, ["public_issues", "triage", 11]),
        "duplicate edge": lambda d: d["edges"].append(list(d["edges"][0])),
    }.items():
        data = yaml.safe_load(yaml.safe_dump(good))
        mutate(data)
        (tmp_path / "broken.yaml").write_text(yaml.safe_dump(data), encoding="utf-8")
        with pytest.raises(ValueError):
            load_topology("broken")
        assert label


@pytest.mark.parametrize("name", TOPOLOGIES)
def test_reset_builds_the_capability_graph_from_the_yaml(service, db, name):
    topo = load_topology(name)
    service.reset(name)
    graph = db.select_graph(service.graph_name(name))

    nodes = graph.query("MATCH (n:CapNode) RETURN n.name, n.kind, n.trust, n.external").result_set
    assert len(nodes) == len(topo.nodes)
    by_name = {r[0]: r for r in nodes}
    for n in topo.nodes:
        assert by_name[n.name][1] == n.kind
        if n.kind == "source":
            assert by_name[n.name][2] == n.trust
        if n.kind == "sink":
            assert by_name[n.name][3] == n.external
    edges = graph.query(
        "MATCH (a)-[r:CAN_FLOW]->(b) RETURN a.name, b.name, r.cap_id, r.cost, r.description"
    ).result_set
    assert {(a, b, c, int(cost)) for a, b, c, cost, _ in edges} == {
        (e.src, e.dst, e.cap_id, e.cost) for e in topo.edges
    }
    assert all(desc for *_, desc in edges)
    assert graph.query("MATCH ()-[r:REVOKED_FLOW]->() RETURN count(r)").result_set == [[0]]


# -------------------------------------------------- toxicity and candidates
@pytest.mark.parametrize("name", TOPOLOGIES)
def test_toxic_agents_agree_with_an_independent_bfs(service, name):
    service.reset(name)
    assert service.toxic_agents(name) == sorted(opt.toxic_agents(load_topology(name)))
    assert service.toxic_agents(name)  # both demo topologies start out toxic


@pytest.mark.parametrize("name", TOPOLOGIES)
def test_every_candidate_cut_costs_exactly_the_max_flow_and_is_verified(service, name):
    service.reset(name)
    topo = load_topology(name)

    candidates = service.suggest(name)

    assert [c["id"] for c in sorted(candidates, key=lambda c: c["id"])] == ["C1", "C2", "C3", "C4"]
    assert [c["total_cost"] for c in candidates] == sorted(
        c["total_cost"] for c in candidates
    )  # cheapest first
    by_cap = {e.cap_id: e.cost for e in topo.edges}
    for c in candidates:
        assert c["invalid_reason"] is None and c["verified"] is True, c
        assert (
            c["total_cost"] == sum(by_cap[i] for i in c["cap_ids"]) == pytest.approx(c["max_flow"])
        )
        # independent verification: removing the cut leaves no toxic agent
        assert not opt.toxic_agents(topo, frozenset(c["cap_ids"])), c["id"]


@pytest.mark.parametrize("name", TOPOLOGIES)
def test_each_candidate_cuts_what_its_definition_says(service, name):
    service.reset(name)
    topo = load_topology(name)
    edges = topo.edges
    forward = {c["id"]: set(c["cap_ids"]) for c in service.suggest(name)}
    u, s, k = set(topo.untrusted), set(topo.secret), set(topo.external_sinks)
    reach_s, reach_u = reachable(edges, s), reachable(edges, u)
    to_k = set(topo.agents) & {e.src for e in edges}  # candidates for "reaches K" below
    reverse = [CapEdge(e.dst, e.src, e.cap_id, e.cost) for e in edges]
    agents_to_k = reachable(reverse, k) & set(topo.agents)
    t_s, t_u = (reach_s & agents_to_k), (reach_u & agents_to_k)
    assert to_k  # sanity
    assert not (reachable(edges, u, forward["C1"]) & k)  # C1: no untrusted -> external path
    assert not (reachable(edges, s, forward["C2"]) & k)  # C2: no secret -> external path
    assert not (reachable(edges, u, forward["C3"]) & t_s)  # C3: T_S unreachable from untrusted
    assert not (reachable(edges, s, forward["C4"]) & t_u)  # C4: T_U unreachable from secret


@pytest.mark.parametrize("name", TOPOLOGIES)
def test_candidate_costs_equal_an_independent_max_flow_of_their_definition(service, name):
    """A wrong source/target set can still give a COMPLETE fix, only a different cost, so the
    definition itself is pinned: each cost must equal Edmonds-Karp on (sources, targets)."""
    service.reset(name)
    topo = load_topology(name)
    edges = topo.edges
    reverse = [CapEdge(e.dst, e.src, e.cap_id, e.cost) for e in edges]
    agents_to_k = reachable(reverse, set(topo.external_sinks)) & set(topo.agents)
    t_s = reachable(edges, set(topo.secret)) & agents_to_k
    t_u = reachable(edges, set(topo.untrusted)) & agents_to_k
    definition = {
        "C1": (set(topo.untrusted), set(topo.external_sinks)),
        "C2": (set(topo.secret), set(topo.external_sinks)),
        "C3": (set(topo.untrusted), t_s),
        "C4": (set(topo.secret), t_u),
    }

    for candidate in service.suggest(name):
        sources, targets = definition[candidate["id"]]
        value, _ = edmonds_karp(edges, sources, targets) if sources and targets else (0, {})
        assert candidate["total_cost"] == value, candidate["id"]


@pytest.mark.parametrize("name", TOPOLOGIES)
def test_suggest_leaves_the_real_graph_and_no_temporary_graph_behind(service, db, name):
    service.reset(name)
    before = service.state(name)

    service.suggest(name)

    assert service.state(name) == before  # nothing was revoked on the real graph
    assert not [g for g in db.list_graphs() if g.endswith("__verify")]


# -------------------------------------------------- apply, reset, witness
@pytest.mark.parametrize("name", TOPOLOGIES)
def test_applying_the_cheapest_candidate_empties_the_toxic_list_and_reset_restores_it(
    service, name
):
    service.reset(name)
    before = service.toxic_agents(name)
    best = service.suggest(name)[0]

    result = service.apply(name, best["cap_ids"])

    assert result["toxic_before"] == before and result["toxic_after"] == []
    assert result["revoked"] == len(best["cap_ids"])
    state = service.state(name)
    assert state["toxic_agents"] == [] and {
        e["cap_id"] for e in state["edges"] if e["revoked"]
    } == set(best["cap_ids"])

    service.reset(name)
    assert service.toxic_agents(name) == before
    assert not any(e["revoked"] for e in service.state(name)["edges"])


def test_apply_refuses_empty_unknown_and_already_revoked_flows(service):
    service.reset("tinyqueue3")
    with pytest.raises(ProvenanceError):
        service.apply("tinyqueue3", [])
    with pytest.raises(NotFoundError):
        service.apply("tinyqueue3", ["no->such"])
    service.apply("tinyqueue3", ["triage->team_memory"])
    with pytest.raises(NotFoundError):  # already revoked
        service.apply("tinyqueue3", ["triage->team_memory"])


def test_after_a_fix_the_untrusted_candidates_need_no_further_cut(service):
    service.reset("tinyqueue3")
    service.apply("tinyqueue3", ["triage->team_memory"])

    by_id = {c["id"]: c for c in service.suggest("tinyqueue3")}

    assert (
        by_id["C1"]["total_cost"] == 0
        and by_id["C1"]["verified"]
        and by_id["C3"]["total_cost"] == 0
    )


def test_witness_paths_for_a_toxic_and_a_clean_agent(service):
    service.reset("enterprise12")
    toxic = service.witness("enterprise12", "billing_agent")
    assert toxic["toxic"] and toxic["from_untrusted"][-1] == "billing_agent"
    assert toxic["from_secret"][0] in load_topology("enterprise12").secret
    assert toxic["to_external"][-1] in load_topology("enterprise12").external_sinks
    clean = service.witness("enterprise12", "db_reader")
    assert clean == {
        "agent": "db_reader",
        "toxic": False,
        "from_untrusted": [],
        "from_secret": [],
        "to_external": [],
    }


# -------------------------------------------------- brute-force optimum
def exhaustive(topology, max_size=6):
    """Reference optimum: try EVERY subset (small topologies only)."""
    best = None
    edges = topology.edges
    for size in range(0, max_size + 1):
        for combo in itertools.combinations(edges, size):
            if not opt.toxic_agents(topology, frozenset(e.cap_id for e in combo)):
                cost = sum(e.cost for e in combo)
                best = cost if best is None else min(best, cost)
    return best


def test_the_pruned_optimum_matches_an_exhaustive_search_on_the_small_topology():
    topo = load_topology("tinyqueue3")
    assert opt.optimum(topo)["cost"] == exhaustive(topo)


def test_the_optimum_report_has_a_non_negative_gap_and_a_toxic_free_solution(service):
    for name in TOPOLOGIES:
        service.reset(name)
        topo = load_topology(name)
        best = min(c["total_cost"] for c in service.suggest(name) if c["verified"])

        report = opt.report(topo, best)

        assert report["optimum_cost"] is not None and report["optimum_cost"] <= best
        assert report["gap"] == best - report["optimum_cost"] >= 0
        assert not opt.toxic_agents(topo, frozenset(report["optimum_cap_ids"]))
        assert (
            sum({e.cap_id: e.cost for e in topo.edges}[i] for i in report["optimum_cap_ids"])
            == report["optimum_cost"]
        )


# -------------------------------------------------- API
@pytest.fixture
def client(service, manager, settings, tmp_path):
    app = create_app(settings.model_copy(update={"state_dir": tmp_path}), manager, service)
    return make_client(app, settings)


def test_the_remediation_api_follows_plan_18(client):
    base = "/api/remediation/enterprise12"
    state = client.get(base).json()
    assert (
        state["toxic_agents"]
        and len(state["edges"]) == 30
        and not any(e["revoked"] for e in state["edges"])
    )
    assert {n["kind"] for n in state["nodes"]} == {"source", "agent", "store", "sink"}

    suggested = client.post(f"{base}/suggest").json()
    assert [c["id"] for c in suggested["candidates"]][0] in {"C1", "C2", "C3", "C4"}
    cheapest = suggested["candidates"][0]
    assert cheapest["verified"] is True

    applied = client.post(f"{base}/apply", json={"cap_ids": cheapest["cap_ids"]}).json()
    assert applied["toxic_after"] == [] and applied["toxic_before"] == state["toxic_agents"]
    after = client.get(base).json()
    assert after["toxic_agents"] == [] and any(e["revoked"] for e in after["edges"])

    restored = client.post(f"{base}/reset").json()
    assert restored["toxic_agents"] == state["toxic_agents"]
    witness = client.get(f"{base}/witness/billing_agent").json()
    assert witness["toxic"] is True


def test_the_remediation_api_reports_errors_in_the_documented_shape(client):
    assert client.get("/api/remediation/nope").json()["error"] == "not_found"
    assert (
        client.post("/api/remediation/tinyqueue3/apply", json={"cap_ids": ["no->such"]}).status_code
        == 404
    )
    assert client.post("/api/remediation/tinyqueue3/apply", json={"cap_ids": []}).status_code == 400
    assert (
        client.post("/api/remediation/tinyqueue3/apply", json={}).json()["error"]
        == "validation_error"
    )
