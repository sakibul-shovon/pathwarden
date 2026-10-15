# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (after P10c) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p10c-ui-remediate-eval` (from `main` = `8406f88`, P10b merged, tag `phase-p10b-done`). After this handoff is committed the agent merges P10c with `--no-ff`, tags `phase-p10c-done` and pushes `main` + tag (D-016). Verify with `git log --oneline -8`, `git tag -l 'phase-*'`, `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014).
- The human restarted the work after the P7 stop ("start koro"); the standing rule (D-016) is to merge and continue with the next phase.

## Where the project stands
- **P0-P7, P10a and P10b DONE. P10c VERIFYING → merged right after this commit.** The UI has all six tabs; the full demo (leak → hold → forensics → heal → time travel → memory → remediation → evaluation) was clicked through in headless Edge. Remaining: **P8** (live LLM; **blocked on the human**: Groq model name + key, A-14), **P9** (MCP server and gateway; needs a probe of the MCP SDK, rule 13), P11 (hardening), P12 (ship: README, AI disclosure, video script, make the repo public).
- UI tabs: Run, Investigate, Time travel, Memory, **Remediate** (capability graph, witnesses, candidates C1-C4, Apply/Reset with confirm) and **Evaluation** (everything from `GET /api/eval/summary`, incl. the new `limitations` list, D-021). `docker-compose.yml` mounts `eval/results` read-only into the API container (D-020), otherwise the tab is empty in Docker.
- **Needs the human's review (deviations and additions beyond plan §10):** **D-017** (`q2c` treats sanitized artifacts as the quarantine boundary), **D-018** (two capability-graph seed queries the plan never wrote) the additive **D-019** (`quarantine_id` in `GET /memory`), **D-020** (compose mount) and **D-021** (`limitations` in summary.json). All are tested, small and easy to revert (`docs/DECISIONS.md` Part B5 / B8).
- Environment: Python 3.11.9 in `.venv`; GNU Make 4.4.1 is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop must be running for tests (they use the real FalkorDB); `make up` rebuilds the API container after code changes (it was rebuilt for P10b). Another project may hold port 5173: Vite then uses 5174.

## Verification so far (real results, 2026-10-16)
- `make test` 433 passed · `make lint` clean · web `npm run build` ok · `make eval` twice byte-identical · `make demo` exit 0 · full-demo checklist 8/8 in headless Edge (dev server, and steps 1-4 on the production build) · plan.md unchanged.
- **CI never observed** (private repo, no `gh`): gate G10 "not verified". No independent reviewer (G-001).

## Traps and findings a newcomer must know
- **Plan queries can be mutually inconsistent** (q2c vs q4/q2a/rule 7). Run the whole story, do not only test queries one by one. See D-017.
- Aggregate-return trap (`RETURN count(...)` returns a row even if `MATCH` found nothing).
- `STARTS WITH 'a-'` also matches `a-sbx-…`; filter with an exact regex.
- Time travel shows the **current** values of `quarantined` / `approved` / `sanitized` / action `status` (not versioned); say so in the UI.
- `plan.md` §6: `db.list()` does not exist, use `db.list_graphs()`. Never run `ruff` on the repo root (D-015).
- Unauthenticated approve/reject/reset/run/heal/quarantine-release/remediation-apply until P11 (G-002). LLM forensic mode returns 501 until P8 (G-003).
- Sabotage lesson: scenario-level tests miss boundary rules; use crafted replay events for each side of a boundary. A mutation can also be an equivalent mutant for property tests.
- UI verification recipe (not in the repo): headless Edge `--screenshot` / `--dump-dom` with `--virtual-time-budget`, or Node 22's built-in WebSocket against `--remote-debugging-port` to click and read the DOM. Deep links: `?tab=time&t=N`.
- Tool-call hygiene: pass long Python or quoted text to Bash via files (heredocs containing `'''` broke the shell twice).

## Blocked / questions for the human
1. **Please confirm or reject D-017, D-018 and D-019** (D-020/D-021 are small and informational). Work continued meanwhile; reverting either is a small change.
2. Still open: Groq model + key + license (A-14, P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
P8 cannot start without the human's Groq model name (A-14). Meanwhile start **P9** on `phase/p9-mcp` from the merged `main`: read `docs/phases/P9-mcp.md`, run the MCP SDK probe first (rule 13), then P9-T1.
