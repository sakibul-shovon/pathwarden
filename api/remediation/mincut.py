"""Extract a minimum cut from a max flow (plan §15.3). Pure functions, no database.

Given every edge with its capacity (``cost``) and the flow on it, a residual BFS from the sources
finds the vertices still reachable; the cut is the set of edges leaving that set. The cut capacity
equals the max-flow value (max-flow min-cut theorem), which callers assert before trusting a cut.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass

EPS = 1e-9


@dataclass(frozen=True)
class CapEdge:
    src: str
    dst: str
    cap_id: str
    cost: int


def extract_cut(
    edges: list[CapEdge], flows: dict[str, float], source_names: set[str]
) -> list[CapEdge]:
    """Edges of the minimum cut nearest the sources; ``flows`` maps cap_id to flow (default 0)."""
    forward: dict[str, list[str]] = defaultdict(list)
    for edge in edges:
        flow = flows.get(edge.cap_id, 0.0)
        if flow < edge.cost - EPS:  # residual capacity left: can still push forward
            forward[edge.src].append(edge.dst)
        if flow > EPS:  # flow can be cancelled: can move backward
            forward[edge.dst].append(edge.src)

    visited = set(source_names)
    queue = deque(sorted(visited))
    while queue:
        node = queue.popleft()
        for nxt in sorted(forward[node]):
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)

    return sorted(
        (e for e in edges if e.src in visited and e.dst not in visited),
        key=lambda e: e.cap_id,
    )
