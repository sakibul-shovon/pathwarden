# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 ~04:30 (+06) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p6-remediation` (from `main` = `cf95f5a`, P5 merged, tag `phase-p5-done`). After this handoff is committed the agent merges P6 (D-016): then `main` carries tag `phase-p6-done`. Verify with `git log --oneline -8`, `git tag -l 'phase-*'`, `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014).

## Where the project stands
- **P0-P5 and P10a DONE. P6 VERIFYING → merged next.** Next (recommended order, D-009): **P7 — Time travel** (`docs/phases/P7-time-travel.md`; needs the human's OK for A-09, already approved in 'approve all'), then P10b, P10c, P8, P9, P11, P12.
- Remediation: `GET/POST /api/remediation/{topology}…` (enterprise12, tinyqueue3); `make eval` also reports best-candidate vs brute-force optimum. The full story: attack held → `POST /forensics/{id}` (quarantine + sandbox ALLOW) → `POST /heal/{id}/approve` (clean release, original superseded) → `GET /memory`, `POST /quarantine/{qid}/release`.
- **Needs the human's review (the only two deviations from plan §10):** **D-017** (`q2c` treats sanitized artifacts as the quarantine boundary; the plan's queries taken literally make the heal flow impossible) and **D-018** (two capability-graph seed queries the plan never wrote). Both are tested, small and easy to revert (`docs/DECISIONS.md` Part B5 / B8).
- Environment: Python 3.11.9 in `.venv`; GNU Make 4.4.1 is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop running; containers `pathwarden-falkordb-1`, `pathwarden-api-1` up (rebuild the API image with `make up` after code changes — the container still runs the P3 code until then).

## Verification so far (real results, 2026-10-16)
- `make test` 164 passed · `make lint` clean · `make probe` 36/36 · `make demo` ok · plan.md unchanged · 4 sabotage checks for P4 (0 missed). Details in the Evidence log.
- **CI never observed** (private repo, no `gh`): gate G10 "not verified". No independent reviewer (G-001) — which is exactly why D-017 should be looked at by a human.

## Traps and findings a newcomer must know
- **Plan queries can be mutually inconsistent** (q2c vs q4/q2a/rule 7). Run the whole story, do not only test queries one by one. See D-017.
- Aggregate-return trap (`RETURN count(...)` returns a row even if `MATCH` found nothing): handled for q1_write, q4c, q4d.
- The sandbox graph is a copy; `?graph=sandbox` serves both copied and sandbox-namespaced ids. Main never serves `-sbx-` ids.
- `plan.md` §6: `db.list()` does not exist, use `db.list_graphs()`. Never run `ruff` on the repo root (D-015).
- Scenario runs reset the workspace by default (`"reset": true`); witness ties between equal-distance secrets are possible.
- Unauthenticated approve/reject/reset/run/heal/quarantine-release until P11 (G-002). LLM forensic mode returns 501 until P8 (G-003).
- Sabotage lesson: a mutation can be an *equivalent mutant* for property tests; pin definitions separately. Also check that a crafted case exercises rarely-taken branches.
- Tool-call hygiene: pass long Python or quoted text to Bash via files (heredocs containing `'''` broke the shell twice).

## Blocked / questions for the human
1. **Please confirm or reject D-017** (the only deviation from plan §10 so far). Work continues meanwhile; reverting later is a one-file change.
2. Still open: Groq model + key + license (A-14, P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
Start **P7** on `phase/p7-timetravel` from the merged `main`: read `docs/phases/P7-time-travel.md` and plan §14, §10 (q6b, q7, q7b, q8), §12.4 (attack_sleeper_44), §18 (timeline/max, graph-at); first task P7-T1 (queries q7 and q7b verbatim; q7b already exists since P3).
