"""B0: no defense. Every proposed action is allowed."""

from __future__ import annotations

from eval.baselines import Context, Decision

NAME = "B0"


def decide(_ctx: Context) -> Decision:
    return Decision(hold=False)
