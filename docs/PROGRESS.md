# Progress

**The one place to see where the project stands.** Update rules: `docs/WORKFLOW.md` §4. Status words: `NOT_STARTED` · `IN_PROGRESS` · `VERIFYING` · `DONE` · `BLOCKED`.
Details of *how to resume* live in `docs/HANDOFF.md`; task checkboxes live in `docs/phases/P*.md`.

- **Last updated:** 2026-10-15 (blueprint preparation) · **by:** Claude Code (Sonnet 5.5)
- **Overall:** workflow approved; P0 merged and tagged; P1 (runtime) implemented and verified locally; CI runs on GitHub are not observable from here (private repo, no `gh`).
- **Active phase:** P5 (VERIFYING); P0-P4 and P10a DONE
- **Deadline:** submit before **18 Oct 2026 23:59 IST = 19 Oct 00:29 Bangladesh time (+06)**. Repo must be public with incremental commits after 15 Oct 12:01 AM IST (plan §24.6).

## Phase dashboard

| Phase | Name | Tier | Status | Branch | Needs | Last evidence | Notes |
|---|---|---|---|---|---|---|---|
| P0 | Probe and skeleton | 1 | DONE | `phase/p0-skeleton` | — | probe 35/35, 14 tests; merged `3632e9c`, tag `phase-p0-done` | exceptions: CI run not observed (repo private, no gh); T11 GitHub settings deferred until the repo is public (D-014) |
| P1 | Graph layer, runtime, replay | 1 | DONE | `phase/p1-runtime` | — | 69 tests, lint clean; merged `4610b64`, tag `phase-p1-done` | A-01, A-02 resolved; CI not observed |
| P2 | Gate | 1 | DONE | `phase/p2-gate` | - | 86 tests, 4 sabotage checks; merged `bce8e9b`, tag `phase-p2-done` | no independent review (G-001); CI not observed |
| P3 | Scripted agents, demo scenarios, core API | 1 | DONE | `phase/p3-scripted-api` | - | 143 tests, make demo 6/6; merged `46adba1`, tag `phase-p3-done` | CI not observed |
| P4 | Forensic Agent, quarantine, healing, memory API | 1 | DONE | `phase/p4-forensics` | - | 165 tests, probe 36/36, 4 sabotage checks; merged `e6f2588`, tag `phase-p4-done` | **D-017 awaiting human review**; no independent review; CI not observed |
| P10a | UI: scaffold, Run, Investigate | 1 | DONE | `phase/p10a-ui-run-investigate` | - | strict tsc build, verified in headless Edge; merged `0f8de3b`, tag `phase-p10a-done` | CI not observed; no human click-through |
| P5 | Evaluation (non-LLM defenses) | 2 | VERIFYING | `phase/p5-eval` | P2, P3 | 190 tests; `make eval` twice byte-identical; 6 sabotage checks | results reported as measured |
| P6 | Remediation (max-flow) | 2 | NOT_STARTED | `phase/p6-remediation` | P0 only | — | can run in a worktree beside P1–P5 |
| P7 | Time travel | 2 | NOT_STARTED | `phase/p7-timetravel` | P3 | — | needs A-09 decision |
| P10b | UI: Memory, Time travel | 2 | NOT_STARTED | `phase/p10b-ui-memory-time` | P4, P7, P10a | — | |
| P10c | UI: Remediate, Evaluation, full demo | 2 | NOT_STARTED | `phase/p10c-ui-remediate-eval` | P5, P6, P10a | — | |
| P8 | Live LLM mode | 3 | NOT_STARTED | `phase/p8-live-llm` | P4, P5, Groq model + key (A-14) | — | |
| P9 | MCP tool server and gateway | 3 | NOT_STARTED | `phase/p9-mcp` | P3, P4; P8 for the live demo | — | probe first |
| P11 | Multi-tenancy and hardening | 3 | NOT_STARTED | `phase/p11-hardening` | P3, P4, P6, P9 | — | needs A-07 decision |
| P12 | Ship | 1 | NOT_STARTED | `phase/p12-ship` | everything that will ship | — | start by the freeze time below |

