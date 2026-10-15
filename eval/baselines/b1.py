"""B1: per-action LLM judge. Sees the proposing session's events and the proposed action."""

from __future__ import annotations

from api.llm import Llm
from eval.baselines import judge

NAME = "B1"
SCOPE = "session"


def decide(llm: Llm, scenario: dict) -> judge.Verdict:
    return judge.judge(llm, scenario, SCOPE)
