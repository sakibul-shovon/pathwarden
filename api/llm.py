"""The one seam to a language model (plan §12.3): ``Llm.complete(messages) -> str``.

* ``LiteLlm`` talks to the provider through LiteLLM (verified by ``scripts/probe_litellm.py``;
  default model ``groq/qwen/qwen3.8-27b``). The key comes from settings only and is never
  logged or echoed.
* ``FakeLlm`` is the deterministic stand-in for tests.

Probe findings that shape this file (D-033): on Groq the gpt-oss models answered the JSON-only
prompts with their own tool-call format (a ``tool_use_failed`` BadRequest), came back empty when
``max_tokens`` was too small for their reasoning tokens, or answered ``{"done": true}`` at once;
``qwen/qwen3.8-27b`` returned the requested JSON on the first turn of all three agents, so it is
the default. A wrong key raises ``BadRequestError`` (not an authentication error) and the message
does not contain the key.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Any, Protocol

from api.settings import Settings

log = logging.getLogger("pathwarden.llm")

DEFAULT_MODEL = "groq/qwen/qwen3.8-27b"
MAX_TOKENS = 2048
RETRIES = 8  # a free tier answers 429 for tens of seconds: wait it out, never silently give up
MAX_WAIT_S = 60.0


class LlmError(Exception):
    """The model could not be called (after retries). The message never contains the key."""


class LlmNotConfiguredError(Exception):
    """Live mode or LLM judging was requested without ``PW_LLM_API_KEY``."""


@dataclass
class LlmStats:
    calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0

    def as_dict(self) -> dict[str, int]:
        return {
            "calls": self.calls,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
        }


class Llm(Protocol):
    model: str
    stats: LlmStats

    def complete(self, messages: list[dict[str, str]]) -> str: ...


class LiteLlm:
    def __init__(self, settings: Settings) -> None:
        if not settings.llm_api_key:
            raise LlmNotConfiguredError("PW_LLM_API_KEY is not set")
        self._key = settings.llm_api_key
        self.model = settings.llm_model or DEFAULT_MODEL
        self.temperature = settings.llm_temperature
        # gpt-oss models need reasoning room, but they also answer JSON-only prompts with the
        # provider's own tool-call format (Groq rejects that): see D-033, the default is qwen
        self._extra = {"reasoning_effort": "medium"} if "gpt-oss" in self.model else {}
        self.stats = LlmStats()
        self._tpm = settings.llm_tpm
        self._window: list[tuple[float, int]] = []  # (time, tokens) of recent calls

    def _pace(self, messages: list[dict[str, str]]) -> None:
        """Stay under a tokens-per-minute budget instead of burning retries on 429s."""
        if not self._tpm:
            return
        estimate = sum(len(m["content"]) for m in messages) // 3 + 300
        while True:
            now = time.monotonic()
            self._window = [(t, n) for t, n in self._window if now - t < 60]
            if sum(n for _, n in self._window) + estimate <= self._tpm or not self._window:
                return
            time.sleep(max(1.0, 60 - (now - self._window[0][0])))

    def complete(self, messages: list[dict[str, str]]) -> str:
        import litellm

        litellm.suppress_debug_info = True
        last = ""
        self._pace(messages)
        for attempt in range(RETRIES):
            try:
                response = litellm.completion(
                    model=self.model,
                    api_key=self._key,
                    temperature=self.temperature,
                    max_tokens=MAX_TOKENS,
                    **self._extra,
                    messages=messages,
                )
            except Exception as exc:  # noqa: BLE001 - provider errors vary; keep type, drop text
                last = type(exc).__name__
                retryable = last in {
                    "RateLimitError",
                    "ServiceUnavailableError",
                    "Timeout",
                    "APIConnectionError",
                    "InternalServerError",
                }
                log.warning("llm call failed (%s), attempt %d", last, attempt + 1)
                if not retryable or attempt == RETRIES - 1:
                    break
                time.sleep(min(4.0 * 2**attempt, MAX_WAIT_S))
                continue
            usage = response.usage
            self._window.append(
                (
                    time.monotonic(),
                    int(usage.prompt_tokens or 0) + int(usage.completion_tokens or 0),
                )
            )
            self.stats.calls += 1
            self.stats.prompt_tokens += int(getattr(usage, "prompt_tokens", 0) or 0)
            self.stats.completion_tokens += int(getattr(usage, "completion_tokens", 0) or 0)
            return response.choices[0].message.content or ""
        raise LlmError(f"the language model call failed ({last})")


@dataclass
class FakeLlm:
    """Deterministic test double: replies from a list (in order) or a function of the messages."""

    replies: Sequence[str] | Callable[[list[dict[str, str]]], str]
    model: str = "fake-model"
    stats: LlmStats = field(default_factory=LlmStats)
    calls: list[list[dict[str, str]]] = field(default_factory=list)
    _next: int = 0

    def complete(self, messages: list[dict[str, str]]) -> str:
        self.calls.append([dict(m) for m in messages])
        self.stats.calls += 1
        if callable(self.replies):
            return self.replies(messages)
        if self._next >= len(self.replies):
            raise LlmError("the fake model has no more replies")
        reply = self.replies[self._next]
        self._next += 1
        return reply


def make_llm(settings: Settings) -> Llm | None:
    """The configured model, or ``None`` when there is no key (scripted mode needs none)."""
    return LiteLlm(settings) if settings.llm_api_key else None


def parse_json_reply(text: str) -> Any:
    """Parse a model reply that should be JSON only. A single ```json fence is tolerated."""
    import json

    body = text.strip()
    if body.startswith("```"):
        body = body.split("\n", 1)[1] if "\n" in body else ""
        body = body.rsplit("```", 1)[0]
    return json.loads(body.strip())
