"""Forensics, healing, quarantine release and memory inventory (plan §18)."""

from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from api.api_errors import ApiError
from api.forensics.agent import LlmModeUnavailableError
from api.routes.workspace import Ws

router = APIRouter(prefix="/api/ws/{ws}")


class ForensicsRequest(BaseModel):
    mode: Literal["scripted", "llm"] = "scripted"


class HealRequest(BaseModel):
    approver: str = "maintainer"


@router.post("/forensics/{action_id}")
def run_forensics(ws: Ws, action_id: str, body: ForensicsRequest | None = None) -> dict:
    """Investigate, quarantine (automatic: risk-reducing) and replay in the sandbox."""
    body = body or ForensicsRequest()
    try:
        return ws.forensics(action_id, body.mode).model_dump()
    except LlmModeUnavailableError:
        raise ApiError(
            501, "llm_not_configured", "the LLM forensic mode arrives in phase P8"
        ) from None


@router.post("/heal/{action_id}/approve")
def approve_heal(ws: Ws, action_id: str, body: HealRequest | None = None) -> dict:
    """Human approval of the healed release: re-run in the main graph, gate, execute, supersede."""
    return ws.heal_approve(action_id, (body or HealRequest()).approver)


@router.post("/quarantine/{quarantine_id}/release")
def release_quarantine(ws: Ws, quarantine_id: str) -> dict:
    """Human undo of a quarantine (reversible; the Quarantine node stays as the audit record)."""
    return {"quarantine_id": quarantine_id, "released": ws.release_quarantine(quarantine_id)}


@router.get("/memory")
def memory(ws: Ws) -> list[dict]:
    """Team-memory inventory: writer, day, untrusted origins and quarantine state."""
    return ws.memory_inventory()
