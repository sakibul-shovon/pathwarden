"""B1: Per-action LLM judge (plan §20.3).

Input: proposing session's contents + proposed action.
"""

from __future__ import annotations

from eval.baselines import Context, Decision
from eval.baselines.llm_judge import run_judge

NAME = "B1"


def decide(ctx: Context) -> Decision:
    return run_judge(ctx, sid_filter=ctx.proposing_sid)
