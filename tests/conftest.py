"""Shared fixtures. Tests run against a REAL FalkorDB (never mocked); start it with `make up`."""

from __future__ import annotations

import secrets
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from falkordb import FalkorDB

from api.graph.client import NamedGraph, connect
from api.graph.schema import reset_graph
from api.runtime.registry import Registry
from api.runtime.runtime import Runtime
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


FIXTURES = Path(__file__).resolve().parents[1] / "fixtures"


@pytest.fixture(scope="session")
def registry() -> Registry:
    return Registry.load(FIXTURES / "registry.yaml")


@pytest.fixture(scope="session")
def eval_registry(registry: Registry) -> Registry:
    return registry.with_eval_extras(FIXTURES / "registry_eval.yaml")


@pytest.fixture
def make_graph(db: FalkorDB, registry: Registry) -> Iterator[Callable[..., NamedGraph]]:
    """Factory for seeded throw-away graphs (`pw_test_<random>`); all deleted afterwards."""
    created: list[str] = []

    def factory(reg: Registry | None = None) -> NamedGraph:
        name = f"pw_test_{secrets.token_hex(4)}"
        created.append(name)
        return reset_graph(db, name, reg or registry)

    yield factory
    for name in created:
        try:
            db.select_graph(name).delete()
        except Exception:  # noqa: BLE001
            pass


@pytest.fixture
def graph(make_graph: Callable[..., NamedGraph]) -> NamedGraph:
    return make_graph()


@pytest.fixture
def runtime(graph: NamedGraph, registry: Registry) -> Runtime:
    return Runtime(graph, registry)


@pytest.fixture
def cypher(db: FalkorDB) -> Callable[..., Callable[..., list]]:
    """Test-only direct Cypher against a graph: ``cypher(graph)("MATCH ... $x", x=1)``.

    Tests may inspect the graph directly; application code may not (it uses named queries).
    """

    def bind(graph: NamedGraph) -> Callable[..., list]:
        def run(text: str, **params: object) -> list:
            return db.select_graph(graph.name).query(text, params).result_set

        return run

    return bind


@pytest.fixture
def graph_name(db: FalkorDB) -> Iterator[str]:
    """A unique throw-away graph name (`pw_test_<random>`), deleted after the test."""
    name = f"pw_test_{secrets.token_hex(4)}"
    yield name
    try:
        db.select_graph(name).delete()
    except Exception:  # noqa: BLE001 - graph may never have been created
        pass
