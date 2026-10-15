"""PW-coarse: ablation of the v1 behaviour. The SAME gate, run on a graph replayed with the three
coarse overrides of plan §20.3 (one session per agent per day, one secret artifact for the whole
.env, no sanitizer). Its results are reported as measured, never predicted."""

from __future__ import annotations

from eval.baselines import pw

NAME = "PW-coarse"
decide = pw.decide  # the difference is in how the graph was replayed (replay(..., coarse=True))
