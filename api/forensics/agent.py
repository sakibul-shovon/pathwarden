"""The Forensic Agent, scripted plan (plan §13.2).

investigate -> quarantine (automatic, risk-reducing) -> sandbox replay -> re-gate -> report.
The agent sees only identifiers and metadata. Releasing the healed result is a human decision
(``Workspace.heal_approve``): rule 8.
"""

from __future__ import annotations

from api.forensics.report import (
    ForensicReport,
    LaunderingMemory,
    PayloadDiff,
    SandboxResult,
)
from api.forensics.tools import ForensicTools


class LlmModeUnavailableError(Exception):
    """``mode="llm"`` was requested before the LLM plan exists (P8)."""


class ForensicAgent:
    def __init__(self, tools: ForensicTools) -> None:
        self._tools = tools

    def run(self, action_id: str, mode: str = "scripted") -> ForensicReport:
        if mode != "scripted":
            raise LlmModeUnavailableError(mode)
        tools = self._tools

        # 1. witnesses -> the untrusted source is the last node of the untrusted witness
        witnesses = tools.get_witnesses(action_id)
        if not witnesses["untrusted_witness"]:
            return self._escalate(action_id)  # nothing untrusted to trace: a human must look
        source_id = witnesses["untrusted_witness"][-1]

        # 2. memories that carried the untrusted text into the payload
        laundering = tools.trace_memory(action_id)

        # 3-4. preview, then quarantine everything derived from that source (reversible)
        preview = tools.preview_quarantine(source_id)
        applied = tools.apply_quarantine(source_id, preview["artifact_ids"])

        report = ForensicReport(
            action_id=action_id,
            untrusted_source=source_id,
            laundering_memories=[
                LaunderingMemory(**{k: m[k] for k in LaunderingMemory.model_fields})
                for m in laundering
            ],
            quarantine_id=applied["quarantine_id"],
            quarantined_artifacts=preview["artifact_ids"],
            affected_actions=[a["action_id"] for a in preview["affected_actions"]],
            sandbox=None,
            diff=None,
            recommendation="ESCALATE_TO_HUMAN",
        )

        # 5-6. replay the work on a copy of the graph and gate the result
        task_ref = witnesses["task_ref"]
        if task_ref is None:
            return report
        replay = tools.sandbox_replay(task_ref, ["fixer", "release"])
        verdict = tools.gate_in_sandbox(replay["new_action_id"])
        report.sandbox = SandboxResult(
            graph=replay["graph"],
            new_action_id=replay["new_action_id"],
            verdict=verdict["verdict"],
            reason=verdict["reason"],
        )
        report.diff = PayloadDiff(
            held_payload_id=tools.held_payload_id(action_id),
            healed_payload_id=tools.sandbox_payload_id(replay["new_action_id"]),
        )
        if verdict["verdict"] == "ALLOW":
            report.recommendation = "APPROVE_HEALED_RELEASE"
        return report

    @staticmethod
    def _escalate(action_id: str) -> ForensicReport:
        return ForensicReport(
            action_id=action_id,
            untrusted_source="",
            laundering_memories=[],
            quarantine_id=None,
            quarantined_artifacts=[],
            affected_actions=[],
            sandbox=None,
            diff=None,
            recommendation="ESCALATE_TO_HUMAN",
        )
