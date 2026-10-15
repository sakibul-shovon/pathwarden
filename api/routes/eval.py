"""``GET /api/eval/summary``: the generated evaluation summary (plan §18). Never hand-written."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, Request

from api.api_errors import ApiError

router = APIRouter(prefix="/api/eval")

DEFAULT_RESULTS = Path(__file__).resolve().parents[2] / "eval" / "results"


@router.get("/summary")
def summary(request: Request) -> dict:
    results = getattr(request.app.state, "eval_results_dir", DEFAULT_RESULTS)
    path = Path(results) / "summary.json"
    if not path.is_file():
        raise ApiError(404, "eval_not_run", "no evaluation results yet; run `make eval`")
    return json.loads(path.read_text(encoding="utf-8"))
