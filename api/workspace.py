"""One workspace = one tenant graph plus everything that serves it (plan §7.1, §17).

Holds the registry, policy, graph handle, a long-lived Runtime and Gate, the mock sinks and a lock
that serialises every write (a single writer per workspace keeps id counters race-free).
"""

from __future__ import annotations

import shutil
import threading
from pathlib import Path

from falkordb import FalkorDB

from api.agents.scripted import Fixtures, ScriptedAgents
from api.graph.client import NamedGraph, connect
from api.graph.schema import main_graph_name, reset_graph
from api.runtime.errors import NotFoundError
from api.runtime.events import EventLog
from api.runtime.gate import Gate
from api.runtime.orchestrator import Orchestrator
from api.runtime.registry import Registry, load_policy, policy_version
from api.runtime.runtime import Runtime
from api.runtime.sinks import SinkWriter
from api.scenarios.demo import SCENARIOS, run_scenario
from api.settings import Settings

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"


class LiveModeUnavailableError(Exception):
    """``mode="live"`` was requested before live agents exist (P8)."""


class Workspace:
    def __init__(
        self,
        name: str,
        db: FalkorDB,
        state_dir: Path,
        fixtures_dir: Path = FIXTURES_DIR,
        graph_name: str | None = None,
    ):
        self.name = name
        self._db = db
        self.fixtures = Fixtures(fixtures_dir)
        self.registry = Registry.load(fixtures_dir / "registry.yaml")
        if self.registry.workspace != name:
            raise NotFoundError(f"workspace {name!r}")
        self.policy = load_policy(fixtures_dir / "policy.yaml")
        self._policy_version = policy_version(fixtures_dir / "policy.yaml")
        self.graph_name = graph_name or main_graph_name(name)  # override: test isolation only
        self.graph = NamedGraph(db, self.graph_name, self.policy.query_timeout_ms)
        self.state_dir = state_dir / name
        self.sinks = SinkWriter(self.state_dir / "sinks")
        self.lock = threading.RLock()
        self._runtime: Runtime | None = None
        self._gate: Gate | None = None

    # ------------------------------------------------------------------ lifecycle
    def reset(self) -> None:
        """Recreate the graph from the registry and clear the generated state files."""
        with self.lock:
            shutil.rmtree(self.state_dir, ignore_errors=True)
            reset_graph(self._db, self.graph_name, self.registry, self.policy.query_timeout_ms)
            self._runtime = self._gate = None

    def _ensure_graph(self) -> None:
        if self.graph_name not in self._db.list_graphs():
            self.reset()

    @property
    def runtime(self) -> Runtime:
        with self.lock:
            self._ensure_graph()
            if self._runtime is None:
                events = EventLog(self.state_dir / "events.jsonl")
                self._runtime = Runtime(self.graph, self.registry, events=events)
            return self._runtime

    @property
    def gate(self) -> Gate:
        with self.lock:
            if self._gate is None:
                self._gate = Gate(
                    self.graph,
                    self.policy,
                    policy_version=self._policy_version,
                    verdict_log=self.state_dir / "verdicts.jsonl",
                )
            return self._gate

    def orchestrator(self, *, guard: bool = True) -> Orchestrator:
        return Orchestrator(self.runtime, self.gate, self.sinks, guard=guard)

    # ------------------------------------------------------------------ scenarios
    def run_scenario(
        self, name: str, *, guard: bool = True, mode: str = "scripted", reset: bool = True
    ) -> dict:
        """Run a demo scenario. By default from a clean workspace, so verdicts are reproducible."""
        scenario = SCENARIOS.get(name)
        if scenario is None:
            raise NotFoundError(f"scenario {name!r}")
        if mode != "scripted":
            raise LiveModeUnavailableError(mode)
        with self.lock:
            if reset:
                self.reset()
            runtime = self.runtime
            return run_scenario(
                scenario,
                runtime=runtime,
                agents=ScriptedAgents(runtime, self.fixtures),
                orchestrator=self.orchestrator(guard=guard),
                graph=self.graph,
            )


class WorkspaceManager:
    """Lazily creates workspaces; only the one declared in the registry exists (P11 adds more)."""

    def __init__(self, settings: Settings, graph_names: dict[str, str] | None = None) -> None:
        self._settings = settings
        self._graph_names = graph_names or {}
        self._db: FalkorDB | None = None
        self._workspaces: dict[str, Workspace] = {}
        self._lock = threading.Lock()

    def get(self, name: str) -> Workspace:
        with self._lock:
            if name not in self._workspaces:
                if self._db is None:
                    self._db = connect(self._settings)
                self._workspaces[name] = Workspace(
                    name,
                    self._db,
                    self._settings.state_dir,
                    graph_name=self._graph_names.get(name),
                )
            return self._workspaces[name]
