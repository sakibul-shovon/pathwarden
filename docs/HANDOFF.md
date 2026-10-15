# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-15 ~23:00 (+06) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p3-scripted-api` (from `main` = `bce8e9b`, P2 merged, tag `phase-p2-done`). After this handoff is committed the agent merges P3 (D-016): then `main` carries tag `phase-p3-done`. Verify with `git log --oneline -8`, `git tag -l 'phase-*'`, `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014).

## Where the project stands
- **P0, P1, P2 DONE. P3 VERIFYING → merged next.** Next: **P4 Forensic Agent, quarantine, healing, memory API** (`docs/phases/P4-forensics-healing.md`); a cross-agent review is recommended but no second agent is available.
- The core story works end to end: `make up` (FalkorDB + API container) then `make demo` (6/6 scenarios; the attacks LEAK with the guard off and are HELD with it on). REST API per plan §18 (core set); Rule-of-Two badges green on every session.
- Environment: Python 3.11.9 in `.venv`; GNU Make 4.4.1 is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop running; containers `pathwarden-falkordb-1` and `pathwarden-api-1` are up (the API container uses graph `pw_tinyqueue`, the same graph `make demo` resets).

## Verification so far (real results, 2026-10-15)
- `make test` 143 passed (twice, identical) · `make lint` clean · `make probe` 35/35 · `make demo` ok · plan.md unchanged · container API verified with curl. Two sabotage checks for P3 are in the Evidence log.
- **CI never observed** (private repo, no `gh`): gate G10 is "not verified". No independent reviewer (G-001).

## Traps and findings a newcomer must know
- Aggregate-return trap (`RETURN count(...)` returns a row even if `MATCH` found nothing): q4c and r3 end in `count`.
- `plan.md` §6: `db.list()` does not exist, use `db.list_graphs()`. Never run `ruff` on the repo root (D-015).
- Witness ties: two equal-distance secrets, either may be returned; compare membership, not exact paths.
- Sabotage checks must also try the opposite mistake, and must verify that the mutation actually applied (the formatter reflows lines).
- Scenario runs reset the workspace by default (`"reset": true`); `reset:false` keeps team memory, which is how a later benign run gets held (the sleeper effect).
- The API container and `make demo` share the graph `pw_tinyqueue`; tests use `pw_test_<random>` graphs only.
- Unauthenticated approve/reject/reset until P11 (G-002).

## Blocked / questions for the human
None blocking. Open: Groq model + key + license (A-14, P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
Start **P4** on `phase/p4-forensics` from the merged `main`: read `docs/phases/P4-forensics-healing.md` and plan §10 (q4, q4b, q4c, q4d, q8), §13 (13.1, 13.2, 13.4, 13.5), §18; first task P4-T1.
