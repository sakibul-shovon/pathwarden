"""The deterministic gate (plan §11).

Before an external action runs it asks the graph two questions (``q2a``/``q2b``): does the payload
descend from an untrusted source, and from a secret one, through any chain of agents, memories and
sessions? Both yes + external sink => HOLD (BLOCK in strict mode) with both witness paths.

Hard rules honoured here: the gate never reads artifact ``content`` (rule 3), makes no LLM call, and
fails closed: any error propagates as an exception and an exception is never an ALLOW (rule 6).
"""

from __future__ import annotations

import json
import time
from dataclasses import asdict, dataclass, field
from enum import StrEnum
from pathlib import Path

from api.graph.client import NamedGraph
from api.runtime.errors import NotFoundError
from api.runtime.registry import Policy


class Verdict(StrEnum):
    ALLOW = "ALLOW"
    HOLD = "HOLD"
    BLOCK = "BLOCK"


# Reasons: MISSING_PROVENANCE | QUARANTINED_LINEAGE | TRIFECTA | SECRET_EGRESS_WARNING | CLEAN
_STATUS = {Verdict.ALLOW: "allowed", Verdict.HOLD: "held", Verdict.BLOCK: "blocked"}


@dataclass
class GateResult:
    action_id: str
    verdict: Verdict
    reason: str
    untrusted_witness: list[str] = field(default_factory=list)
    secret_witness: list[str] = field(default_factory=list)
    quarantined_ancestors: list[str] = field(default_factory=list)
    latency_ms: float = 0.0
    llm_calls: int = 0


class Gate:
    def __init__(
        self,
        graph: NamedGraph,
        policy: Policy,
        *,
        policy_version: str,
        verdict_log: Path | None = None,
    ) -> None:
        self._graph = graph
        self._policy = policy
        self._policy_version = policy_version
        self._verdict_log = verdict_log

    def evaluate(self, action_id: str) -> GateResult:
        """Compute the verdict without recording anything (to display an action's current state)."""
        started = time.perf_counter()
        result = self._evaluate(action_id)
        result.latency_ms = (time.perf_counter() - started) * 1000.0
        return result

    def decide(self, action_id: str) -> GateResult:
        """Evaluate ``action_id``, record status + reason on the Action and in the verdict log."""
        result = self.evaluate(action_id)

        self._graph.run(
            "q1_set_action_status",
            action_id=action_id,
            status=_STATUS[result.verdict],
            reason=result.reason,
        )
        self._append_log(result)
        return result

    # ------------------------------------------------------------------ decision order (§11)
    def _evaluate(self, action_id: str) -> GateResult:
        context = self._graph.run("q2d_action_context", action_id=action_id)
        if not context:
            raise NotFoundError(f"action {action_id!r} not found")  # nothing to decide on
        _, payload_id, sink_id, external = context[0]

        # 1. payload or sink missing
        if payload_id is None or sink_id is None:
            return GateResult(action_id, Verdict.HOLD, "MISSING_PROVENANCE")

        # 2. quarantined payload or ancestor
        quarantined, ancestors = self._graph.run("q2c_quarantine_check", action_id=action_id)[0]
        if quarantined or ancestors:
            return GateResult(
                action_id,
                Verdict.BLOCK,
                "QUARANTINED_LINEAGE",
                quarantined_ancestors=sorted(ancestors),
            )

        # 3. witnesses
        untrusted = self._witness("q2a_untrusted_witness", action_id)
        secret = self._witness("q2b_secret_witness", action_id)

        # 4-6. verdict
        if external and untrusted and secret:
            verdict = Verdict.BLOCK if self._policy.strict else Verdict.HOLD
            return GateResult(action_id, verdict, "TRIFECTA", untrusted, secret)
        if external and secret:
            return GateResult(action_id, Verdict.ALLOW, "SECRET_EGRESS_WARNING", untrusted, secret)
        return GateResult(action_id, Verdict.ALLOW, "CLEAN", untrusted, secret)

    def _witness(self, query: str, action_id: str) -> list[str]:
        rows = self._graph.run(query, action_id=action_id)
        return list(rows[0][0]) if rows else []

    # ------------------------------------------------------------------ verdict log
    def _append_log(self, result: GateResult) -> None:
        if self._verdict_log is None:
            return
        entry = asdict(result)
        entry["verdict"] = result.verdict.value
        entry["policy_version"] = self._policy_version
        entry["witnesses"] = {
            "untrusted": entry.pop("untrusted_witness"),
            "secret": entry.pop("secret_witness"),
            "quarantined_ancestors": entry.pop("quarantined_ancestors"),
        }
        self._verdict_log.parent.mkdir(parents=True, exist_ok=True)
        with self._verdict_log.open("a", encoding="utf-8", newline="\n") as handle:
            handle.write(json.dumps(entry, sort_keys=True) + "\n")
