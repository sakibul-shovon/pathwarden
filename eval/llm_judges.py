"""Run the LLM judges B1 and B3 over the 120 evaluation scenarios (plan §20.3, P8).

``python -m eval.llm_judges`` (``make eval-live`` runs it, then the live study): needs a key
(``PW_LLM_API_KEY`` in the environment or ``.env``). It spends tokens: ``--limit N`` runs only the
first N scenarios, ``--only B1`` / ``--only B3`` one judge. The run is RESUMABLE: every answer is
appended to ``eval/results/llm_judges.csv`` the moment it arrives and already-answered
(scenario, judge) pairs are skipped, so a rate-limit stop loses nothing.

``make eval`` does not call a model. It reads this file as an input: with a complete file the B1/B3
columns are filled (byte-identical on every run), without it they stay ``not_run``.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

from api.llm import LlmError, make_llm
from api.settings import Settings, load_dotenv
from eval import generate
from eval.baselines import b1, b3

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "eval" / "results"
CSV_PATH = RESULTS / "llm_judges.csv"
META_PATH = RESULTS / "llm_judges_meta.json"
FIELDS = ["scenario_id", "defense", "decision", "invalid", "reason"]
JUDGES = {"B1": b1, "B3": b3}


def load_decisions(path: Path | None = None) -> dict[tuple[str, str], dict[str, str]]:
    """(scenario_id, defense) -> row; empty when the file does not exist."""
    path = path or CSV_PATH
    if not path.is_file():
        return {}
    with path.open(encoding="utf-8", newline="") as handle:
        return {(r["scenario_id"], r["defense"]): r for r in csv.DictReader(handle)}


def load_meta(path: Path | None = None) -> dict | None:
    path = path or META_PATH
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="only the first N scenarios")
    parser.add_argument("--only", choices=sorted(JUDGES), default=None)
    parser.add_argument("--pace", type=float, default=0.0, help="seconds to wait between calls")
    args = parser.parse_args(argv)

    load_dotenv(ROOT / ".env")
    llm = make_llm(Settings.from_env())
    if llm is None:
        print("no PW_LLM_API_KEY: the LLM judges stay not_run", file=sys.stderr)
        return 2

    scenarios = generate.generate()
    if args.limit:
        scenarios = scenarios[: args.limit]
    done = load_decisions()
    RESULTS.mkdir(parents=True, exist_ok=True)
    new_file = not CSV_PATH.is_file()
    asked = 0
    with CSV_PATH.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS, lineterminator="\n")
        if new_file:
            writer.writeheader()
        for scenario in scenarios:
            for name, judge in JUDGES.items():
                if args.only and name != args.only:
                    continue
                if (scenario["scenario_id"], name) in done:
                    continue
                try:
                    verdict = judge.decide(llm, scenario)
                except LlmError as err:
                    print(f"stopped at {scenario['scenario_id']} {name}: {err}", file=sys.stderr)
                    _write_meta(llm, done)
                    return 1
                writer.writerow(
                    {
                        "scenario_id": scenario["scenario_id"],
                        "defense": name,
                        "decision": "HOLD" if verdict.hold else "ALLOW",
                        "invalid": str(verdict.invalid).lower(),
                        "reason": verdict.reason,
                    }
                )
                handle.flush()
                asked += 1
                if asked % 10 == 0:
                    print(f"{asked} judgements so far ({llm.stats.calls} calls)", flush=True)
                if args.pace:
                    time.sleep(args.pace)
    _write_meta(llm, done)
    print(f"done: {asked} new judgements with {llm.model}")
    return 0


def _write_meta(llm, previous: dict) -> None:
    """Model name, cumulative token use and the invalid-answer counts per judge."""
    rows = load_decisions()
    old = load_meta() or {}
    meta = {
        "model": llm.model,
        "temperature": getattr(llm, "temperature", 0),
        "judgements": {name: sum(1 for (_, d) in rows if d == name) for name in JUDGES},
        "invalid_json": {
            name: sum(1 for (_, d), r in rows.items() if d == name and r["invalid"] == "true")
            for name in JUDGES
        },
        "calls": old.get("calls", 0) + llm.stats.calls,
        "prompt_tokens": old.get("prompt_tokens", 0) + llm.stats.prompt_tokens,
        "completion_tokens": old.get("completion_tokens", 0) + llm.stats.completion_tokens,
    }
    META_PATH.write_text(
        json.dumps(meta, indent=2, sort_keys=True) + "\n", encoding="utf-8", newline="\n"
    )


if __name__ == "__main__":
    sys.exit(main())
