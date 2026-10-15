"""Thin FalkorDB connection helpers.

Only client calls that were verified against the installed ``falkordb`` package are used here
(see scripts/probe_falkordb.py and docs/DECISIONS.md Part C). In particular the plan's
``db.list()`` does not exist in falkordb 1.8.0; the verified call is ``list_graphs()``.
"""

from __future__ import annotations

from falkordb import FalkorDB

from api.settings import Settings


def connect(settings: Settings) -> FalkorDB:
    """Return a client for the configured FalkorDB. Does not open a connection until first use."""
    return FalkorDB(
        host=settings.falkordb_host,
        port=settings.falkordb_port,
        password=settings.falkordb_password,
    )


def list_graph_names(db: FalkorDB) -> list[str]:
    """Names of all graphs (GRAPH.LIST)."""
    return sorted(db.list_graphs())
