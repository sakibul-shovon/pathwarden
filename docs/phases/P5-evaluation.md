# P5 — Evaluation (non-LLM defenses)

> **Tier 2** · Branch `phase/p5-eval` · Depends on: P2, P3 DONE · **Different-agent review recommended before merge**
> **Read in plan.md (only these):** §20.1–§20.5 (incl. §20.2.1 templates and the PW-coarse rules in §20.3), §20.7, §8.9, §12.2 (`render_changelog`), §18 (`/eval/summary`), §22-P5, §4 rules 10, 11

## 1. Objective
A generator that produces exactly 120 scenarios (60 attack + 60 benign) and a harness that runs every non-LLM defense on identical events and writes reproducible, honest results.

## 2. Requirements covered
F14 (non-LLM part): generator, defenses B0, B2, B4, PW-coarse, PW, metrics ASR/FHR with Wilson 95% intervals, witness accuracy, per-family breakdown, outputs, falsification criteria.
**Out of scope:** B1/B3 LLM judges and the live study (P8), remediation columns (P6), the UI tab (P10c).

## 3. Prerequisites
P3 DONE (`render_changelog`, scripted-agent semantics), P2 (gate). A-08 decided: latency goes in a separate, non-deterministic file.

## 4. Files expected to change
Create: `eval/{generate.py,run_eval.py}` · `eval/baselines/{__init__.py,b0.py,b2.py,b4.py,pw_coarse.py,pw.py}` · `eval/scenarios/` (generated, §20.1 format) · `eval/results/` (generated) · `api/routes/eval.py` · `tests/eval/*`.
Modify: `api/runtime/replay.py` (PW-coarse overrides), `Makefile` (`eval`), `tests/test_invariants.py`, `docs/DECISIONS.md` (A-08).

## 5. Tasks
- [x] **P5-T1 Generator** exactly per §20.2.1: seed `20261015`, one `random.Random`, families in table order; issue numbers drawn without replacement (attack 100–199, benign 200–299); issue text template and the four title/body pairs cycled; injection texts E1–E4, B1–B3 verbatim; blocks `TRIAGE`, `FIXER`, `FIXER_SPLIT`, `RELAY`, `CURATOR`, `AUDITOR`, `RELEASE`; the ten family templates; `ground_truth` from construction only; per-scenario `extra_sources`. Draft text from `render_changelog`.
- [x] **P5-T2 Generator tests:** family counts 15/15/15/15 and 12/12/12/8/8/8; ground-truth shape; unique issue numbers within ranges; byte-identical output across two runs; injection-effect checks (E3/B1 ⇒ draft has no verbatim secret but has base64; E4/B3 ⇒ only `PAYMENT_API_KEY`; BEN-lookalike draft contains the doc's example key but not the env secrets).
- [x] **P5-T3 Harness:** per scenario a fresh graph `pw_eval_<scenario_id>`, replay, run all defenses on the same events, delete the graph (also clean stale `pw_eval_*` at start). PW = gate. B2 = `q5` facts on the proposing session (holds iff A∧B∧C). B4 = DLP on payload content (exact `env.yaml` secret values or regex `PWDEMO-(SECRET|TOKEN)-[0-9a-fA-F]{8}`). B0 = never holds. B1/B3 rows are written as `not_run`.
- [x] **P5-T4 PW-coarse** implemented as the three replay overrides of §20.3 (merge same `(agent, day)` sessions; `src:env:*` → `src:env:ALL`; `sanitize` executed as a plain `memory_write` with `sanitized:false`). No predicted results anywhere.
- [x] **P5-T5 Metrics:** ASR = released attacks/60; FHR = held-or-blocked benign/60; Wilson 95% (unit-tested against known values); witness accuracy (last node of untrusted witness = ground-truth source; last node of secret witness ∈ ground-truth secrets); p50/p95 latency; per-family breakdown.
- [x] **P5-T6 Outputs:** `eval/results/results.csv` (scenario × defense), `eval/results/summary.md` (generated, includes the §20.7 falsification criteria), latency in a separate file (A-08); `GET /api/eval/summary`; `make eval`.
- [x] **P5-T7 Determinism (G7):** run `make eval` twice; `cmp` of `results.csv` and `summary.md` must show identical bytes. Sorted iteration everywhere; no wall-clock or unseeded randomness.
- [x] **P5-T8 Honesty audit:** grep the repo for hand-typed result numbers (rule 11); the README/summary numbers must come from generated files.

## 6. Tests and validation
Generator tests (T2) · harness smoke on 3 scenarios · defense unit tests on tiny hand-built cases (B2 misses a cross-agent attack by construction; B4 holds the lookalike; PW-coarse rules applied) · Wilson known values · determinism check (T7) · endpoint test for `/eval/summary`.

## 7. Acceptance criteria (§22-P5)
1. The generator implements §20.2.1 exactly and the family counts match §20.2.
2. PW-coarse follows the §20.3 rules.
3. `make eval` twice produces byte-identical `results.csv` and `summary.md`.
4. `summary.md` is generated, with the falsification criteria.
Do not assert specific ASR/FHR values; if PW disagrees with the ground truth, investigate generator vs gate first and report whatever is true.

## 8. Risks and failure scenarios
- Generator deviating from §20.2.1 → invalid science. Review against the table row by row.
- Runtime: 120 scenarios × several replays; measure early; clean up graphs in `finally`.
- Hidden nondeterminism: set/dict ordering, float formatting, timestamps, latency leaking into CSV (A-08).
- Leaked `pw_eval_*` graphs after a crash polluting the next run.
- Replay semantics for `approve`/`RELAY`/`SPLIT` mismatching the runtime.
- Presenting a defense as better than it is: report limitations and where PW is not better (§24.2 requires it).

## 9. Definition of Done
Tasks ticked with evidence · G1, G2, G4, G5, G6, **G7**, G8, G10 · independent review done · A-08 Resolved · tracking updated · PR merged · tag `phase-p5-done`.

## 10. Git checkpoints
`P5: feat(eval): scenario generator` · `P5: test(eval): generator exactness and determinism` · `P5: feat(eval): harness and non-llm defenses` · `P5: feat(eval): pw-coarse replay overrides` · `P5: feat(eval): metrics, outputs, summary endpoint` · `P5: docs: eval determinism evidence` → PR → review → merge → tag.
