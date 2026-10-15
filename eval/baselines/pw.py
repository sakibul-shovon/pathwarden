"""PW: the Pathwarden gate (graph only, no content, no LLM). HOLD and BLOCK both count as held."""

from __future__ import annotations

from api.runtime.gate import Verdict
from eval.baselines import Context, Decision

NAME = "PW"


def decide(ctx: Context) -> Decision:
    result = ctx.gate.decide(ctx.action_id)
    return Decision(
        hold=result.verdict is not Verdict.ALLOW,
        reason=result.reason,
        untrusted_witness=result.untrusted_witness,
        secret_witness=result.secret_witness,
        latency_ms=result.latency_ms,
    )
