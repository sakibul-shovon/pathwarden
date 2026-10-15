"""API error type and the mapping from domain errors to the plan's error shape (§18):
``{"error": "<code>", "detail": "<text>"}``."""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from api.runtime.errors import (
    ActionStateError,
    NotFoundError,
    PathwardenError,
    QuarantinedError,
)


class ApiError(Exception):
    def __init__(self, status: int, code: str, detail: str) -> None:
        super().__init__(detail)
        self.status, self.code, self.detail = status, code, detail


def _body(code: str, detail: str) -> dict:
    return {"error": code, "detail": detail}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=_body(exc.code, exc.detail))

    @app.exception_handler(NotFoundError)
    async def _not_found(_: Request, exc: NotFoundError) -> JSONResponse:
        return JSONResponse(status_code=404, content=_body("not_found", str(exc)))

    @app.exception_handler(ActionStateError)
    async def _state(_: Request, exc: ActionStateError) -> JSONResponse:
        return JSONResponse(status_code=409, content=_body("invalid_state", str(exc)))

    @app.exception_handler(QuarantinedError)
    async def _quarantined(_: Request, exc: QuarantinedError) -> JSONResponse:
        return JSONResponse(status_code=409, content=_body("quarantined", str(exc)))

    @app.exception_handler(PathwardenError)
    async def _domain(_: Request, exc: PathwardenError) -> JSONResponse:
        return JSONResponse(status_code=400, content=_body("bad_request", str(exc)))

    @app.exception_handler(RequestValidationError)
    async def _validation(_: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(p) for p in first.get("loc", ()))
        return JSONResponse(
            status_code=422, content=_body("validation_error", f"{where}: {first.get('msg', '')}")
        )

    @app.exception_handler(Exception)
    async def _unexpected(_: Request, exc: Exception) -> JSONResponse:
        # fail closed: an unexpected error (e.g. the gate failing) never looks like success
        return JSONResponse(status_code=500, content=_body("internal_error", type(exc).__name__))
