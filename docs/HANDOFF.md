# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (after P9) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p9-mcp` (from `main` = `c99a84d`, P10c merged, tag `phase-p10c-done`). After this handoff is committed the agent merges P9 with `--no-ff`, tags `phase-p9-done` and pushes `main` + tag (D-016). Verify with `git log --oneline -8`, `git tag -l 'phase-*'`, `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014).
- The human restarted the work after the P7 stop ("start koro"); the standing rule (D-016) is to merge and continue with the next phase.

## Where the project stands
- **P0-P7 and P10a-c DONE. P9 VERIFYING → merged right after this commit.** Remaining: **P11** (multi-tenancy and hardening; next), **P12** (ship: README, AI disclosure, video script, make the repo public) and **P8** (live LLM; **blocked on the human**: Groq model name, A-14). See `docs/MCP.md` for P9: `make probe-mcp`, `make demo-mcp` (three scripted MCP clients through three gateway processes; the release is held), `make mcp-server`, `make gateway`; the gateway lineage is viewable with `?ws=tinyqueue-mcp`.
- UI: six tabs (Run, Investigate, Time travel, Memory, Remediate, Evaluation); `?ws=tinyqueue-mcp` switches every tab to the graph the MCP gateway wrote (D-026).
- **Needs the human's review (deviations and additions beyond plan §10):** **D-017** (`q2c` treats sanitized artifacts as the quarantine boundary), **D-018** (two capability-graph seed queries the plan never wrote) the additive **D-019** (`quarantine_id` in `GET /memory`), **D-023** (a synthetic registry tool so the gateway can record unmanaged reads) and the informational D-020/D-021/D-022/D-024..D-027. All are tested, small and easy to revert (`docs/DECISIONS.md` Part B5 / B8).
- Environment: Python 3.11.9 in `.venv`; GNU Make 4.4.1 is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop must be running for tests (they use the real FalkorDB); `make up` rebuilds the API container after code changes (it was rebuilt for P10b). Another project may hold port 5173: Vite then uses 5174.

## Verification so far (real results, 2026-10-16)
- `make test` 479 passed · `make lint` clean · `make probe-mcp` 7/7 · `make demo-mcp` holds the attack (exit 0) · UI of the gateway graph checked in headless Edge · sabotage on the gateway 12/12 caught after closing 2 escapes · plan.md unchanged. Optional extra: `pip install -e ".[mcp]"` (the tests of P9 need it; it is already in the venv).
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
- MCP SDK is 2.x: `FastMCP` is gone (`MCPServer`, `mcp.Client`, low-level `Server`); only `ToolError` keeps its message. Several gateway processes share one graph: file lock + `Runtime.resync()` (D-025). For P11: the `<ws>-mcp` workspace (graph `pw_mcp_<ws>`) must be covered by the same workspace key as `<ws>`.
- Docker Desktop stops by itself between sessions: start it (`%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`) and `docker compose up -d falkordb` before `make test`.
- Tool-call hygiene: pass long Python or quoted text to Bash via files (heredocs containing `'''` broke the shell twice).

## Blocked / questions for the human
1. **Please confirm or reject D-017, D-018, D-019 and D-023** (the others are small and informational). Work continued meanwhile; reverting either is a small change.
2. Still open: Groq model + key + license (A-14, P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
Start **P11** on `phase/p11-hardening` from the merged `main`: read `docs/phases/P11-multitenancy-hardening.md` and the plan sections it lists; A-07 and A-12 were approved in 'approve all' (record the concrete outcome); first task P11-T1. P8 stays blocked until the human gives the Groq model name.
