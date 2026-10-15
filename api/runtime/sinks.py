"""Mock external sinks: executing an allowed action appends its payload to a JSONL file.

File names replace ``:`` by ``_`` (``sink:public_release_page`` becomes
``sink_public_release_page.jsonl``)
because ``:`` is not valid in Windows file names. A sandbox runtime gets a disabled writer: sinks
are no-ops there (plan §9).
"""

from __future__ import annotations

import json
from pathlib import Path


class SinkWriter:
    def __init__(self, directory: Path | None) -> None:
        """``directory=None`` disables delivery (sandbox)."""
        self._dir = directory

    @staticmethod
    def filename(sink_id: str) -> str:
        return sink_id.replace(":", "_") + ".jsonl"

    def deliver(self, *, sink_id: str, action_id: str, payload_id: str, content: str) -> None:
        if self._dir is None:
            return
        self._dir.mkdir(parents=True, exist_ok=True)
        entry = {
            "action_id": action_id,
            "sink_id": sink_id,
            "payload_id": payload_id,
            "content": content,
        }
        with (self._dir / self.filename(sink_id)).open("a", encoding="utf-8", newline="\n") as fh:
            fh.write(json.dumps(entry, sort_keys=True) + "\n")

    def posted(self, sink_id: str) -> list[dict]:
        if self._dir is None:
            return []
        path = self._dir / self.filename(sink_id)
        if not path.is_file():
            return []
        return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
