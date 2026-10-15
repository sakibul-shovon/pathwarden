"""The Forensic Agent (plan §13): a scripted plan (default) and an LLM plan with a fallback.

investigate -> quarantine (automatic, risk-reducing) -> sandbox replay -> re-gate -> report.
The agent sees only identifiers and metadata (never artifact content; rule 3), whether a script
or a model chooses the tools. Releasing the healed result is a human decision
(``Workspace.heal_approve``, rule 8).

LLM plan (§13.3): the model picks among the same tools (at most 8 calls) and must answer with a
valid ``ForensicReport``. Beyond schema validity the report is checked against what the tools
actually returned, so a model cannot claim a quarantine, a sandbox verdict or an APPROVE
recommendation that did not happen. Invalid JSON, an unknown tool, bad arguments, a report that
contradicts the tool results, an LLM error or an exceeded budget all fall back to the scripted
plan (``fallback_used``).
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from api.forensics.report import (
    ForensicReport,
    LaunderingMemory,
    PayloadDiff,
    SandboxResult,
)
from api.forensics.tools import ForensicTools
from api.llm import Llm, LlmError, parse_json_reply

log = logging.getLogger("pathwarden.forensics")

MAX_TOOL_CALLS = 8
PROMPT = Path(__file__).resolve().parents[1] / "agents" / "prompts" / "forensic.txt"


class LlmModeUnavailableError(Exception):
    """``mode="llm"`` was requested but no language model is configured (``PW_LLM_API_KEY``)."""


class _Invalid(Exception):
    """The model did something the plan does not allow; the caller falls back to the script."""


class _Trace:
    """What the tools really returned in an LLM investigation (the report is checked against it)."""

    def __init__(self) -> None:
        self.witnesses: dict | None = None
        self.laundering: list[dict] | None = None
        self.previews: dict[str, dict] = {}
        self.quarantine_ids: set[str] = set()
        self.replay: dict | None = None
        self.gated: dict | None = None


class ForensicAgent:
    def __init__(self, tools: ForensicTools, llm: Llm | None = None) -> None:
        self._tools = tools
        self._llm = llm

    def run(self, action_id: str, mode: str = "scripted") -> ForensicReport:
        if mode == "scripted":
            return self._scripted(action_id)
        if mode != "llm":
            raise ValueError(f"unknown forensic mode {mode!r}")
        if self._llm is None:
            raise LlmModeUnavailableError(mode)
        return self._llm_plan(action_id, self._llm)

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

    # ------------------------------------------------------------------ LLM plan (§13.3)
    def _llm_plan(self, action_id: str, llm: Llm) -> ForensicReport:
        system = PROMPT.read_text(encoding="utf-8").rstrip("\n").replace("{action_id}", action_id)
        messages = [{"role": "system", "content": system}, {"role": "user", "content": "Start."}]
        trace = _Trace()
        llm_calls = 0
        tool_calls = 0
        try:
            while True:
                raw = llm.complete(messages)
                llm_calls += 1
                parsed = parse_json_reply(raw)
                if not isinstance(parsed, dict):
                    raise _Invalid("reply is not an object")
                if "report" in parsed:
                    report = self._check_report(action_id, parsed["report"], trace)
                    report.mode, report.fallback_used, report.llm_calls = "llm", False, llm_calls
                    return report
                tool_calls += 1
                if tool_calls > MAX_TOOL_CALLS:
                    raise _Invalid("tool-call budget exceeded")
                result = self._dispatch(action_id, parsed.get("tool"), parsed.get("args"), trace)
                messages.append({"role": "assistant", "content": raw})
                messages.append(
                    {
                        "role": "user",
                        "content": f"TOOL RESULT {parsed['tool']}: {json.dumps(result)}",
                    }
                )
        except (LlmError, _Invalid, ValueError, KeyError, TypeError, ValidationError) as err:
            log.info(
                "LLM forensic plan abandoned (%s); using the scripted plan", type(err).__name__
            )
        fallback = self._scripted(action_id)
        fallback.mode, fallback.fallback_used, fallback.llm_calls = "llm", True, llm_calls
        return fallback

    def _dispatch(self, action_id: str, tool: Any, args: Any, trace: _Trace) -> Any:
        tools = self._tools
        if not isinstance(tool, str) or not isinstance(args, dict):
            raise _Invalid("bad tool call")
        if tool == "get_witnesses":
            self._require(args.get("action_id") == action_id)
            trace.witnesses = tools.get_witnesses(action_id)
            return trace.witnesses
        if tool == "trace_memory":
            self._require(args.get("action_id") == action_id)
            trace.laundering = tools.trace_memory(action_id)
            return trace.laundering
        if tool == "preview_quarantine":
            source_id = args.get("source_id")
            self._require(isinstance(source_id, str))
            trace.previews[source_id] = tools.preview_quarantine(source_id)
            return trace.previews[source_id]
        if tool == "apply_quarantine":
            source_id, ids = args.get("source_id"), args.get("artifact_ids")
            self._require(isinstance(source_id, str) and isinstance(ids, list))
            preview = trace.previews.get(source_id)  # quarantine only what a preview listed
            self._require(preview is not None and set(ids) <= set(preview["artifact_ids"]))
            applied = tools.apply_quarantine(source_id, ids)
            if applied["quarantine_id"]:
                trace.quarantine_ids.add(applied["quarantine_id"])
            return applied
        if tool == "sandbox_replay":
            task_ref, agents = args.get("task_ref"), args.get("agents")
            self._require(trace.witnesses is not None and task_ref == trace.witnesses["task_ref"])
            self._require(isinstance(agents, list) and set(agents) <= {"fixer", "release"})
            trace.replay = tools.sandbox_replay(task_ref, agents)
            return trace.replay
        if tool == "gate_in_sandbox":
            self._require(trace.replay is not None)
            self._require(args.get("action_id") == trace.replay["new_action_id"])
            trace.gated = tools.gate_in_sandbox(args["action_id"])
            return trace.gated
        if tool == "list_memory_inventory":
            return tools.list_memory_inventory()
        raise _Invalid(f"unknown tool {tool!r}")

    @staticmethod
    def _require(condition: bool) -> None:
        if not condition:
            raise _Invalid("tool arguments are not allowed here")

    def _check_report(self, action_id: str, data: Any, trace: _Trace) -> ForensicReport:
        """A schema-valid report that also agrees with what the tools returned, or ``_Invalid``."""
        report = ForensicReport.model_validate(data)
        self._require(report.action_id == action_id and trace.witnesses is not None)
        untrusted = trace.witnesses["untrusted_witness"]
        self._require(report.untrusted_source == (untrusted[-1] if untrusted else ""))
        traced = {m["memory_id"] for m in (trace.laundering or [])}
        self._require({m.memory_id for m in report.laundering_memories} <= traced)
        previewed = {a for p in trace.previews.values() for a in p["artifact_ids"]}
        self._require(set(report.quarantined_artifacts) <= previewed)
        if report.quarantine_id is not None:
            self._require(report.quarantine_id in trace.quarantine_ids)
        if report.sandbox is None:
            self._require(report.recommendation == "ESCALATE_TO_HUMAN")
            report.diff = None
        else:
            self._require(trace.replay is not None and trace.gated is not None)
            self._require(
                report.sandbox
                == SandboxResult(
                    graph=trace.replay["graph"],
                    new_action_id=trace.replay["new_action_id"],
                    verdict=trace.gated["verdict"],
                    reason=trace.gated["reason"],
                )
            )
            # payload ids are not offered to the model by any tool, so the diff is filled in from
            # the graph rather than trusted
            report.diff = PayloadDiff(
                held_payload_id=self._tools.held_payload_id(action_id),
                healed_payload_id=self._tools.sandbox_payload_id(trace.replay["new_action_id"]),
            )
            expected = "APPROVE_HEALED_RELEASE" if report.sandbox.verdict == "ALLOW" else None
            self._require(report.recommendation == (expected or "ESCALATE_TO_HUMAN"))
        return report
