"""B3: Full-trace LLM judge (plan §20.3).

Input: all events of all sessions + proposed action.
"""

from __future__ import annotations

from eval.baselines import Context, Decision
from eval.baselines.llm_judge import run_judge

NAME = "B3"


def decide(ctx: Context) -> Decision:
    return run_judge(ctx, sid_filter=None)
