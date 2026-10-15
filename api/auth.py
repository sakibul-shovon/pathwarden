"""Workspace-scoped API keys and the human-only guard (plan §17, §18; decisions A-07, A-12).

Two independent checks, both FastAPI dependencies so a route cannot forget them silently
(``tests/test_invariants.py`` fails for a route that is neither covered nor classified):

* ``require_workspace_access`` is attached to every ``/api/ws/{ws}/...`` router. With ``PW_AUTH=on``
  the request needs ``Authorization: Bearer <key>`` and the key must belong to that workspace
  (``<ws>-mcp``, the view of the MCP gateway's graph, belongs to ``<ws>``). Missing or unknown key:
  401. Key of another workspace, or a workspace that does not exist: the same 403, so nothing about
  which workspaces exist leaks. With ``PW_AUTH=off`` (local mode) it does nothing.
* ``require_human`` is attached to the risk-increasing routes (approve, reject, heal-approve,
  quarantine release, remediation apply/reset): the header ``X-PW-Human: true`` must be present, in
  both modes. The header is a deliberate-action guard, NOT authentication: any client can set it.
  Real approval authority in hosted mode rests on the workspace key.

Keys are compared in constant time and never logged or echoed.
"""

from __future__ import annotations

import hmac
import re
from pathlib import Path

import yaml
from fastapi import Request

from api.api_errors import ApiError
from api.settings import Settings

HUMAN_HEADER = "X-PW-Human"
MCP_SUFFIX = "-mcp"
FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"
DEFAULT_KEYS_FILE = FIXTURES_DIR / "api_keys.yaml"

_WORKSPACE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,31}$")


class AuthConfigError(ValueError):
    """The key configuration is unusable; the API refuses to start (fail closed)."""


def base_workspace(name: str) -> str:
    """``tinyqueue-mcp`` -> ``tinyqueue`` (the MCP view belongs to the same tenant)."""
    return name.removesuffix(MCP_SUFFIX)


class ApiKeys:
    """``key -> workspace``. Built from ``PW_API_KEYS`` or a YAML file; empty is an error."""

    def __init__(self, mapping: dict[str, str]) -> None:
        if not mapping:
            raise AuthConfigError("PW_AUTH=on needs at least one API key")
        for key, workspace in mapping.items():
            if not key.strip() or len(key) < 8:
                raise AuthConfigError("an API key is empty or too short")
            if not _WORKSPACE.match(workspace) or workspace.endswith(MCP_SUFFIX):
                raise AuthConfigError(f"invalid workspace name {workspace!r} in the key file")
        self._mapping = dict(mapping)

    @classmethod
    def load(cls, settings: Settings) -> ApiKeys:
        if settings.api_keys:
            pairs = [item.partition("=") for item in settings.api_keys.split(",") if item.strip()]
            if any(not sep for _, sep, _ in pairs):
                raise AuthConfigError("PW_API_KEYS must look like 'key=workspace,key2=workspace2'")
            return cls({key.strip(): workspace.strip() for key, _, workspace in pairs})
        path = settings.api_keys_file or DEFAULT_KEYS_FILE
        if not path.is_file():
            raise AuthConfigError(f"API key file not found: {path.name}")
        data = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
        keys = data.get("keys")
        if not isinstance(keys, dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in keys.items()
        ):
            raise AuthConfigError("the key file must contain 'keys: {key: workspace}'")
        return cls(keys)

    def workspace_of(self, presented: str) -> str | None:
        """The workspace of ``presented``, comparing against every key in constant time."""
        found: str | None = None
        for key, workspace in self._mapping.items():
            if hmac.compare_digest(key.encode(), presented.encode()):
                found = workspace
        return found

    @property
    def workspaces(self) -> frozenset[str]:
        return frozenset(self._mapping.values())


def _presented_key(request: Request) -> str | None:
    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    return token.strip() if scheme.lower() == "bearer" and token.strip() else None


def _authenticated_workspace(request: Request) -> str:
    """The workspace of the presented key (401 when absent or unknown)."""
    key = _presented_key(request)
    keys: ApiKeys = request.app.state.api_keys
    workspace = keys.workspace_of(key) if key else None
    if workspace is None:
        raise ApiError(401, "unauthorized", "a valid API key is required (Authorization: Bearer)")
    return workspace


def require_workspace_access(request: Request, ws: str) -> None:
    """Router-level dependency of every ``/api/ws/{ws}/...`` route."""
    if request.app.state.settings.auth != "on":
        return
    if _authenticated_workspace(request) != base_workspace(ws):
        raise ApiError(403, "forbidden", "this key cannot access that workspace")


def require_any_key(request: Request) -> None:
    """For global (not workspace-scoped) human actions: any valid key, when auth is on (A-07)."""
    if request.app.state.settings.auth == "on":
        _authenticated_workspace(request)


def require_human(request: Request) -> None:
    """The deliberate-action guard for risk-increasing endpoints (both auth modes)."""
    if request.headers.get(HUMAN_HEADER, "").strip().lower() != "true":
        raise ApiError(
            403,
            "human_required",
            f"this action needs the header {HUMAN_HEADER}: true (a deliberate human action)",
        )
