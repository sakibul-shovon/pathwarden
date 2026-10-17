"""The one place that talks to an LLM provider (plan §12.3; rule 13).

Everything else depends on ``Llm.complete(messages) -> str``. The real implementation goes through
LiteLLM (optional extra ``llm``, imported lazily so scripted mode and ``make test`` stay light);
tests use ``FakeLlm``. The API key lives in ``Settings`` as a ``SecretStr`` and is only handed to
LiteLLM: it is never logged, echoed or put in an error message.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Callable, Sequence

logger = logging.getLogger(__name__)

Message = dict[str, str]


class LlmError(Exception):
    """A provider call failed. The message never contains the key or any prompt text."""


class LlmNotConfiguredError(LlmError):
    """``PW_LLM_MODEL`` / ``PW_LLM_API_KEY`` are not set."""


class Llm:
    """Base class: counts calls and tokens so reports can say what a run cost."""

    model: str = "unknown"
    max_steps = 10  # tool steps one live agent may take (plan 12.3 says 6; DECISIONS A-18)

    def __init__(self) -> None:
        self.calls = 0
        self.tokens = 0

    def complete(self, messages: Sequence[Message]) -> str:  # pragma: no cover - interface
        raise NotImplementedError


class LiteLlm(Llm):
    """LiteLLM-backed completion (``PW_LLM_MODEL`` is a LiteLLM model string, ``groq/<model>``).

    Rate limits are expected on free tiers: a limited call is retried with a growing pause before
    giving up with ``LlmError``.
    """

    def __init__(
        self,
        model: str,
        api_key: str,
        temperature: float = 0.0,
        *,
        max_steps: int = 10,
        timeout: float = 45.0,
        max_tokens: int = 900,
        retries: int = 3,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        super().__init__()
        self.model = model
        self._api_key = api_key
        self._temperature = temperature
        self.max_steps = max_steps
        self._timeout = timeout
        self._max_tokens = max_tokens
        self._retries = retries
        self._sleep = sleep

    def complete(self, messages: Sequence[Message]) -> str:
        try:
            import litellm
        except ImportError:
            raise LlmError("the 'llm' extra is not installed (pip install '.[llm]')") from None
        litellm.suppress_debug_info = True
        for attempt in range(self._retries + 1):
            try:
                response = litellm.completion(
                    model=self.model,
                    messages=list(messages),
                    api_key=self._api_key,
                    temperature=self._temperature,
                    max_tokens=self._max_tokens,
                    timeout=self._timeout,
                )
            except Exception as exc:  # noqa: BLE001 - provider errors vary; never leak their text
                name = type(exc).__name__
                if "RateLimit" in name and attempt < self._retries:
                    pause = min(4.0 * 2**attempt, 30.0)
                    logger.warning("LLM rate limited (%s); retrying in %.0f s", self.model, pause)
                    self._sleep(pause)
                    continue
                raise LlmError(f"LLM call failed: {name}") from None
            self.calls += 1
            usage = getattr(response, "usage", None)
            self.tokens += int(getattr(usage, "total_tokens", 0) or 0)
            return response.choices[0].message.content or ""
        raise LlmError("LLM call failed: RateLimitError")  # pragma: no cover - loop always returns


class FakeLlm(Llm):
    """Deterministic stand-in for tests: replies come from a list or a function of the messages."""

    model = "fake/llm"

    def __init__(self, replies: Sequence[str] | Callable[[Sequence[Message]], str]) -> None:
        super().__init__()
        self._replies = replies
        self._index = 0
        self.seen: list[list[Message]] = []

    def complete(self, messages: Sequence[Message]) -> str:
        self.seen.append([dict(m) for m in messages])
        self.calls += 1
        if callable(self._replies):
            return self._replies(messages)
        if self._index >= len(self._replies):
            raise LlmError("the fake LLM ran out of replies")
        reply = self._replies[self._index]
        self._index += 1
        return reply


def build_llm(settings: object) -> Llm | None:
    """The configured LiteLLM client, or ``None`` when no model/key is set (scripted-only mode)."""
    from api.settings import Settings

    assert isinstance(settings, Settings)
    if not settings.llm_configured:
        return None
    assert settings.llm_model is not None and settings.llm_api_key is not None
    return LiteLlm(
        settings.llm_model,
        settings.llm_api_key.get_secret_value(),
        settings.llm_temperature,
        max_steps=settings.llm_max_steps,
    )
