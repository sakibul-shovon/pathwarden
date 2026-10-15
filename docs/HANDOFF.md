# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-15 ~21:00 (+06) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p1-runtime` (from `main` = `3632e9c`, which is P0 merged and tagged `phase-p0-done`). Verify with `git log --oneline -8` and `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private; the human makes it public when the project ends, D-014).
- Expected: clean tree after the P1 commits; if P1 has already been merged, `main` carries tag `phase-p1-done`.

## Where the project stands
- **P0 DONE** (merged, tagged). **P1 VERIFYING** → merged by the agent after this handoff is committed (D-016). Next phase: **P2 Gate** (`docs/phases/P2-gate.md`), cross-agent review recommended.
- P1 built: fixtures (verbatim from plan), 22 named query files, `NamedGraph`/loader, registry + policy models, `Runtime` (sessions, reads, loads, writes, sanitize, propose, approve, status/supersede), event log, replay, schema/reset/seed. 69 tests pass.
- Environment (this machine): Python 3.11.9 in `.venv`, GNU Make 4.4.1 — **not on PATH in the agent's Git Bash** until you `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop running; FalkorDB container `pathwarden-falkordb-1` (`make up`).

## Verification so far (real results, 2026-10-15)
- `make test`: 69 passed (twice, identical). `make lint`: clean. `make probe`: 35/35. plan.md unchanged.
- Sabotage checks for P1 recorded in `PROGRESS.md` Evidence (namespace regex; write-existence).
- **CI never observed** (private repo, no `gh`): gate G10 is "not verified" for every phase so far.

## Traps and findings a newcomer must know
- **Aggregate-return trap:** a named query ending in `RETURN count(...)` returns a row even if its `MATCH` found nothing (`q1_write` → `[[0]]` for a missing session). Verify existence separately. q4c and r3 end in `count` too (P4/P6).
- **Plan §6 is wrong about the client:** `db.list()` does not exist; use `db.list_graphs()`. `plan.md` is the human's file — do not edit it.
- **Never run `ruff` on the repo root** (rewrites Markdown code blocks, D-015). Use `make fmt` / `make lint`.
- `STARTS WITH 'a-'` also matches `a-sbx-…`: id counters filter with an exact regex.
- `memory_list` is not a registry tool; the scripted Fixer uses `memory_read` for `load_by_prefix`.
- Tests may query the graph directly (`cypher` fixture); application code must use named queries only (invariant tests enforce it).

## Blocked / questions for the human
None blocking. Still open: Groq model + key + license (A-14, needed for P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
Start **P2** on `phase/p2-gate` from the merged `main`: read `docs/phases/P2-gate.md` and plan §10 (q2a–q2d), §11, then P2-T1.
