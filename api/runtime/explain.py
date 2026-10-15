"""Read-side views built only from metadata queries (never artifact content): Rule-of-Two letters,
laundering memories (q3) and the lineage subgraph (q6 + q6b)."""

from __future__ import annotations

from api.graph.client import NamedGraph
from api.graph.loader import load_query
from api.runtime.errors import NotFoundError


def rule_of_two(graph: NamedGraph, session_id: str) -> dict:
    """Meta's Agents Rule of Two for ONE session: A untrusted input, B secrets, C state/egress."""
    rows = graph.run("q5_session_facts", session_id=session_id)
    if not rows:
        raise NotFoundError(f"session {session_id!r} not found")
    trusts, sink_external, state_writes = rows[0]
    a = "untrusted" in trusts
    b = "secret" in trusts
    c = True in sink_external or state_writes > 0
    return {"A": a, "B": b, "C": c, "green": (a + b + c) <= 2}


def laundering_memories(graph: NamedGraph, action_id: str) -> list[dict]:
    """Memories in the payload's lineage that descend from an untrusted source (q3)."""
    names = (
        "memory_id",
        "memory_key",
        "written_in_session",
        "written_by",
        "written_on",
        "untrusted_source",
    )
    rows = graph.run("q3_laundering_memory", action_id=action_id)
    return sorted(
        (dict(zip(names, row, strict=True)) for row in rows), key=lambda r: r["memory_id"]
    )


def lineage_subgraph(graph: NamedGraph, action_id: str) -> dict:
    """Edges (q6) and node metadata (q6b) of the payload's lineage."""
    edges = [
        {"src": s, "dst": d, "rel": r}
        for s, d, r in graph.run("q6_lineage_subgraph", action_id=action_id)
    ]
    ids = sorted({e["src"] for e in edges} | {e["dst"] for e in edges})
    columns = (
        "id",
        "label",
        "kind",
        "trust",
        "sanitized",
        "approved",
        "quarantined",
        "agent_id",
        "session_id",
        "key",
        "created_at",
    )
    nodes = [dict(zip(columns, row, strict=True)) for row in graph.run("q6b_node_details", ids=ids)]
    return {
        "nodes": sorted(nodes, key=lambda n: n["id"]),
        "edges": sorted(edges, key=lambda e: (e["src"], e["dst"], e["rel"])),
    }


def query_texts() -> dict[str, str]:
    """The exact gate queries, shown read-only in the UI (and in the live judge walkthrough)."""
    return {
        "q2a_untrusted_witness": load_query("q2a_untrusted_witness"),
        "q2b_secret_witness": load_query("q2b_secret_witness"),
    }