Tier 1 = submission-critical · Tier 2 = differentiators shown in the video · Tier 3 = depth. Nothing is removed from scope; cuts are a human decision (D-010).

## Suggested checkpoints — ASSUMPTION, adjust freely (times are +06; ~78 h of wall-clock remained at 2026-10-15 18:15)

| By | Target |
|---|---|
| 15 Oct night | setup approved, P0 and P1 DONE |
| 16 Oct evening | P2, P3, P4 DONE (the core story works via API) |
| 17 Oct morning | P10a DONE → Tier 1 demo is clickable |
| 17 Oct night | P5, P6, P7, P10b, P10c DONE |
| 18 Oct 12:00 | **feature freeze**: P8, P9, P11 DONE or consciously cut (D-010); P12 starts |
| 18 Oct 20:00 | submission made (≈ 4.5 h buffer before the deadline) |

## Evidence log (append-only; newest at the bottom)

| date-time | task | command | exit | result (real counts) | agent |
|---|---|---|---|---|---|
| 2026-10-15 18:5x | P0-T1 | `git ls-remote https://github.com/sakibul-shovon/pathwarden.git` | 0 | no refs: remote reachable and empty | Claude Code |
| 2026-10-15 18:5x | P0-T1 | `sh scripts/scan_secrets.sh` on the staged root commit; negative tests with runtime-built `ghp_…`/`gsk_…` strings and a `.env` in a subfolder | 0 / refused | clean index passes; leaks and `.env` refused; index restored (no leftovers) | Claude Code |
| 2026-10-15 18:5x | P0-T1 | `sh .githooks/commit-msg <file>` ×7 | — | accepts `P0: chore: …`, `P10a: fix(web): …`, `P3: feat(api): …`, `Merge …`; rejects `fix stuff`, `P13: …`, `P2: wip: …` | Claude Code |
| 2026-10-15 18:5x | P0-T1 | `sh .githooks/pre-commit` on `main` after root commit; `.githooks/pre-push` with crafted ref lines ×5 | 1 / 1,0,0,1,1 | commit on main refused; push to main refused, allowed with human override; new branch ok; delete refused; rewritten remote refused | Claude Code |
| 2026-10-15 18:5x | P0-T1 | root commit `38cf308` then `PW_ALLOW_MAIN=1 git push -u origin main` (human asked for the push) | 0 | `git ls-remote origin refs/heads/main` = local HEAD `38cf308…`; author Shovon, no trailer | Claude Code |
| 2026-10-15 | P0-T2 | `py -3.11 -m venv .venv`; `python --version` | 0 | Python 3.11.9 (installed via winget `Python.Python.3.11`) | Claude Code |
| 2026-10-15 | P0-T5 | `make up`; `docker compose ps` | 0 | FalkorDB up on 6379/3000 from the digest-pinned image | Claude Code |
| 2026-10-15 | P0-T7 | `make probe` (first run, `:latest` image) and again on the pinned digest | 0 | **35 passed, 0 NOTE, 0 FAILED** both times | Claude Code |
| 2026-10-15 | P0-T7 | programmatic diff of plan §10 vs probe; sabotaged copy of the probe | — | 43/43 plan Cypher blocks present verbatim; sabotage → exactly A07, A12, B05 FAIL (32 passed, 3 failed) | Claude Code |
| 2026-10-15 | P0-T6/T9 | `make test` | 0 | **14 passed** (health ×2 incl. real DB, settings ×5, invariants ×7) | Claude Code |
| 2026-10-15 | P0-T3/T9 | `make lint` and `make fmt` | 0 | ruff: All checks passed, 10 files already formatted; `plan.md` unchanged afterwards | Claude Code |
| 2026-10-15 | P0-T6 | `uvicorn api.main:create_app --factory --port 8000` + `curl /api/health` | 0 | `{"falkordb":"ok","graphs":[]}` | Claude Code |
| 2026-10-15 | P0-T10 | clean venv (py 3.11) `pip install -c constraints.txt -e ".[dev]"`, then `make test` / `make lint` with it | 0 | 14 passed; lint clean — equivalent to the CI steps (CI itself not yet run) | Claude Code |
| 2026-10-15 | P1-T10 | `make test` | 0 | **69 passed** (14 from P0 + 55 new: lineage, fail-closed, id/clock restart, sandbox namespace, registry, schema, fixtures/queries verbatim, replay incl. export→replay round trip); run twice, identical | Claude Code |
| 2026-10-15 | P1-T7 | first `make test` of P1 | 1 | 2 failed: (a) test used tool `memory_list`, which is not in registry.yaml (test bug); (b) **real bug**: `runtime.write` on a nonexistent session returned an id for an artifact that was never created, because `q1_write` ends in `count()` and returns `[[0]]` even when its MATCH found nothing (plan §9's `derived_edges == len(context)` check cannot see it). Fixed by verifying the artifact with `q1_get_artifact` | Claude Code |
| 2026-10-15 | P1-T5/T7 | sabotage checks on a backup of runtime.py, restored byte-identical each time | — | exact-namespace regex broken → `test_a_sandbox_runtime_creates_only_namespaced_ids` FAILS; write-existence check removed → `test_unknown_agent_session_source_and_payload_fail_closed` FAILS. (A first sabotage attempt whose `sed` did not match was discarded, not counted.) | Claude Code |
| 2026-10-15 | P1-T1/T2 | `tests/test_fixtures_and_queries.py` | 0 | 9 fixtures and all 22 query files are verbatim copies of plan.md blocks and equal to the queries the probe verified | Claude Code |
| 2026-10-15 | P1-T10 | `make lint` / `make fmt` | 0 | all checks passed, 23 files formatted; plan.md unchanged | Claude Code |
| 2026-10-15 | P2-T5/T6 | `make test` | 0 | **86 passed** (15 gate tests: attack→HOLD/TRIFECTA with witness endpoints `src:issue:42` / `src:env:PAYMENT_API_KEY`; no convention→ALLOW CLEAN; sanitized-only→no untrusted witness; approved→ALLOW; internal sink→CLEAN; strict→BLOCK; quarantined ancestor/payload→BLOCK; missing payload/sink→HOLD MISSING_PROVENANCE; unknown action→raises; DB error→raises, status untouched, nothing logged; content-agnostic over 6 awkward content sets; verdict log fields; hop bound = policy) | Claude Code |
| 2026-10-15 | P2-T8 | sabotage S1-S3 on backed-up query files (restored byte-identical) | — | S1 q2a ignores `sanitized` → 2 tests FAIL; S2 q2b ignores `approved` → approval test FAILS; S3 q2a ignores `approved` → approval test FAILS | Claude Code |
| 2026-10-15 | P2-T8 | sabotage S4: q2b wrongly excludes sanitized nodes (rule 7) | — | **first run: NOT caught (14 passed)** → test gap. Added `test_sanitizing_a_secret_does_not_declassify_it` (secret reaches the draft only via a sanitized artifact). Re-run: S4 now FAILS that test; files restored byte-identical; suite 86 passed | Claude Code |
| 2026-10-15 | P2-T6 | `tests/test_invariants.py` additions | 0 | no `.content` in any q2*–q8* query; gate.py imports no LLM client and never reads `.content`; every query file is referenced from code (strengthened after the gate passed names through a helper) | Claude Code |
| 2026-10-15 | P3-T10 | `make test` (twice) | 0 | **143 passed** both times (57 new: render, schema/extractor/env-key rules, agent behaviours, 31 API tests incl. all 6 scenarios with guard on, 3 attacks with guard off, green badges, explain/approve/reject, error shapes, gate failure -> 500 and nothing posted, restart continuity, export->replay round trip, determinism of every RunResult) | Claude Code |
| 2026-10-15 | P3-T9 | `make demo` | 0 | 6/6 scenarios ok with the guard on; the 3 attacks show LEAKED with the guard off | Claude Code |
| 2026-10-15 | P3-T9 | `make up` (builds the api image); `curl /api/health`; POST attack_pipeline_42 against the CONTAINER | 0 | falkordb ok; action held/TRIFECTA, all three badges green | Claude Code |
| 2026-10-15 | P3 | sabotage S1: orchestrator executes on HOLD | - | 10 API tests FAIL | Claude Code |
| 2026-10-15 | P3 | sabotage S2: Fixer ignores team conventions (first attempt's mutation did not apply and was discarded) | - | 12+ tests FAIL; files restored byte-identical; suite 143 passed | Claude Code |
| 2026-10-15 | P4-T8 | `make test` | 0 | **164 passed** (21 new forensics/heal/quarantine/memory tests + 2 gate tests for D-017): report content, quarantine reach keeps task:42, sleeper + disguise healed, sandbox ids `-sbx-` and no fallback between graphs, main untouched by replay, idempotent re-run, heal executes a clean release and supersedes, ids continue and never collide, heal without forensics is held again, quarantine release, llm mode 501, no `content` key in any tool output | Claude Code |
| 2026-10-15 | P4 | `make probe` | 0 | **36 passed** (new B14 proves the q2c deviation: plan q2c blocks a quarantined root behind a sanitized task; the deviation does not, but still blocks a quarantined non-sanitized ancestor and a quarantined sanitized artifact) | Claude Code |
| 2026-10-15 | P4 | smoke of the whole story (`PYTHONPATH=. python p4_smoke.py`): **first run exposed the plan's q2c/q4 inconsistency** (healed draft BLOCKED/QUARANTINED_LINEAGE although clean) | - | after the D-017 fix: attack HOLD -> forensics APPROVE_HEALED_RELEASE (sandbox ALLOW/CLEAN, healed content clean) -> heal: act-0002 executed, act-0001 superseded, public page got only the clean release | Claude Code |
| 2026-10-15 | P4-T7 | sabotage S1-S4 (backed-up files restored byte-identical; suite 164 passed) | - | S1 q4 also quarantines sanitized descendants -> 10 FAIL; S2 q4 reaches only direct descendants -> 2 FAIL; S3 q2c back to the plan text -> 5 FAIL; S4 apply_quarantine not idempotent -> 1 FAIL; 0 mutations missed | Claude Code |
| 2026-10-16 | P10a-T1 | `cd web && npm run build` | 0 | `tsc --noEmit` (strict, TypeScript 7.0.2) and `vite build` (Vite 8.3.4, React 18.3, cytoscape 3.34.3) pass: 22 modules, 596 kB JS (cytoscape) / 6 kB CSS | Claude Code |
| 2026-10-16 | P10a-T7 | headless Edge against the real API (dev server + container): Run tab, attack, guard ON | 0 | banner `HELD act-0001: TRIFECTA`; 3 badges `Rule of Two OK`, 0 violated; public page 'Nothing has been posted'; 0 error markers in the DOM | Claude Code |
| 2026-10-16 | P10a-T7 | same, guard OFF | 0 | banner `LEAKED`; the fake secret rendered on the public page; 3 highlighted leak lines | Claude Code |
| 2026-10-16 | P10a-T7 | benign_43 | 0 | banner `POSTED` (green) | Claude Code |
| 2026-10-16 | P10a-T7 | Investigate with `?autoforensics=1` + screenshot (`docs/img/investigate-attack.png`) | 0 | verdict card (decision 2 ms, LLM calls 0), lineage graph with untrusted witness (orange, thick, via the convention) and secret witness (dotted), `task:42` dashed, quarantined nodes grey, sources as diamonds; laundering table; report `APPROVE_HEALED_RELEASE`; held-vs-healed diff; Approve button. **Screenshot exposed a defect** (witness paths vanished after quarantine because the verdict became BLOCK): fixed (`explain` returns witnesses independent of quarantine) + test; re-shot, highlights present | Claude Code |
| 2026-10-16 | P10a-T7 | `?autoforensics=1&autoheal=1` (the full browser flow) | 0 | banner `Healed release act-0002 executed; act-0001 is superseded`; API: act-0001 superseded, act-0002 executed; public page has 1 entry and no secret | Claude Code |
| 2026-10-16 | P10a-T6 | page inside a 400 px iframe (Edge enforces a minimum window width, so a plain 420 px window crops) | 0 | no horizontal overflow; tabs wrap; cards stack | Claude Code |
| 2026-10-16 | P5-T6 | `make eval` (full: 120 scenarios x 7 defenses, ~20 s) | 0 | writes results.csv (840 rows), summary.json, summary.md; no `pw_eval_*` graph left behind | Claude Code |
| 2026-10-16 | P5-T7 | G7: second full `make eval`, `cmp` of results.csv / summary.json / summary.md against the first | 0 | all three byte-identical; zero CR bytes (checked by reading bytes) | Claude Code |
| 2026-10-16 | P5-T2 | `tests/test_eval.py` | 0 | 25 tests: family counts (15/15/15/15, 12/12/12/8/8/8), ground truth, issue pools 100-199 / 200-299 without replacement, determinism and sync with the committed scenario files, injection effects E1-E4/B1-B3, split/relay/curator structure, coarse-replay rules, defenses on hand-picked scenarios, byte-identical outputs, Wilson known values, derived-not-typed B0/B2/B4 numbers, endpoint; suite 190 passed | Claude Code |
| 2026-10-16 | P5-T8 | sabotage S1-S6 (files restored byte-identical): coarse session merging off; DLP regex wrong; relay length i%3; Wilson formula; PW counts only BLOCK; coarse env override off | - | all 6 CAUGHT, 0 missed | Claude Code |
| 2026-10-16 | P5-T5 | measured results (not predicted; see `eval/results/summary.md`) | - | B0 ASR 100% FHR 0%; B2 100% / 0%; B4 16.7% / 40.0%; PW-coarse 0% / 73.3%; **PW 0% / 0%**, witness accuracy 60/60; B1/B3 not_run. Cross-checks: B4's 10 missed attacks = 4 base64 disguise + 6 base64 sleepers (counted from the scenarios); B4's 24 false holds = 8 lookalike + 8 approved + 8 internal-sink | Claude Code |

## Known issues (bugs and debt found but not fixed)

| id | found in | description | impact | file(s) | owner phase |
|---|---|---|---|---|---|
| | | | | | |

## Known gaps (stubs and intentionally unfinished items — must fail loudly)

| id | what | where | how it fails | filled in |
|---|---|---|---|---|
| G-001 | Independent cross-agent review of P2 (recommended by the phase file) was not possible: only one agent is available | P2 | n/a — process gap; the 4 sabotage checks partly compensate | when a second agent reviews (optional) |
| G-002 | No caller authentication on approve/reject/reset/run, heal-approve and quarantine release | api layer | by design until P11 (human-only endpoints) | P11 |
| G-003 | LLM forensic mode (`mode:"llm"`) answers 501 `llm_not_configured` | `POST /forensics` | fails loudly | P8 |

## Session log (append-only: one line per work session)

| date-time (+06) | tool / model | phase / tasks | outcome | HEAD at stop |
|---|---|---|---|---|
| 2026-10-15 18:15–… | Claude Code / Sonnet 5.5 | setup | read plan.md; wrote workflow blueprint (no application code) | no git repo yet |
| 2026-10-15 19:0x | Claude Code / Sonnet 5.5 | P0-T1…T10 | approvals recorded; root commit pushed to `main`; Python 3.11 + make installed; P0 skeleton, probe (35/35), tests, lint, image pinned; **incident:** `make fmt` rewrote plan.md code blocks → restored, fixed (D-015) | see HANDOFF |
| 2026-10-15 (earlier) | Claude Code / Sonnet 5.5 | setup | applied human answers: ruff approved, push allowed without agent names (D-005/D-013), repo private (D-014), provider Groq, cut line confirmed; verified winget ids and the Claude Code `attribution` setting | no git repo yet |
