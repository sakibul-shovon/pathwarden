"""Action endpoints: list, inspect, explain, human approve/reject (plan §18)."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter
from pydantic import BaseModel

from api.routes.workspace import Ws
from api.runtime.explain import laundering_memories, lineage_subgraph, query_texts
from api.runtime.gate import GateResult

router = APIRouter(prefix="/api/ws/{ws}/actions")


class ApproveRequest(BaseModel):
    approver: str = "maintainer"


def gate_dict(result: GateResult) -> dict:
    out = asdict(result)
    out["verdict"] = result.verdict.value
    return out


@router.get("")
def list_actions(ws: Ws) -> list[dict]:
    return ws.runtime.list_actions()


@router.get("/{action_id}")
def get_action(ws: Ws, action_id: str) -> dict:
    """The action's recorded status plus a freshly computed (non-recording) gate result."""
    action = ws.runtime.get_action(action_id)
    context = ws.runtime.action_context(action_id)
    return {
        **action,
        "sink_id": context["sink_id"],
        "external": context["external"],
        "gate": gate_dict(ws.gate.evaluate(action_id)),
    }


@router.get("/{action_id}/explain")
def explain(ws: Ws, action_id: str) -> dict:
    ws.runtime.get_action(action_id)  # 404 for unknown actions
    gate = gate_dict(ws.gate.evaluate(action_id))
    # after a quarantine the verdict is BLOCK and carries no witnesses; the lineage still has them
    gate["untrusted_witness"], gate["secret_witness"] = ws.gate.witnesses(action_id)
    return {
        "gate": gate,
        "laundering": laundering_memories(ws.graph, action_id),
        "subgraph": lineage_subgraph(ws.graph, action_id),
        "queries": query_texts(),
    }


@router.post("/{action_id}/approve")
def approve(ws: Ws, action_id: str, body: ApproveRequest | None = None) -> dict:
    """Human approval: declassify the payload, gate again; executes only if the gate allows."""
    body = body or ApproveRequest()
    with ws.lock:
        outcome = ws.orchestrator().approve(action_id, body.approver)
    return {
        "status": outcome.status,
        "reason": outcome.reason,
        "gate": gate_dict(outcome.gate) if outcome.gate else None,
    }


@router.post("/{action_id}/reject")
def reject(ws: Ws, action_id: str) -> dict:
    with ws.lock:
        outcome = ws.orchestrator().reject(action_id)
    return {"status": outcome.status, "reason": outcome.reason}
