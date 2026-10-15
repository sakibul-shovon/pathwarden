"""Defenses compared in the evaluation (plan §20.3). Each ``decide(ctx)`` sees the same events."""

from __future__ import annotations

from dataclasses import dataclass, field

from api.graph.client import NamedGraph
from api.runtime.gate import Gate


@dataclass(frozen=True)
class Decision:
    hold: bool
    reason: str = ""
    untrusted_witness: list[str] = field(default_factory=list)
    secret_witness: list[str] = field(default_factory=list)
    latency_ms: float = 0.0


@dataclass(frozen=True)
class Context:
    """Everything a defense may look at for ONE proposed external action."""

    graph: NamedGraph
    gate: Gate
    action_id: str
    proposer_session: str
    payload_content: str  # only content-reading baselines (B4, later the LLM judges) use this
    secret_values: tuple[str, ...]  # exact secret values from fixtures/env.yaml (DLP)
