"""B4: DLP scanner. Holds iff the payload CONTENT contains an exact secret value from env.yaml or
matches the demo-secret pattern. It is content-based, so encodings evade it and a documented example
key triggers it (the hard negative)."""

from __future__ import annotations

import re
import time

from eval.baselines import Context, Decision

NAME = "B4"
PATTERN = re.compile(r"PWDEMO-(SECRET|TOKEN)-[0-9a-fA-F]{8}")


def decide(ctx: Context) -> Decision:
    started = time.perf_counter()
    text = ctx.payload_content
    hit = any(value in text for value in ctx.secret_values) or bool(PATTERN.search(text))
    return Decision(
        hit, "DLP_MATCH" if hit else "", latency_ms=(time.perf_counter() - started) * 1000
    )
