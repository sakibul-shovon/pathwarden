# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-15 ~22:00 (+06) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p2-gate` (from `main` = `4610b64`, P1 merged, tag `phase-p1-done`). After this handoff is committed the agent merges P2 (D-016): then `main` carries tag `phase-p2-done`. Verify with `git log --oneline -8`, `git tag -l 'phase-*'`, `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014).

## Where the project stands
- **P0, P1 DONE. P2 VERIFYING → merged next.** Next phase: **P3 Scripted agents, demo scenarios, core API** (`docs/phases/P3-scripted-agents-core-api.md`).
- P2 built: `q2a/q2b/q2c` query files, `api/runtime/gate.py` (Gate.decide, GateResult, Verdict, verdict log), `policy_version`, 15 gate tests, invariants (no `.content` in q2*–q8*, no LLM import in the gate).
- Environment: Python 3.11.9 in `.venv`; GNU Make 4.4.1 is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop running; FalkorDB `pathwarden-falkordb-1` via `make up`.

## Verification so far (real results, 2026-10-15)
- `make test` 86 passed · `make lint` clean · `make probe` 35/35 · plan.md unchanged. Four sabotage checks on the gate queries (one found a test gap that is now closed) — see Evidence.
- **CI never observed** (private repo, no `gh`): gate G10 "not verified".
- **No independent reviewer** exists for P2 (Known gap G-001).

## Traps and findings a newcomer must know
- Aggregate-return trap (`RETURN count(...)` returns a row even if `MATCH` found nothing) — q4c and r3 end in `count`.
- Plan §6: `db.list()` does not exist, use `db.list_graphs()`. Never run `ruff` on the repo root (D-015).
- Sabotage checks must also try the *opposite* mistake (e.g. a query that wrongly excludes `sanitized` on the secret path), not only "forgot the exclusion".
- Gate returns witness *lists*; compare endpoints/length, not exact paths (ties between equal-length paths are possible).
- The orchestrator (P3) must treat a gate exception as "not executed", never as ALLOW.

## Blocked / questions for the human
None blocking. Open: Groq model + key + license (A-14, P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
Start **P3** on `phase/p3-scripted-api` from the merged `main`: read `docs/phases/P3-scripted-agents-core-api.md` and plan §12.1, §12.2, §12.4, §9 (Orchestrator), §10 (q3, q5, q6, q6b), §18; first task P3-T1.
