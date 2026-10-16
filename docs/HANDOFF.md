# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (P14b, after the Investigate case file) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p14b-case-file`, from `phase/p14a-run-view`. The next sub-phase branches from this one. Uncommitted and not mine: `README.md` (P8 results rows).
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014). Branches of this chain are pushed; **nothing is merged to `main` and no tag is set** (D-034). `main` = `34f1d85`.
- Verify with `git status -sb`, `git log --oneline -8`, `git ls-remote origin 'phase/p1[3-5]*'`.

## Where the project stands
- **Redesign chain:** P13a–P13d (foundation, shell, access), P14a (Run) and P14b (Investigate) done. `web/src/app/views/run/` and `web/src/app/views/investigate/` are the rebuilt views; Memory, Time travel, Remediate and Evaluation are still the old components in `web/src/tabs/` (restyled via `legacy.css`), and the lineage and capability graphs are still `web/src/components/{LineageGraph,CapabilityGraph}.tsx`.
- Next: **P14c — graph presentation** (`ui-redesign.md` §15, §13.10): deterministic `lanesLayout` (unit-tested, `preset` layout only, built-in layouts), Tree toggle, GraphTable, NodeDrawer (native `<dialog>` drawer variant already in `shared/components/Dialog`), trace, dim-unrelated, capability `roots`. The Investigate view already passes `untrustedWitness`/`secretWitness` into `LineageGraph` and has the caption text for it.

## Verification so far (real results)
- `npm test` 200 passed; `npx tsc --noEmit` and `npm run build` clean; the Investigate acceptance flow, the sleeper jump to Time travel, the stale link, the review dialog focus handling and a 390 px layout check were run in headless Edge against the real API (scripted mode only). **LLM-mode forensics was not run** (spends provider tokens; ask the owner first). No change under `api/ tests/ fixtures/ eval/ scripts/`. Backend suites (608 in both modes) are re-run at the end of P15d.

## Traps and findings a newcomer must know
- **Environment:** Python 3.11.9 in `.venv`; GNU Make is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop stops by itself between sessions (start `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`, then `docker compose up -d falkordb`); tests use the real FalkorDB.
- **Dev proxy trap (found in P13a):** `web/vite.config.ts` proxies `/api` to `http://localhost:8000`; on this machine Node resolves `localhost` to `::1` and uvicorn listens on IPv4 only, so the UI shows "Bad Gateway". Fixed in P13b by targeting `127.0.0.1`. `make api` + `make web` then work.
- **Live mode costs money:** the dev `.env` has a Groq key, so `/api/health` reports live agents as configured. Never click Live, run `make eval-live` or request `mode: "live"` / forensics `llm` while verifying the UI.
- **Never** run `ruff` on the repo root (D-015). `plan.md` is never edited by agents. Never stage with `git add -A`/`.`: the working tree carries an uncommitted P8 edit to `README.md` (B1/B3 rows) that is not part of this chain (D-034).
- Aggregate-return trap, `STARTS WITH 'a-'` also matching `a-sbx-`, MCP SDK 2.x (`MCPServer`), time travel shows current flag values: see `docs/DECISIONS.md`.
- Tool-call hygiene: pass long Python or quoted text to the shell via files; heredocs containing `'''` or regex escapes broke the shell several times.
- **UI verification recipe (not in the repo):** a ~70-line DevTools-protocol driver using Node 22's built-in `WebSocket` against headless Edge (`--remote-debugging-port`): navigate to a deep link, wait for text, click by text, read the DOM, take screenshots, record the network log (this is how the `X-PW-Human` header is checked). Deep links are documented in `ui-redesign.md` §3.2.

## Blocked / questions for the human
1. Please merge **P8** to `main` first, then this chain in order (D-034).
2. Confirm D-032…D-036 (see P13a).
3. Optional: allow one live run and one LLM forensics run (a few cents of tokens) so `LivePanel` and the LLM report wording can be checked against real data.

## Next action (exactly one)
Start **P14c** on `phase/p14c-graph-presentation` from this branch: `docs/phases/P13-ui-redesign.md` § P14c, `ui-redesign.md` §15 and §13.10.
