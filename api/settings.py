"""Runtime configuration read from environment variables (names: .env.example).

Plain Pydantic + stdlib on purpose: ``pydantic-settings`` is not in plan §6 (rule 12).
"""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field


class Settings(BaseModel):
    falkordb_host: str = "localhost"
    falkordb_port: int = 6379
    falkordb_password: str | None = None
    auth: Literal["on", "off"] = "off"
    state_dir: Path = Path("state")
    # hosted mode (PW_AUTH=on): where the workspace keys come from (A-12). `api_keys` (the value of
    # PW_API_KEYS, "key=workspace,key2=workspace2") wins over the file; neither is ever logged.
    api_keys_file: Path | None = None
    api_keys: str | None = None
    # live LLM mode (P8): optional. The key is never shown by repr/logs and read only from the env.
    llm_model: str | None = None
    llm_api_key: str | None = Field(default=None, repr=False)
    llm_temperature: float = 0.0
    llm_tpm: int = 0  # optional tokens-per-minute budget (PW_LLM_TPM); 0 = no client-side pacing

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Settings:
        """Build settings from ``env`` (default: process environment); empty values are unset."""
        env = os.environ if env is None else env

        def get(name: str) -> str | None:
            value = env.get(name)
            return value if value not in (None, "") else None

        values: dict[str, object] = {}
        if (host := get("PW_FALKORDB_HOST")) is not None:
            values["falkordb_host"] = host
        if (port := get("PW_FALKORDB_PORT")) is not None:
            values["falkordb_port"] = int(port)
        if (password := get("PW_FALKORDB_PASSWORD")) is not None:
            values["falkordb_password"] = password
        if (auth := get("PW_AUTH")) is not None:
            values["auth"] = auth
        if (state_dir := get("PW_STATE_DIR")) is not None:
            values["state_dir"] = Path(state_dir)
        if (keys_file := get("PW_API_KEYS_FILE")) is not None:
            values["api_keys_file"] = Path(keys_file)
        if (keys := get("PW_API_KEYS")) is not None:
            values["api_keys"] = keys
        if (model := get("PW_LLM_MODEL")) is not None:
            values["llm_model"] = model
        if (llm_key := get("PW_LLM_API_KEY")) is not None:
            values["llm_api_key"] = llm_key
        if (tpm := get("PW_LLM_TPM")) is not None:
            values["llm_tpm"] = int(tpm)
        if (temperature := get("PW_LLM_TEMPERATURE")) is not None:
            values["llm_temperature"] = float(temperature)
        return cls(**values)


def load_dotenv(path: Path) -> None:
    """Load ``KEY=VALUE`` lines from ``path`` into ``os.environ``, never overriding existing values.

    Minimal on purpose: comments, blank lines, optional quotes and trailing ``# comment`` only.
    Never called by tests; the real ``.env`` is a developer-local, gitignored file.
    """
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if value[:1] in ("'", '"') and value[-1:] == value[:1] and len(value) >= 2:
            value = value[1:-1]
        else:
            value = value.split(" #", 1)[0].strip()
        os.environ.setdefault(key.strip(), value)
