"""Named-query loader (plan rule 2: all Cypher lives in ``api/graph/queries/*.cypher``).

A query is addressed only by its file name (without ``.cypher``). Parameters are always passed
separately; values are never formatted into query text.
"""

from __future__ import annotations

import re
from functools import cache
from pathlib import Path

QUERY_DIR = Path(__file__).parent / "queries"

# Queries that never write. They are sent with ``ro_query`` so the database itself enforces it.
READ_ONLY_QUERIES = frozenset(
    {
        "q0_max_ts",
        "q0_ids_with_prefix",
        "q1_session_context",
        "q1_lookup_key",
        "q1_key_exists",
        "q1_lookup_prefix",
        "q1_get_artifact",
        "q2a_untrusted_witness",
        "q2b_secret_witness",
        "q2c_quarantine_check",
        "q2d_action_context",
        "q3_laundering_memory",
        "q5_session_facts",
        "q6_lineage_subgraph",
        "q6b_node_details",
        "q7b_actions_at_time",
    }
)

_NAME = re.compile(r"^[a-z0-9_]+$")


class QueryNotFoundError(KeyError):
    """No ``<name>.cypher`` file exists."""


@cache
def load_query(name: str) -> str:
    """Return the text of ``api/graph/queries/<name>.cypher``."""
    if not _NAME.match(name):
        raise QueryNotFoundError(f"invalid query name {name!r}")
    path = QUERY_DIR / f"{name}.cypher"
    if not path.is_file():
        raise QueryNotFoundError(name)
    return path.read_text(encoding="utf-8").strip()


def available_queries() -> list[str]:
    return sorted(p.stem for p in QUERY_DIR.glob("*.cypher"))
