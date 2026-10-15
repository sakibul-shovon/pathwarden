"""Event log in the shared event format of plan §20.1.

Every Runtime call is appended with the real ids it used, so a log can be replayed
(``api/runtime/replay.py``) into another graph. Logs live at ``state/<ws>/events.jsonl``.
"""

from __future__ import annotations

import json
from pathlib import Path


class EventLog:
    def __init__(self, path: Path | None = None) -> None:
        self.path = path
        self._events: list[dict] = []

    def append(self, event: dict) -> None:
        self._events.append(event)
        if self.path is not None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with self.path.open("a", encoding="utf-8", newline="\n") as handle:
                handle.write(json.dumps(event, sort_keys=True) + "\n")

    @property
    def events(self) -> list[dict]:
        return list(self._events)
