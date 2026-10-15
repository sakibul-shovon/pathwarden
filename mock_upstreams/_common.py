"""Shared helpers of the mock upstream servers."""

from __future__ import annotations

import json
import os
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]


def fixtures_dir() -> Path:
    return Path(os.environ.get("PW_FIXTURES_DIR") or REPO_ROOT / "fixtures")


def state_dir() -> Path:
    path = Path(os.environ.get("PW_MOCK_STATE_DIR") or REPO_ROOT / "state" / "mcp")
    path.mkdir(parents=True, exist_ok=True)
    return path


def load_store(name: str) -> dict[str, str]:
    path = state_dir() / f"{name}.json"
    if not path.is_file():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_store(name: str, data: dict[str, str]) -> None:
    path = state_dir() / f"{name}.json"
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, sort_keys=False), encoding="utf-8")
    os.replace(tmp, path)
