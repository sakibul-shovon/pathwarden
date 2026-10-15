"""Remediation endpoints (plan §18): capability graph, toxic agents, max-flow candidates, apply."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel

from api.auth import require_any_key, require_human
from api.remediation.capability_graph import CapabilityService

router = APIRouter(prefix="/api/remediation/{topology}")


def service(request: Request) -> CapabilityService:
    return request.app.state.remediation


class ApplyRequest(BaseModel):
    cap_ids: list[str]


@router.get("")
def get_topology(request: Request, topology: str) -> dict:
    return service(request).state(topology)


@router.post("/reset", dependencies=[Depends(require_any_key), Depends(require_human)])
def reset(request: Request, topology: str) -> dict:
    service(request).reset(topology)
    return service(request).state(topology)


@router.post("/suggest")
def suggest(request: Request, topology: str) -> dict:
    """Candidates C1-C4, each verified on a temporary copy of the graph, cheapest first."""
    return {"topology": topology, "candidates": service(request).suggest(topology)}


@router.post("/apply", dependencies=[Depends(require_any_key), Depends(require_human)])
def apply(request: Request, topology: str, body: ApplyRequest) -> dict:
    """Revoke flows on the real graph (a human action; authentication arrives in P11)."""
    return service(request).apply(topology, body.cap_ids)


@router.get("/witness/{agent}")
def witness(request: Request, topology: str, agent: str) -> dict:
    return service(request).witness(topology, agent)
