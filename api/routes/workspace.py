"""Workspace-level endpoints: reset, scenarios, artifacts, Rule-of-Two badges, sinks (plan §18)."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel

from api.api_errors import ApiError
from api.runtime.errors import NotFoundError
from api.runtime.explain import rule_of_two
from api.scenarios.demo import SCENARIOS
from api.workspace import LiveModeUnavailableError, Workspace

router = APIRouter(prefix="/api/ws/{ws}")


def get_workspace(ws: str, request: Request) -> Workspace:
    try:
        return request.app.state.workspaces.get(ws)
    except NotFoundError:
        raise ApiError(404, "unknown_workspace", f"no workspace named {ws!r}") from None


Ws = Annotated[Workspace, Depends(get_workspace)]


class RunRequest(BaseModel):
    guard: bool = True
    mode: Literal["scripted", "live"] = "scripted"
    reset: bool = True  # start from a clean workspace so verdicts are reproducible (see DECISIONS)


@router.post("/reset")
def reset(ws: Ws) -> dict:
    ws.reset()
    return {"workspace": ws.name, "graph": ws.graph_name, "reset": True}


@router.get("/scenarios")
def scenarios(ws: Ws) -> list[dict]:
    return [
        {
            "name": s.name,
            "description": s.description,
            "expected": {"status": s.expected_status, "reason": s.expected_reason},
        }
        for s in SCENARIOS.values()
    ]


@router.post("/scenarios/{name}/run")
def run(ws: Ws, name: str, body: RunRequest | None = None) -> dict:
    body = body or RunRequest()
    try:
        return ws.run_scenario(name, guard=body.guard, mode=body.mode, reset=body.reset)
    except LiveModeUnavailableError:
        raise ApiError(501, "live_not_available", "live LLM agents arrive in phase P8") from None
    except NotFoundError:
        raise ApiError(404, "unknown_scenario", f"no scenario named {name!r}") from None


@router.get("/artifacts/{artifact_id}")
def artifact(
    ws: Ws, artifact_id: str, graph: Annotated[Literal["main", "sandbox"], Query()] = "main"
) -> dict:
    """Full artifact including ``content`` (UI only; the gate and forensics never read it)."""
    if graph == "sandbox":
        raise ApiError(501, "sandbox_not_available", "the sandbox graph arrives in phase P4")
    return ws.runtime.get_artifact(artifact_id)


@router.get("/sessions/{session_id}/rule-of-two")
def session_rule_of_two(ws: Ws, session_id: str) -> dict:
    return rule_of_two(ws.graph, session_id)


@router.get("/sinks/{sink_id}")
def sink(ws: Ws, sink_id: str) -> list[dict]:
    if ws.registry.sink(sink_id) is None:
        raise ApiError(404, "unknown_sink", f"no sink named {sink_id!r}")
    return ws.sinks.posted(sink_id)
