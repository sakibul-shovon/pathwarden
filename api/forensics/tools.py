"""The Forensic Agent's tools (plan §13.1). Outputs are identifiers and metadata, never ``content``.

Read tools use the gate/metadata queries only. ``apply_quarantine`` and ``sandbox_replay`` are the
risk-REDUCING actions that rule 8 allows to be automatic. Releasing anything stays with a human.
"""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass

from api.agents.scripted import ScriptedAgents
from api.graph.client import NamedGraph
from api.runtime.errors import NotFoundError, ProvenanceError
from api.runtime.explain import laundering_memories
from api.runtime.gate import Gate
from api.runtime.runtime import Runtime

# The task a payload belongs to is derived from its key (no §10 query returns an action's task_ref).
_TASK_KEY = re.compile(r"^changelog:(\d+)$")


@dataclass
class Sandbox:
    """A disposable copy of the main graph with its own runtime (ids ``…-sbx-…``) and gate."""

    name: str
    graph: NamedGraph
    runtime: Runtime
    gate: Gate
    agents: ScriptedAgents


class ForensicTools:
    def __init__(
        self,
        *,
        graph: NamedGraph,
        runtime: Runtime,
        gate: Gate,
        make_sandbox: Callable[[], Sandbox],
    ) -> None:
        self._graph = graph
        self._rt = runtime
        self._gate = gate
        self._make_sandbox = make_sandbox
        self._sandbox: Sandbox | None = None

    # ------------------------------------------------------------------ read tools
    def get_witnesses(self, action_id: str) -> dict:
        untrusted, secret = self._gate.witnesses(action_id)
        current = self._gate.evaluate(action_id)
        return {
            "action_id": action_id,
            "untrusted_witness": untrusted,
            "secret_witness": secret,
            "quarantined_ancestors": current.quarantined_ancestors,
            "verdict": current.verdict.value,
            "reason": current.reason,
            "task_ref": self.task_ref_of(action_id),
        }

    def trace_memory(self, action_id: str) -> list[dict]:
        return laundering_memories(self._graph, action_id)

    def preview_quarantine(self, source_id: str) -> dict:
        roots, descendants = self._graph.run("q4_quarantine_preview", source_id=source_id)[0]
        ids = sorted(set(roots + descendants) - {None})
        affected = self._graph.run("q4b_affected_actions", artifact_ids=ids) if ids else []
        return {
            "source_id": source_id,
            "artifact_ids": ids,
            "affected_actions": [{"action_id": a, "status": s} for a, s in sorted(affected)],
        }

    def list_memory_inventory(self) -> list[dict]:
        columns = (
            "memory_id",
            "key",
            "kind",
            "written_by",
            "written_on",
            "quarantined",
            "untrusted_origins",
        )
        rows = self._graph.run("q8_memory_inventory")
        return sorted(
            (dict(zip(columns, r, strict=True)) for r in rows), key=lambda m: m["memory_id"]
        )

    # ------------------------------------------------------------------ risk-reducing actions
    def apply_quarantine(self, source_id: str, artifact_ids: list[str]) -> dict:
        """Quarantine the artifacts not yet quarantined (idempotent: a re-run adds nothing)."""
        details = self._rt.node_details(artifact_ids)
        fresh = [d["id"] for d in details if not d["quarantined"]]
        if not fresh:
            return {
                "quarantine_id": None,
                "quarantined_count": 0,
                "already_quarantined": sorted(artifact_ids),
            }
        qid, count = self._rt.apply_quarantine(source_id, fresh, by="forensic_agent")
        return {
            "quarantine_id": qid,
            "quarantined_count": count,
            "already_quarantined": sorted(set(artifact_ids) - set(fresh)),
        }

    def sandbox_replay(self, task_ref: str, agents: list[str]) -> dict:
        """Copy the main graph to the sandbox and re-run ``agents`` for ``task_ref`` there."""
        match = re.fullmatch(r"issue:(\d+)", task_ref)
        if not match:
            raise ProvenanceError(f"cannot replay task_ref {task_ref!r}")
        issue = int(match.group(1))
        sandbox = self._make_sandbox()
        self._sandbox = sandbox
        new_action: str | None = None
        for agent in agents:
            if agent == "fixer":
                sandbox.agents.fixer(issue, "Replay")
            elif agent == "release":
                _, new_action = sandbox.agents.release(issue, "Replay")
            else:
                raise ProvenanceError(f"cannot replay agent {agent!r}")
        if new_action is None:
            raise ProvenanceError("the replay produced no action (include 'release')")
        return {"graph": sandbox.name, "new_action_id": new_action}

    def gate_in_sandbox(self, action_id: str) -> dict:
        if self._sandbox is None:
            raise NotFoundError("no sandbox replay has been run")
        result = self._sandbox.gate.decide(action_id)
        return {"action_id": action_id, "verdict": result.verdict.value, "reason": result.reason}

    def sandbox_payload_id(self, action_id: str) -> str:
        if self._sandbox is None:
            raise NotFoundError("no sandbox replay has been run")
        return self._sandbox.runtime.action_context(action_id)["payload_id"]

    # ------------------------------------------------------------------ helpers
    def held_payload_id(self, action_id: str) -> str:
        payload_id = self._rt.action_context(action_id)["payload_id"]
        if payload_id is None:
            raise ProvenanceError(f"action {action_id} has no payload")
        return payload_id

    def task_ref_of(self, action_id: str) -> str | None:
        """``issue:N`` for payloads keyed ``changelog:N``; None when it cannot be derived."""
        payload_id = self._rt.action_context(action_id)["payload_id"]
        if payload_id is None:
            return None
        details = self._rt.node_details([payload_id])
        match = _TASK_KEY.match(details[0]["key"]) if details else None
        return f"issue:{match.group(1)}" if match else None
