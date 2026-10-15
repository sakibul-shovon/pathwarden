"""Shared fixtures. Tests run against a REAL FalkorDB (never mocked); start it with `make up`."""

from __future__ import annotations

import secrets
from collections.abc import Iterator

import pytest
from falkordb import FalkorDB

from api.graph.client import connect
from api.settings import Settings


@pytest.fixture(scope="session")
def settings() -> Settings:
    """Settings from the process environment only. The developer's `.env` is never read in tests."""
    return Settings.from_env()


@pytest.fixture(scope="session")
def db(settings: Settings) -> FalkorDB:
    client = connect(settings)
    try:
        client.list_graphs()
    except Exception as exc:  # noqa: BLE001
        pytest.exit(
            f"FalkorDB is not reachable at {settings.falkordb_host}:{settings.falkordb_port} "
            f"({type(exc).__name__}). Run `make up` first.",
            returncode=2,
        )
    return client


@pytest.fixture
def graph_name(db: FalkorDB) -> Iterator[str]:
    """A unique throw-away graph name (`pw_test_<random>`), deleted after the test."""
    name = f"pw_test_{secrets.token_hex(4)}"
    yield name
    try:
        db.select_graph(name).delete()
    except Exception:  # noqa: BLE001 - graph may never have been created
        pass
