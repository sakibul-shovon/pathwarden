"""Graph names, indexes (plan §7.5) and seeding from the registry.

This is the one Python module under ``api/`` allowed to contain Cypher text: the index DDL is not a
named query (see ``tests/test_invariants.py``). Everything else goes through ``NamedGraph.run``.
"""

from __future__ import annotations

from falkordb import FalkorDB

from api.graph.client import NamedGraph
from api.runtime.registry import Registry

INDEX_DDL = [
    "CREATE INDEX FOR (a:Artifact) ON (a.id)",
    "CREATE INDEX FOR (s:Source) ON (s.id)",
    "CREATE INDEX FOR (x:Action) ON (x.id)",
    "CREATE INDEX FOR (s:Session) ON (s.id)",
    "CREATE INDEX FOR (k:Sink) ON (k.id)",
    "CREATE INDEX FOR (a:Artifact) ON (a.key)",
    "CREATE INDEX FOR (a:Artifact) ON (a.store)",
]


def main_graph_name(workspace: str) -> str:
    return f"pw_{workspace}"


def sandbox_graph_name(workspace: str) -> str:
    return f"pw_{workspace}__sbx"


def mcp_graph_name(workspace: str) -> str:
    return f"pw_mcp_{workspace}"


def seed(graph: NamedGraph, registry: Registry) -> None:
    """Create Agent, Source and Sink nodes from the registry (trust labels come only from here)."""
    if registry.agents:
        graph.run("q1_seed_agents", rows=[a.model_dump() for a in registry.agents])
    if registry.sources:
        graph.run("q1_seed_sources", rows=[s.model_dump() for s in registry.sources])
    if registry.sinks:
        graph.run("q1_seed_sinks", rows=[k.model_dump() for k in registry.sinks])


def reset_graph(
    db: FalkorDB, graph_name: str, registry: Registry, timeout_ms: int | None = None
) -> NamedGraph:
    """Delete ``graph_name`` if it exists, then recreate it with indexes and registry seeds."""
    if graph_name in db.list_graphs():
        db.select_graph(graph_name).delete()
    raw = db.select_graph(graph_name)
    for ddl in INDEX_DDL:
        raw.query(ddl)
    graph = NamedGraph(db, graph_name, timeout_ms)
    seed(graph, registry)
    return graph
