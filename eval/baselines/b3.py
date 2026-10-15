"""B3: full-trace LLM judge. Sees the events of ALL sessions and the proposed action."""

from __future__ import annotations

from api.llm import Llm
from eval.baselines import judge

NAME = "B3"
SCOPE = "all"


def decide(llm: Llm, scenario: dict) -> judge.Verdict:
    return judge.judge(llm, scenario, SCOPE)
