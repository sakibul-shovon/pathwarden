"""FastAPI application (plan §18). Routers: workspace-level and action-level endpoints."""

from __future__ import annotations

import logging
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from api.api_errors import install_error_handlers
from api.auth import ApiKeys
from api.graph.client import connect, list_graph_names
from api.remediation.capability_graph import CapabilityService
from api.routes import actions, forensics, timetravel, workspace
from api.routes import eval as eval_routes
from api.routes import remediation as remediation_routes
from api.settings import Settings, load_dotenv
from api.workspace import WorkspaceManager

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    workspaces: WorkspaceManager | None = None,
    remediation: CapabilityService | None = None,
) -> FastAPI:
    """Application factory; tests pass explicit ``settings`` (and a ``workspaces`` manager)."""
    if settings is None:
        load_dotenv(Path(".env"))
        settings = Settings.from_env()

    app = FastAPI(title="Pathwarden")
    app.state.settings = settings
    # hosted mode: the keys decide who a tenant is; no usable keys = no start (fail closed)
    app.state.api_keys = ApiKeys.load(settings) if settings.auth == "on" else None
    tenants = app.state.api_keys.workspaces if app.state.api_keys else frozenset()
    app.state.workspaces = workspaces or WorkspaceManager(settings, tenants=tenants)
    app.state.remediation = remediation or CapabilityService(settings)
    install_error_handlers(app)
    app.include_router(workspace.router)
    app.include_router(actions.router)
    app.include_router(forensics.router)
    app.include_router(timetravel.router)
    app.include_router(eval_routes.router)
    app.include_router(remediation_routes.router)

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
        if app.state.settings.auth == "on":  # hosted: never list graph (= tenant) names
            return JSONResponse(content={"falkordb": "ok"})
        return JSONResponse(content={"falkordb": "ok", "graphs": graphs})

    return app


# No module-level `app`: importing this module must have no side effects (tests must never pick up a
# developer's `.env`). Run with:  uvicorn api.main:create_app --factory   (see `make api`).
