"""P8 probe (plan rule 13): LiteLLM and the Groq model as they behave NOW, before any agent code.

Needs a real key in the environment or in ``.env`` (``PW_LLM_API_KEY``); the key is never printed.
Checks, with ``PW_LLM_MODEL`` (default ``groq/openai/gpt-oss-120b``):
  1. one plain completion: the response shape (``choices[0].message.content``, ``usage``),
  2. a JSON-only reply to a system prompt of the kind the live agents use,
  3. temperature 0 is accepted,
  4. a wrong key raises a catchable exception (and never echoes the key),
  5. what the provider says about rate limits (headers), so the live study can be sized honestly.
Run: ``python scripts/probe_litellm.py``. Exit code 0 only if every check passes.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.settings import load_dotenv  # noqa: E402

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")


def main() -> int:
    load_dotenv(Path(".env"))
    key = os.environ.get("PW_LLM_API_KEY", "")
    model = os.environ.get("PW_LLM_MODEL") or "groq/openai/gpt-oss-120b"
    if not key:
        print("no PW_LLM_API_KEY: nothing to probe (this is the only key-dependent script)")
        return 2
    import litellm

    litellm.suppress_debug_info = True
    check("litellm imports", True, f"litellm {getattr(litellm, '__version__', 'installed')}")

    started = time.perf_counter()
    response = litellm.completion(
        model=model,
        api_key=key,
        temperature=0,
        max_tokens=64,
        messages=[{"role": "user", "content": "Reply with the single word: pong"}],
    )
    elapsed = time.perf_counter() - started
    text = response.choices[0].message.content
    usage = response.usage
    check(
        "a plain completion returns text in choices[0].message.content",
        isinstance(text, str) and "pong" in text.lower(),
        f"{elapsed:.2f}s, text={text!r}",
    )
    check(
        "usage carries token counts",
        usage.prompt_tokens > 0 and usage.completion_tokens > 0,
        f"prompt={usage.prompt_tokens} completion={usage.completion_tokens}",
    )
    check("the response names the model", bool(response.model), str(response.model))

    system = (
        "You are Triage, a maintainer bot. Reply with JSON only: "
        '{"tool": "<name>", "args": {...}} or {"done": true}. Tools: fetch_issue {"number": int}'
    )
    reply = litellm.completion(
        model=model,
        api_key=key,
        temperature=0,
        max_tokens=1024,
        reasoning_effort="low",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": "Start."},
        ],
    )
    raw = reply.choices[0].message.content or ""
    try:
        parsed = json.loads(raw.strip())
        shape_ok = isinstance(parsed, dict) and ("tool" in parsed or "done" in parsed)
    except ValueError:
        parsed, shape_ok = None, False
    check("a JSON-only system prompt is answered with parseable JSON", shape_ok, repr(raw)[:100])

    try:
        litellm.completion(
            model=model,
            api_key="gsk_" + "x" * 52,
            max_tokens=5,
            messages=[{"role": "user", "content": "hi"}],
        )
        check("a wrong key is rejected", False, "no exception")
    except Exception as exc:  # noqa: BLE001 - the probe records whatever type it is
        message = str(exc)
        check(
            "a wrong key raises a catchable exception that does not echo the key",
            "x" * 52 not in message and key not in message,
            type(exc).__name__,
        )

    raw_response = litellm.completion(
        model=model,
        api_key=key,
        max_tokens=5,
        messages=[{"role": "user", "content": "hi"}],
    )
    headers = getattr(raw_response, "_hidden_params", {}).get("additional_headers", {}) or {}
    limits = {k: v for k, v in headers.items() if "ratelimit" in k.lower()}
    check("rate-limit headers (informational)", True, json.dumps(limits) if limits else "none seen")

    failed = [name for name, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)} PASS, {len(failed)} FAIL")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
