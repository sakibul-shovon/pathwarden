"""FastAPI application. P0 provides only ``GET /api/health`` (plan §18); routers come later."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from api.graph.client import connect, list_graph_names
from api.settings import Settings, load_dotenv

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory; tests pass explicit ``settings``."""
    if settings is None:
        load_dotenv(Path(".env"))
        settings = Settings.from_env()

    app = FastAPI(title="Pathwarden")
    app.state.settings = settings

    @app.get("/api/health")
    def health() -> JSONResponse:
        try:
            graphs = list_graph_names(connect(app.state.settings))
        except Exception as exc:  # noqa: BLE001 - health must report any connection failure
            logger.warning("health check failed: %s", type(exc).__name__)
            return JSONResponse(
                status_code=503,
                content={"error": "falkordb_unavailable", "detail": type(exc).__name__},
            )
        return JSONResponse(content={"falkordb": "ok", "graphs": graphs})

    return app


# No module-level `app`: importing this module must have no side effects (tests must never pick up a
# developer's `.env`). Run with:  uvicorn api.main:create_app --factory   (see `make api`).
