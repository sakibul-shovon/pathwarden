"""Probe LiteLLM with the configured model (plan rule 13, docs/phases/P8-live-llm.md P8-T1).

Run it after putting PW_LLM_MODEL and PW_LLM_API_KEY in your local `.env` (or the environment):

    make probe-llm                    # one completion through LiteLLM, prints the response shape
    python scripts/probe_litellm.py --list-models   # ids of the models your key can use (Groq)

It never prints the key, the prompt of a real run or any artifact content; only names and shapes.
Exit codes: 0 ok, 1 the call failed or the answer was not the expected JSON, 2 not configured.
"""

from __future__ import annotations

import json
import sys
from importlib import metadata
from pathlib import Path

import httpx

from api.settings import Settings, load_dotenv

GROQ_MODELS = "https://api.groq.com/openai/v1/models"


def main() -> int:
    load_dotenv(Path(".env"))
    settings = Settings.from_env()
    if not settings.llm_configured:
        print("NOT CONFIGURED: set PW_LLM_MODEL (e.g. groq/<model>) and PW_LLM_API_KEY in .env")
        return 2
    assert settings.llm_model and settings.llm_api_key
    key = settings.llm_api_key.get_secret_value()

    if "--list-models" in sys.argv:
        response = httpx.get(GROQ_MODELS, headers={"Authorization": f"Bearer {key}"}, timeout=30)
        print("HTTP", response.status_code)
        if response.status_code == 200:
            for item in sorted(m["id"] for m in response.json().get("data", [])):
                print(" ", item)
        return 0 if response.status_code == 200 else 1

    import litellm

    print("litellm", metadata.version("litellm"), "| model", settings.llm_model, "| key set: yes")
    reply_shape = '{"tool": "memory_read", "args": {"key": "task:42"}}'
    response = litellm.completion(
        model=settings.llm_model,
        api_key=key,
        temperature=settings.llm_temperature,
        max_tokens=100,
        timeout=45,
        messages=[
            {"role": "system", "content": "Reply with JSON only."},
            {"role": "user", "content": f"Reply exactly with this JSON and nothing else: {reply_shape}"},
        ],
    )
    message = response.choices[0].message
    print("response type:", type(response).__name__)
    print("choice fields:", sorted(k for k in dir(response.choices[0]) if not k.startswith("_"))[:8])
    print("finish_reason:", response.choices[0].finish_reason)
    print("usage:", getattr(response.usage, "prompt_tokens", None), "+", getattr(response.usage, "completion_tokens", None))
    content = message.content or ""
    try:
        parsed = json.loads(content.strip())
    except json.JSONDecodeError:
        print("answer is NOT bare JSON; first 80 chars:", repr(content[:80]))
        return 1
    print("answer is bare JSON with keys:", sorted(parsed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
