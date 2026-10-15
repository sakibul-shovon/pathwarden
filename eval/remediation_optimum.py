"""Exact optimum for remediation (plan §15.5): evaluation ground truth ONLY.

Plain Python on an in-memory edge list: find the cheapest set of at most ``max_size`` edges whose
removal leaves no toxic agent (depth-first search over edge subsets, cheapest edges first, with cost
pruning).
Toxicity is computed by BFS, independently of FalkorDB and of the max-flow code.
"""

from __future__ import annotations

from collections import defaultdict, deque

from api.remediation.capability_graph import Topology

MAX_SIZE = 6


def _reach(adjacency: dict[str, list[str]], starts: list[str]) -> set[str]:
    seen, queue = set(starts), deque(starts)
    while queue:
        for nxt in adjacency[queue.popleft()]:
            if nxt not in seen:
                seen.add(nxt)
                queue.append(nxt)
    return seen


def toxic_agents(topology: Topology, removed: frozenset[str] = frozenset()) -> set[str]:
    """Agents reachable from untrusted AND secret sources that can reach an external sink."""
    forward: dict[str, list[str]] = defaultdict(list)
    backward: dict[str, list[str]] = defaultdict(list)
    for edge in topology.edges:
        if edge.cap_id not in removed:
            forward[edge.src].append(edge.dst)
            backward[edge.dst].append(edge.src)
    agents = set(topology.agents)
    return (
        agents
        & _reach(forward, topology.untrusted)
        & _reach(forward, topology.secret)
        & _reach(backward, topology.external_sinks)
    )


def optimum(
    topology: Topology, *, upper_bound: int | None = None, max_size: int = MAX_SIZE
) -> dict:
    """Cheapest toxic-free edge set of size <= ``max_size`` (``cost`` is None when none exists)."""
    edges = sorted(topology.edges, key=lambda e: (e.cost, e.cap_id))
    best_cost = (upper_bound + 1) if upper_bound is not None else sum(e.cost for e in edges) + 1
    best: list[str] | None = None
    visited = 0

    def search(start: int, chosen: list[str], cost: int) -> None:
        nonlocal best, best_cost, visited
        visited += 1
        if not toxic_agents(topology, frozenset(chosen)):
            if cost < best_cost:
                best, best_cost = list(chosen), cost
            return  # adding more edges can only cost more
        if len(chosen) == max_size:
            return
        for i in range(start, len(edges)):
            new_cost = cost + edges[i].cost
            if new_cost >= best_cost:
                break  # edges are sorted by cost: every later edge is at least as expensive
            chosen.append(edges[i].cap_id)
            search(i + 1, chosen, new_cost)
            chosen.pop()

    if toxic_agents(topology):
        search(0, [], 0)
    else:
        best, best_cost = [], 0
    return {
        "cost": best_cost if best is not None else None,
        "cap_ids": sorted(best or []),
        "subsets_examined": visited,
    }


def report(topology: Topology, best_candidate_cost: int | None) -> dict:
    """optimum_cost, best_candidate_cost and the gap (plan §15.5)."""
    found = optimum(topology, upper_bound=best_candidate_cost)
    gap = (
        (best_candidate_cost - found["cost"])
        if (best_candidate_cost is not None and found["cost"] is not None)
        else None
    )
    return {
        "topology": topology.name,
        "optimum_cost": found["cost"],
        "optimum_cap_ids": found["cap_ids"],
        "best_candidate_cost": best_candidate_cost,
        "gap": gap,
    }
