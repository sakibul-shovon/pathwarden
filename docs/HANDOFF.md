# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p7-timetravel` (from `main` = `7295aca`, P6 merged, tag `phase-p6-done`). After this handoff is committed the agent merges P7 into `main` with `--no-ff`, tags `phase-p7-done` and pushes `main` + tag (D-016). Verify with `git log --oneline -8`, `git tag -l 'phase-*'`, `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014).
- **Work was stopped on purpose here** (the human asked: finish this phase, push, then stop). Nothing after P7 has been started.

## Where the project stands
- **P0-P6 and P10a DONE. P7 VERIFYING → merged right after this commit.** Remaining, recommended order (D-009): **P10b** (UI: Memory, Time travel), **P10c** (UI: Remediate, Evaluation, full demo), P8 (live LLM, needs the Groq key and model, A-14), P9 (MCP), P11 (hardening), P12 (ship).
- Time travel API: `GET /api/ws/{ws}/timeline/max` → `{"t"}`; `GET /api/ws/{ws}/graph-at?t=` → `{t, max_t, nodes, edges, actions, doubly_tainted, markers}`. Markers (`poisoned_memory_written`, `draft_doubly_tainted`) are computed in Python (A-09, Part B9) and are workspace-wide, so a slider can place them. On `attack_sleeper_44`: max t=18, poisoned memory t=4, doubly tainted draft t=16.
- **Needs the human's review (the only two deviations from plan §10):** **D-017** (`q2c` treats sanitized artifacts as the quarantine boundary) and **D-018** (two capability-graph seed queries the plan never wrote). Both are tested, small and easy to revert (`docs/DECISIONS.md` Part B5 / B8).
- Environment: Python 3.11.9 in `.venv`; GNU Make 4.4.1 is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop must be running for tests (they use the real FalkorDB); the API container still runs older code until `make up` rebuilds it.

## Verification so far (real results, 2026-10-16)
- `make test` 431 passed · `make lint` clean · `make demo` ok · `make eval` byte-identical twice (P6) · plan.md unchanged · sabotage checks: P7 4/4 caught after closing 2 escapes.
- **CI never observed** (private repo, no `gh`): gate G10 "not verified". No independent reviewer (G-001).

## Traps and findings a newcomer must know
- **Plan queries can be mutually inconsistent** (q2c vs q4/q2a/rule 7). Run the whole story, do not only test queries one by one. See D-017.
- Aggregate-return trap (`RETURN count(...)` returns a row even if `MATCH` found nothing).
- `STARTS WITH 'a-'` also matches `a-sbx-…`; filter with an exact regex.
- Time travel shows the **current** values of `quarantined` / `approved` / `sanitized` / action `status` (not versioned); say so in the UI.
- `plan.md` §6: `db.list()` does not exist, use `db.list_graphs()`. Never run `ruff` on the repo root (D-015).
- Unauthenticated approve/reject/reset/run/heal/quarantine-release/remediation-apply until P11 (G-002). LLM forensic mode returns 501 until P8 (G-003).
- Sabotage lesson: scenario-level tests miss boundary rules; use crafted replay events for each side of a boundary. A mutation can also be an equivalent mutant for property tests.
- Tool-call hygiene: pass long Python or quoted text to Bash via files (heredocs containing `'''` broke the shell twice).

## Blocked / questions for the human
1. **Please confirm or reject D-017 and D-018.** Work continued meanwhile; reverting either is a small change.
2. Still open: Groq model + key + license (A-14, P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
Start **P10b** on `phase/p10b-ui-memory-time` from the merged `main`: read `docs/phases/P10b-ui-memory-timetravel.md` and the plan sections it lists; first task P10b-T1.
