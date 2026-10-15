"""The sanitizer contract (plan §12.1): structured fields only, no free text."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class TaskSchema(BaseModel):
    issue_id: int
    component: Literal["queue", "docs", "cli", "other"]
    severity: Literal["low", "medium", "high"]
    kind: Literal["bug", "docs", "feature"]
