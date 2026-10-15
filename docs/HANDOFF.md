# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (after P12, agent part) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p12-ship` (from `main` = `63c74d1`, P11 merged, tag `phase-p11-done`). After this handoff is committed the agent merges the agent part of P12 with `--no-ff` and pushes `main`; **it does NOT tag `phase-p12-done`** (the human items are open). Verify with `git log --oneline -8`, `git tag -l 'phase-*'`, `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014).
- The human restarted the work after the P7 stop ("start koro"); the standing rule (D-016) is to merge and continue with the next phase.

## Where the project stands
- **Everything the agent can build is built: P0-P7, P9, P10a-c, P11 DONE; P12's agent part is done (README, docs, clean-clone test, traceability, final checklist).** What is left is **human**: license + making the repo public (P12-T6), the demo video (T5), deployment (T4, `docs/DEPLOY.md`), submission (T9, deadline 18 Oct 23:59 IST). `docs/FINAL_CHECKLIST.md` lists them in blocking order. **P8** (live LLM agents, LLM judges, live study) is blocked on the Groq model name (A-14).
- UI: six tabs (Run, Investigate, Time travel, Memory, Remediate, Evaluation); `?ws=tinyqueue-mcp` switches every tab to the graph the MCP gateway wrote (D-026).
- **Needs the human's review (deviations and additions beyond plan §10):** **D-017** (`q2c` treats sanitized artifacts as the quarantine boundary), **D-018** (two capability-graph seed queries the plan never wrote) the additive **D-019** (`quarantine_id` in `GET /memory`), **D-023** (a synthetic registry tool so the gateway can record unmanaged reads) and the informational D-020/D-021/D-022/D-024..D-027. All are tested, small and easy to revert (`docs/DECISIONS.md` Part B5 / B8).
- Environment: Python 3.11.9 in `.venv`; GNU Make 4.4.1 is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop must be running for tests (they use the real FalkorDB); `make up` rebuilds the API container after code changes (it was rebuilt for P10b). Another project may hold port 5173: Vite then uses 5174.

## Verification so far (real results, 2026-10-16)
- Fresh-clone run of the README quickstart: `make setup`, `make up`, `make demo`, `make test` (517 passed), `make eval` (byte-identical) all exit 0 · `make test-auth` green · probe 36/36 · probe-mcp 7/7 · `npm audit --omit=dev` 0 vulnerabilities · scan_secrets ok (history: 3 prose lines, no keys) · plan.md unchanged.
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
- Hosted mode: `PW_AUTH=on` + keys (`docs/SECURITY.md`); the UI takes the key from `?key=` or `VITE_API_KEY`. A mutation run can create real graphs in the dev database (S10 made `pw_nope`): check `GET /api/health` graphs after sabotage runs.
- Docker Desktop stops by itself between sessions: start it (`%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`) and `docker compose up -d falkordb` before `make test`.
- Tool-call hygiene: pass long Python or quoted text to Bash via files (heredocs containing `'''` broke the shell twice).

## Blocked / questions for the human
1. **Please confirm or reject D-017, D-018, D-019 and D-023, and the two marked statements in `docs/AI_ASSISTANCE.md`** (and glance at D-028/D-029, the key header and the human header in both modes) (the others are small and informational). Work continued meanwhile; reverting either is a small change.
2. Still open: Groq model + key + license (A-14, P8/P12); making the repo public at the end (D-014).

## Next action (exactly one)
Nothing the agent can do alone remains except **P8**, which needs the owner's Groq model name (the key stays in the gitignored `.env`). If the owner provides it: start P8 on `phase/p8-live-llm` (read `docs/phases/P8-live-llm.md`, probe LiteLLM first, rule 13). Otherwise the next action is the owner's: see `docs/FINAL_CHECKLIST.md`.
