# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 ~02:00 (+06) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p10a-ui-run-investigate` (from `main` = `e6f2588`, P4 merged, tag `phase-p4-done`). After this handoff is committed the agent merges P10a (D-016): then `main` carries tag `phase-p10a-done`. Verify with `git log --oneline -8`, `git tag -l 'phase-*'`, `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014).

## Where the project stands
- **P0-P4 DONE. P10a VERIFYING → merged next.** Tier 1 is now complete except P12. Next (recommended order, D-009): **P5 — Evaluation (non-LLM defenses)** (`docs/phases/P5-evaluation.md`), then P6, P7, P10b, P10c, P8, P9, P11, P12.
- The full story works in a real browser (`make up`, `make web`, open http://localhost:5173): attack held → `POST /forensics/{id}` (quarantine + sandbox ALLOW) → `POST /heal/{id}/approve` (clean release, original superseded) → `GET /memory`, `POST /quarantine/{qid}/release`.
- **Needs the human's review: D-017** — `q2c` deliberately deviates from plan §10 (see `docs/DECISIONS.md` Part B5): the plan's queries taken literally make the heal flow impossible. It is a one-line change, tested, and easy to revert.
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
- UI: dev server `make web` proxies `/api` to :8000; deep links `?tab=investigate&autoforensics=1&autoheal=1` reproduce states; headless Edge (`msedge --headless=new --dump-dom/--screenshot --virtual-time-budget=...`) is the UI check (Edge enforces a min window width: use an iframe to test narrow layouts). The API container must be rebuilt (`make up`) after backend changes.
- Tool-call hygiene: pass long Python or quoted text to Bash via files (heredocs containing `'''` broke the shell twice).

## Blocked / questions for the human
1. **Please confirm or reject D-017** (the only deviation from plan §10 so far). Work continues meanwhile; reverting later is a one-file change.
2. Still open: Groq model + key + license (A-14, P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
Start **P5** on `phase/p5-eval` from the merged `main`: read `docs/phases/P5-evaluation.md` and plan §20.1-§20.5 (with §20.2.1 and the PW-coarse rules in §20.3), §20.7, §8.9, §12.2; first task P5-T1 (the scenario generator, seed 20261015).
