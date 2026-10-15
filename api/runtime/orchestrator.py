"""Proposes -> gates -> executes (plan §9, Orchestrator).

* ALLOW -> deliver the payload to the mock sink, status ``executed``.
* HOLD / BLOCK -> nothing is delivered; the gate has already recorded status and reason.
* Guard off -> execute directly with reason ``GUARD_OFF`` (used to show the leak the gate prevents).
* A gate exception propagates: the action stays ``proposed`` and is NOT executed (fail closed).
"""

from __future__ import annotations

from dataclasses import dataclass

from api.runtime.errors import ActionStateError
from api.runtime.gate import Gate, GateResult, Verdict
from api.runtime.runtime import Runtime
from api.runtime.sinks import SinkWriter

APPROVABLE = frozenset({"proposed", "held", "blocked"})


@dataclass
class Outcome:
    action_id: str
    status: str
    reason: str
    gate: GateResult | None  # None when the guard is off


class Orchestrator:
    def __init__(self, runtime: Runtime, gate: Gate, sinks: SinkWriter, *, guard: bool = True):
        self._rt = runtime
        self._gate = gate
        self._sinks = sinks
        self.guard = guard

    def submit(self, action_id: str) -> Outcome:
        """Run the gate on a freshly proposed action and execute it if allowed."""
        if not self.guard:
            self._execute(action_id, "GUARD_OFF")
            return Outcome(action_id, "executed", "GUARD_OFF", None)
        return self._decide_and_maybe_execute(action_id)

    def approve(self, action_id: str, approver: str) -> Outcome:
        """Human approval: declassify the payload, then gate again (ALLOW unless quarantined)."""
        status = self._rt.get_action(action_id)["status"]
        if status not in APPROVABLE:
            raise ActionStateError(
                f"action {action_id} is {status}; only held/blocked can be approved"
            )
        self._rt.approve(action_id, approver)
        return self._decide_and_maybe_execute(action_id)

    def reject(self, action_id: str) -> Outcome:
        status = self._rt.get_action(action_id)["status"]
        if status not in APPROVABLE:
            raise ActionStateError(
                f"action {action_id} is {status}; only held/blocked can be rejected"
            )
        self._rt.set_action_status(action_id, "rejected", "REJECTED_BY_HUMAN")
        return Outcome(action_id, "rejected", "REJECTED_BY_HUMAN", None)

    # ------------------------------------------------------------------ internals
    def _decide_and_maybe_execute(self, action_id: str) -> Outcome:
        result = self._gate.decide(action_id)  # exceptions propagate: nothing is executed
        if result.verdict is Verdict.ALLOW:
            self._execute(action_id, result.reason)
            return Outcome(action_id, "executed", result.reason, result)
        status = "held" if result.verdict is Verdict.HOLD else "blocked"
        return Outcome(action_id, status, result.reason, result)

    def _execute(self, action_id: str, reason: str) -> None:
        context = self._rt.action_context(action_id)
        payload = self._rt.get_artifact(context["payload_id"])
        self._sinks.deliver(
            sink_id=context["sink_id"],
            action_id=action_id,
            payload_id=context["payload_id"],
            content=payload["content"],
        )
        self._rt.set_action_status(action_id, "executed", reason)
