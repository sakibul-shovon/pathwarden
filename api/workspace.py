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
from api.forensics.agent import ForensicAgent, LlmModeUnavailableError
from api.forensics.report import ForensicReport
from api.forensics.tools import ForensicTools, Sandbox
from api.graph.client import NamedGraph, connect
from api.graph.schema import main_graph_name, mcp_graph_name, reset_graph
from api.runtime.errors import ActionStateError, NotFoundError, ProvenanceError
from api.runtime.events import EventLog
from api.runtime.gate import Gate
from api.runtime.orchestrator import Orchestrator
from api.runtime.registry import Registry, load_policy, policy_version
from api.runtime.runtime import Runtime
from api.runtime.sinks import SinkWriter
from api.scenarios.demo import SCENARIOS, build_result, run_scenario
from api.settings import Settings

FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"
MCP_SUFFIX = "-mcp"


__all__ = ["LiveModeUnavailableError", "LlmModeUnavailableError", "Workspace", "WorkspaceManager"]


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
        registry_workspace: str | None = None,
    ):
        self.name = name
        self._db = db
        self.fixtures = Fixtures(fixtures_dir)
        self.registry = Registry.load(fixtures_dir / "registry.yaml")
        if self.registry.workspace != (registry_workspace or name):
            raise NotFoundError(f"workspace {name!r}")
        self.policy = load_policy(fixtures_dir / "policy.yaml")
        self._policy_version = policy_version(fixtures_dir / "policy.yaml")
        self.graph_name = graph_name or main_graph_name(name)  # override: test isolation only
        self.graph = NamedGraph(db, self.graph_name, self.policy.query_timeout_ms)
        self.sandbox_graph_name = self.graph_name + "__sbx"  # plan 7.1: pw_<ws>__sbx
        self.state_dir = state_dir / name
        self.sinks = SinkWriter(self.state_dir / "sinks")
        self.lock = threading.RLock()
        self._runtime: Runtime | None = None
        self._gate: Gate | None = None
        # quarantine id -> artifact ids it covers; the graph keeps the audit node, but no §10 query
        # lists it, so the ids the forensic agent returned are remembered here (D-019)
        self._quarantines: dict[str, list[str]] = {}

    # ------------------------------------------------------------------ lifecycle
    def reset(self) -> None:
        """Recreate the graph from the registry and clear the generated state files."""
        with self.lock:
            shutil.rmtree(self.state_dir, ignore_errors=True)
            reset_graph(self._db, self.graph_name, self.registry, self.policy.query_timeout_ms)
            self._runtime = self._gate = None
            self._quarantines = {}

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

    # ------------------------------------------------------------------ forensics and healing
    def make_sandbox(self) -> Sandbox:
        """Delete any previous sandbox, copy the main graph to ``pw_<ws>__sbx`` and open a runtime
        there (id namespace ``sbx``; the mock sinks are never touched)."""
        if self.sandbox_graph_name in self._db.list_graphs():
            self._db.select_graph(self.sandbox_graph_name).delete()
        self._db.select_graph(self.graph_name).copy(self.sandbox_graph_name)
        graph = NamedGraph(self._db, self.sandbox_graph_name, self.policy.query_timeout_ms)
        runtime = Runtime(graph, self.registry, namespace="sbx")
        gate = Gate(graph, self.policy, policy_version=self._policy_version)
        return Sandbox(
            self.sandbox_graph_name, graph, runtime, gate, ScriptedAgents(runtime, self.fixtures)
        )

    def _tools(self) -> ForensicTools:
        return ForensicTools(
            graph=self.graph,
            runtime=self.runtime,
            gate=self.gate,
            make_sandbox=self.make_sandbox,
        )

    def forensics(self, action_id: str, mode: str = "scripted") -> ForensicReport:
        """Investigate a held/blocked action, quarantine its source, replay in the sandbox."""
        with self.lock:
            self.runtime.get_action(action_id)  # NotFoundError for unknown actions
            report = ForensicAgent(self._tools()).run(action_id, mode)
            if report.quarantine_id:
                self._quarantines[report.quarantine_id] = list(report.quarantined_artifacts)
            return report

    def heal_approve(self, action_id: str, approver: str) -> dict:
        """Human approval of the healed release: re-run Fixer and Release in the MAIN graph with a
        fresh runtime (quarantine already applied), gate, execute, and supersede the held action."""
        with self.lock:
            old = self.runtime.get_action(action_id)
            if old["status"] not in ("held", "blocked"):
                raise ActionStateError(f"action {action_id} is {old['status']}; nothing to heal")
            task_ref = self._tools().task_ref_of(action_id)
            if task_ref is None:
                raise ProvenanceError(f"cannot derive the task of {action_id}")
            issue = int(task_ref.split(":")[1])

            # a fresh runtime proves ids continue from the graph state (it shares the event log)
            self._runtime = Runtime(self.graph, self.registry, events=self.runtime.events)
            runtime = self._runtime
            agents = ScriptedAgents(runtime, self.fixtures)
            first_event = len(runtime.events.events)

            fixer_session = agents.fixer(issue, "Heal")
            release_session, new_action = agents.release(issue, "Heal")
            outcome = self.orchestrator().submit(new_action)
            superseded = outcome.status == "executed"
            if superseded:
                runtime.supersede(action_id, new_action)

            gate_row = {
                "session": release_session.id,
                "agent": "gate",
                "op": "gate",
                "detail": f"{new_action} {outcome.status} {outcome.reason}",
            }
            old_row = {
                "id": action_id,
                "status": "superseded" if superseded else old["status"],
                "reason": f"SUPERSEDED_BY {new_action}" if superseded else "",
            }
            result = build_result(
                "heal",
                guard=True,
                runtime=runtime,
                graph=self.graph,
                sessions=[fixer_session, release_session],
                actions=[
                    {"id": new_action, "status": outcome.status, "reason": outcome.reason},
                    old_row,
                ],
                first_event=first_event,
                gate_entries=[(len(runtime.events.events), gate_row)],
            )
            result["approver"] = approver
            result["superseded"] = superseded
            return result

    def release_quarantine(self, quarantine_id: str) -> int:
        with self.lock:
            released = self.runtime.release_quarantine(quarantine_id)
            self._quarantines.pop(quarantine_id, None)
            return released

    def quarantine_preview(self, source_id: str) -> dict:
        """Read-only preview of a quarantine of everything derived from ``source_id``."""
        return self._tools().preview_quarantine(source_id)

    def memory_inventory(self) -> list[dict]:
        """q8 rows plus ``quarantine_id``: the newest remembered quarantine covering the entry
        (``None`` when it is not quarantined or the id is unknown, e.g. after an API restart)."""
        rows = self._tools().list_memory_inventory()
        for row in rows:
            covering = [q for q, ids in self._quarantines.items() if row["memory_id"] in ids]
            row["quarantine_id"] = max(covering) if covering and row["quarantined"] else None
        return rows

    def sandbox_artifact(self, artifact_id: str) -> dict:
        """Artifact (with content) from the SANDBOX graph only; no fallback between graphs."""
        if self.sandbox_graph_name not in self._db.list_graphs():
            raise NotFoundError("no sandbox graph exists yet; run forensics first")
        sandbox = Runtime(
            NamedGraph(self._db, self.sandbox_graph_name, self.policy.query_timeout_ms),
            self.registry,
            namespace="sbx",
        )
        return sandbox.get_artifact(artifact_id)


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
                # "<ws>-mcp" is the view of the lineage the MCP gateway wrote to pw_mcp_<ws> (P9)
                base = name.removesuffix(MCP_SUFFIX)
                default_graph = mcp_graph_name(base) if base != name else None
                self._workspaces[name] = Workspace(
                    name,
                    self._db,
                    self._settings.state_dir,
                    graph_name=self._graph_names.get(name) or default_graph,
                    registry_workspace=base,
                )
            return self._workspaces[name]
