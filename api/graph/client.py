"""Thin FalkorDB connection helpers.

Only client calls that were verified against the installed ``falkordb`` package are used here
(see scripts/probe_falkordb.py and docs/DECISIONS.md Part C). In particular the plan's
``db.list()`` does not exist in falkordb 1.8.0; the verified call is ``list_graphs()``.
"""

from __future__ import annotations

from falkordb import FalkorDB

from api.graph.loader import READ_ONLY_QUERIES, load_query
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


class NamedGraph:
    """One graph plus "run a query by name". The only way application code talks to Cypher."""

    def __init__(self, db: FalkorDB, name: str, timeout_ms: int | None = None) -> None:
        self._db = db
        self.name = name
        self._timeout_ms = timeout_ms

    def run(self, query: str, **params: object) -> list[list]:
        """Run ``api/graph/queries/<query>.cypher`` with ``params``; return the result rows."""
        text = load_query(query)
        graph = self._db.select_graph(self.name)
        send = graph.ro_query if query in READ_ONLY_QUERIES else graph.query
        return send(text, params, timeout=self._timeout_ms).result_set
