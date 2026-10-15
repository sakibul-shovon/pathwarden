"""The Forensic Agent's output (plan §13.4). Identifiers and metadata only, never content."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class LaunderingMemory(BaseModel):
    memory_id: str
    memory_key: str
    written_by: str
    written_in_session: str
    written_on: str


class SandboxResult(BaseModel):
    graph: str
    new_action_id: str
    verdict: str
    reason: str


class PayloadDiff(BaseModel):
    held_payload_id: str
    held_graph: Literal["main"] = "main"
    healed_payload_id: str
    healed_graph: Literal["sandbox"] = "sandbox"


class ForensicReport(BaseModel):
    action_id: str
    untrusted_source: str
    laundering_memories: list[LaunderingMemory]
    quarantine_id: str | None  # None when nothing new had to be quarantined (idempotent re-run)
    quarantined_artifacts: list[str]
    affected_actions: list[str]
    sandbox: SandboxResult | None
    diff: PayloadDiff | None
    recommendation: Literal["APPROVE_HEALED_RELEASE", "ESCALATE_TO_HUMAN"]
    mode: Literal["scripted", "llm"] = "scripted"
    fallback_used: bool = False
    llm_calls: int = 0
