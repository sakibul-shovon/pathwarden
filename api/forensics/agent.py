"""The Forensic Agent (plan §13): a scripted plan (default) and an LLM plan with a fallback.

investigate -> quarantine (automatic, risk-reducing) -> sandbox replay -> re-gate -> report.
The agent sees only identifiers and metadata. Releasing the healed result is a human decision
(``Workspace.heal_approve``): rule 8.

LLM plan (§13.3): the model chooses among the same tools (at most 8 calls). It only decides which
tool to call next. The report itself is **assembled from the tools' real outputs**, so a model that
invents an id, a verdict or a recommendation cannot change what is recorded: its own report is only
checked against what the tools returned. Invalid JSON, an unknown tool, an exceeded budget, a
missing
required step or a mismatching report -> the scripted plan runs and ``fallback_used`` is true.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from typing import Any

from pydantic import ValidationError

from api.agents.live import load_prompt, parse_reply, render
from api.forensics.report import (
    ForensicReport,
    LaunderingMemory,
    PayloadDiff,
    SandboxResult,
)
from api.forensics.tools import ForensicTools
from api.llm import Llm, LlmError
from api.runtime.errors import PathwardenError

logger = logging.getLogger(__name__)

MAX_TOOL_CALLS = 8  # executed tool calls (plan §13.3)
MAX_HINTS = 8  # corrections the model may need (wrong arguments, a report that is refused)


class LlmModeUnavailableError(Exception):
    """``mode="llm"`` was requested but no LLM is configured."""


class _PlanFailed(Exception):
    """The LLM plan cannot be trusted; run the scripted plan instead."""


class _Retry(Exception):
    """The final report cannot be accepted yet; the model is told why and may continue."""


class _BadArgs(Exception):
    """A tool was called with missing or wrong arguments: the model gets a hint and may retry."""


# The prompt (verbatim from the plan) names the tools but neither their arguments nor the shape of
# the report, so a wrong guess is answered with the expected shape instead of ending the plan.
REPORT_SHAPE = (
    '{"report": {"action_id": str, "untrusted_source": str, "laundering_memories": ['
    '{"memory_id": str, "memory_key": str, "written_by": str, "written_in_session": str, '
    '"written_on": str}], "quarantine_id": str | null, "quarantined_artifacts": [str], '
    '"affected_actions": [str], "sandbox": {"graph": str, "new_action_id": str, '
    '"verdict": str, "reason": str} | null, "diff": null, '
    '"recommendation": "APPROVE_HEALED_RELEASE" | "ESCALATE_TO_HUMAN"}}'
)
TOOL_ARGS = {
    "get_witnesses": '{"action_id": str}',
    "trace_memory": '{"action_id": str}',
    "preview_quarantine": '{"source_id": str}',
    "apply_quarantine": '{"source_id": str, "artifact_ids": [str]}',
    "sandbox_replay": '{"task_ref": str, "agents": ["fixer", "release"]}',
    "gate_in_sandbox": '{"action_id": str}',
    "list_memory_inventory": "{}",
}


class ForensicAgent:
    def __init__(self, tools: ForensicTools, llm: Llm | None = None) -> None:
        self._tools = tools
        self._llm = llm

    def run(self, action_id: str, mode: str = "scripted") -> ForensicReport:
        if mode == "scripted":
            return self._scripted(action_id)
        if mode != "llm" or self._llm is None:
            raise LlmModeUnavailableError(mode)
        return self._llm_plan(self._llm, action_id)

    # ------------------------------------------------------------------ scripted plan (§13.2)
    def _scripted(self, action_id: str) -> ForensicReport:
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

        report = self._base_report(action_id, source_id, laundering, preview, applied)

        # 5-6. replay the work on a copy of the graph and gate the result
        task_ref = witnesses["task_ref"]
        if task_ref is None:
            return report
        replay = tools.sandbox_replay(task_ref, ["fixer", "release"])
        verdict = tools.gate_in_sandbox(replay["new_action_id"])
        return self._finish(report, action_id, replay, verdict)

    def _base_report(
        self,
        action_id: str,
        source_id: str,
        laundering: list[dict],
        preview: dict,
        applied: dict,
    ) -> ForensicReport:
        return ForensicReport(
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

    def _finish(
        self, report: ForensicReport, action_id: str, replay: dict, verdict: dict
    ) -> ForensicReport:
        tools = self._tools
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

    # ------------------------------------------------------------------ LLM plan (§13.3)
    def _llm_plan(self, llm: Llm, action_id: str) -> ForensicReport:
        calls_before = llm.calls
        state: dict[str, Any] = {}
        try:
            report = self._drive(llm, action_id, state)
            report.mode = "llm"
        except (_PlanFailed, LlmError) as exc:
            logger.info("forensic LLM plan failed (%s); running the scripted plan", exc)
            report = self._scripted(action_id)
            report.mode = "llm"
            report.fallback_used = True
            applied = state.get("applied")
            if applied and applied.get("quarantine_id") and report.quarantine_id is None:
                # the failed attempt already quarantined: keep its id so the release button works
                report.quarantine_id = applied["quarantine_id"]
        report.llm_calls = llm.calls - calls_before
        return report

    def _dispatch_table(self, action_id: str, state: dict[str, Any]) -> dict[str, Callable]:
        tools = self._tools

        def get_witnesses(args: dict) -> dict:
            self._same(args, "action_id", action_id)
            state["witnesses"] = tools.get_witnesses(action_id)
            return state["witnesses"]

        def trace_memory(args: dict) -> list:
            self._same(args, "action_id", action_id)
            state["laundering"] = tools.trace_memory(action_id)
            return state["laundering"]

        def preview_quarantine(args: dict) -> dict:
            source_id = self._text(args, "source_id")
            state["preview"] = tools.preview_quarantine(source_id)
            return state["preview"]

        def apply_quarantine(args: dict) -> dict:
            preview = state.get("preview")
            source_id = self._text(args, "source_id")
            ids = args.get("artifact_ids")
            if not isinstance(ids, list) or not all(isinstance(i, str) for i in ids):
                raise _BadArgs("artifact_ids must be a list of strings")
            if preview is None or preview["source_id"] != source_id:
                raise _PlanFailed("apply_quarantine before preview_quarantine of that source")
            if not set(ids) <= set(preview["artifact_ids"]):
                raise _PlanFailed("apply_quarantine outside the previewed artifacts")
            state["applied"] = tools.apply_quarantine(source_id, ids)
            # a replay made before the quarantine is stale: it must be run again
            state.pop("replay", None)
            state.pop("verdict", None)
            return state["applied"]

        def sandbox_replay(args: dict) -> dict:
            agents = args.get("agents")
            if not isinstance(agents, list):
                raise _BadArgs("agents must be a list")
            state["replay"] = tools.sandbox_replay(self._text(args, "task_ref"), agents)
            return state["replay"]

        def gate_in_sandbox(args: dict) -> dict:
            replay = state.get("replay")
            if replay is None:
                raise _PlanFailed("gate_in_sandbox before sandbox_replay")
            if args.get("action_id") != replay["new_action_id"]:
                raise _BadArgs("action_id must be the new action id of the replay")
            state["verdict"] = tools.gate_in_sandbox(replay["new_action_id"])
            return state["verdict"]

        def list_memory_inventory(_args: dict) -> list:
            return tools.list_memory_inventory()

        return {
            "get_witnesses": get_witnesses,
            "trace_memory": trace_memory,
            "preview_quarantine": preview_quarantine,
            "apply_quarantine": apply_quarantine,
            "sandbox_replay": sandbox_replay,
            "gate_in_sandbox": gate_in_sandbox,
            "list_memory_inventory": list_memory_inventory,
        }

    @staticmethod
    def _text(args: dict, name: str) -> str:
        value = args.get(name)
        if not isinstance(value, str) or not value:
            raise _BadArgs(f"argument {name!r} must be a string")
        return value

    @classmethod
    def _same(cls, args: dict, name: str, expected: str) -> None:
        if cls._text(args, name) != expected:
            raise _BadArgs(f"{name} must be {expected!r}")

    def _drive(self, llm: Llm, action_id: str, state: dict[str, Any]) -> ForensicReport:
        table = self._dispatch_table(action_id, state)
        system = render(load_prompt("forensic"), action_id=action_id)
        messages = [{"role": "system", "content": system}, {"role": "user", "content": "Start."}]
        tool_calls = 0
        hints = 0
        while True:
            reply = llm.complete(messages)
            parsed = parse_reply(reply)
            if parsed is None:
                raise _PlanFailed("reply is not valid JSON")
            if "report" in parsed:
                try:
                    return self._accept(action_id, parsed["report"], state)
                except _Retry as exc:
                    hints += 1
                    if hints > MAX_HINTS:
                        raise _PlanFailed(f"report refused too often: {exc}") from None
                    answer = f"REPORT REFUSED: {exc}"
                    messages += [
                        {"role": "assistant", "content": reply},
                        {"role": "user", "content": answer},
                    ]
                    continue
            tool = parsed.get("tool")
            args = parsed.get("args") or {}
            if tool not in table or not isinstance(args, dict):
                raise _PlanFailed(f"unknown tool {tool!r}")
            if tool_calls + 1 > MAX_TOOL_CALLS:
                raise _PlanFailed("tool budget exceeded")
            tool_calls += 1
            try:
                result = table[tool](args)
            except _PlanFailed:
                raise
            except _BadArgs as exc:
                tool_calls -= 1  # nothing was executed: it does not use the budget
                hints += 1
                if hints > MAX_HINTS:
                    raise _PlanFailed(f"too many wrong calls: {exc}") from None
                result = {"error": str(exc), "expected_args": TOOL_ARGS[tool]}
            except PathwardenError as exc:
                result = {"error": type(exc).__name__}
            messages += [
                {"role": "assistant", "content": reply},
                {"role": "user", "content": f"TOOL RESULT {tool}: {json.dumps(result)}"},
            ]

    def _accept(self, action_id: str, claimed: Any, state: dict[str, Any]) -> ForensicReport:
        """Build the report from the tools' results; the model's own report must agree with it."""
        try:
            claim = ForensicReport.model_validate(claimed)
        except ValidationError:
            raise _Retry(f"not a valid ForensicReport; reply with {REPORT_SHAPE}") from None
        witnesses = state.get("witnesses")
        if witnesses is None:
            raise _Retry("call get_witnesses first")
        if not witnesses["untrusted_witness"]:
            report = self._escalate(action_id)
            if claim.recommendation != report.recommendation:
                raise _Retry(
                    "no untrusted witness exists, so the recommendation is ESCALATE_TO_HUMAN"
                )
            return report
        preview, applied = state.get("preview"), state.get("applied")
        replay, verdict = state.get("replay"), state.get("verdict")
        todo = [
            name
            for name, done in (
                ("preview_quarantine", preview),
                ("apply_quarantine", applied),
                ("sandbox_replay (after the quarantine)", replay),
                ("gate_in_sandbox", verdict),
            )
            if not done
        ]
        if todo:
            raise _Retry("steps still to do, in this order: " + ", ".join(todo))
        laundering = state.get("laundering")
        if laundering is None:
            laundering = self._tools.trace_memory(action_id)  # read-only metadata
        report = self._base_report(
            action_id, witnesses["untrusted_witness"][-1], laundering, preview, applied
        )
        report = self._finish(report, action_id, replay, verdict)
        if (
            claim.untrusted_source != report.untrusted_source
            or claim.quarantine_id != report.quarantine_id
            or claim.recommendation != report.recommendation
            or (claim.sandbox.new_action_id if claim.sandbox else None)
            != (report.sandbox.new_action_id if report.sandbox else None)
        ):
            raise _Retry(
                "the report disagrees with the tool results (untrusted_source, quarantine_id, "
                "recommendation or sandbox.new_action_id): copy them from the tool results"
            )
        return report
