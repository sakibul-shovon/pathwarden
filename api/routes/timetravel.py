"""Time-travel endpoints (plan §14, §18)."""

from __future__ import annotations

from fastapi import APIRouter

from api.api_errors import ApiError
from api.routes.workspace import Ws
from api.runtime import timetravel

router = APIRouter(prefix="/api/ws/{ws}")


@router.get("/timeline/max")
def timeline_max(ws: Ws) -> dict:
    """The current logical clock value (0 for an empty workspace)."""
    ws.runtime  # noqa: B018 - makes sure the workspace graph exists
    return {"t": timetravel.max_clock(ws.graph)}


@router.get("/graph-at")
def graph_at(ws: Ws, t: int) -> dict:
    """Nodes, edges and actions as of logical time ``t``, with the two taint markers."""
    if t < 0:
        raise ApiError(400, "bad_request", "t must be a non-negative integer")
    ws.runtime  # noqa: B018
    return timetravel.graph_at(ws.graph, t)
