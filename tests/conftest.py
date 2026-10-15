"""Shared fixtures. Tests run against a REAL FalkorDB (never mocked); start it with `make up`."""

from __future__ import annotations

import secrets
from collections.abc import Callable, Iterator
from pathlib import Path

import pytest
from falkordb import FalkorDB
from fastapi.testclient import TestClient

from api.graph.client import NamedGraph, connect
from api.graph.schema import reset_graph
from api.main import create_app
from api.runtime.registry import Registry
from api.runtime.runtime import Runtime
from api.settings import Settings
from api.workspace import WorkspaceManager


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


@pytest.fixture
def manager(db: FalkorDB, settings: Settings, tmp_path: Path) -> Iterator[WorkspaceManager]:
    """A workspace manager on a throw-away graph (and its sandbox), with state in tmp_path."""
    name = f"pw_test_{secrets.token_hex(4)}"
    mgr = WorkspaceManager(
        settings.model_copy(update={"state_dir": tmp_path}), graph_names={"tinyqueue": name}
    )
    yield mgr
    for graph in (name, name + "__sbx"):
        try:
            db.select_graph(graph).delete()
        except Exception:  # noqa: BLE001
            pass


DEMO_KEY = "pwdemo-key-tinyqueue-0001"  # fixtures/api_keys.yaml -> workspace tinyqueue


def human_headers(settings: Settings, key: str = DEMO_KEY) -> dict[str, str]:
    """What the UI sends: the human header always, the workspace key when ``PW_AUTH=on``.

    Run the whole suite in hosted mode with ``PW_AUTH=on`` (``make test-auth``).
    """
    headers = {"X-PW-Human": "true"}
    if settings.auth == "on":
        headers["Authorization"] = f"Bearer {key}"
    return headers


def unknown_workspace_error(settings: Settings) -> str:
    """Hosted mode answers a workspace the key may not use (or that does not exist) with the same
    403, so the answer never reveals which workspaces exist."""
    return "forbidden" if settings.auth == "on" else "unknown_workspace"


def make_client(app, settings: Settings) -> TestClient:
    return TestClient(app, raise_server_exceptions=False, headers=human_headers(settings))


@pytest.fixture
def client(manager: WorkspaceManager, settings: Settings, tmp_path: Path) -> TestClient:
    app = create_app(settings.model_copy(update={"state_dir": tmp_path}), manager)
    return make_client(app, settings)


@pytest.fixture
def live_client(db, settings, tmp_path):
    graphs: list[str] = []

    def build(llm):
        name = f"pw_test_{secrets.token_hex(4)}"
        graphs.extend([name, name + "__sbx"])
        config = settings.model_copy(update={"state_dir": tmp_path})
        manager = WorkspaceManager(config, graph_names={"tinyqueue": name}, llm=llm)
        return make_client(create_app(config, manager), settings), manager

    yield build
    for graph in graphs:
        try:
            db.select_graph(graph).delete()
        except Exception:  # noqa: BLE001
            pass
