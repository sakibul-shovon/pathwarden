# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (P14c, after the graph presentation) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p14c-graph-presentation`, from `phase/p14b-case-file`. The next sub-phase branches from this one. Uncommitted and not mine: `README.md` (P8 results rows).
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014). Branches of this chain are pushed; **nothing is merged to `main` and no tag is set** (D-034). `main` = `34f1d85`.
- Verify with `git status -sb`, `git log --oneline -8`, `git ls-remote origin 'phase/p1[3-5]*'`.

## Where the project stands
- **Redesign chain:** P13a–P13d (foundation, shell, access), P14a (Run), P14b (Investigate) and P14c (graphs) done. Rebuilt views: `web/src/app/views/run/` and `web/src/app/views/investigate/`. Shared graph module: `web/src/app/graph/` (`lanes.ts`, `graphModel.ts`, `LineageFigure`, `CapabilityFigure`, `GraphTable`, `NodeDrawer`, lazy `LineageCanvas`/`CapabilityCanvas`). Memory, Time travel, Remediate and Evaluation are still the old components in `web/src/tabs/` (restyled via `legacy.css`); Remediate already draws its graph with `CapabilityFigure`, Time travel still uses `web/src/components/LineageGraph.tsx`.
- **Layout deviation to confirm:** lanes are vertical columns with time running down (the spec's horizontal bands were ~1,900 px wide on real data); see the P14c notes in `docs/DECISIONS.md`.
- Next: **P14d — Memory, Time travel, Remediate, Evaluation** (`ui-redesign.md` §13.6–13.9). Time travel should use `LineageFigure` with `layoutFrom` (the final graph), `tainted` (`doubly_tainted` from `/graph-at`) and `marked` (the marker artifacts), then `LineageGraph.tsx` can be deleted and Cytoscape leaves the main chunk. Remediate needs the inspector, the agent table (the accessible form of the capability graph) and the cut comparison; the drawer (`NodeDrawer`) is ready for Memory rows.

## Verification so far (real results)
- `npm test` 261 passed in 22 files; `npx tsc --noEmit` and `npm run build` clean. In headless Edge against the real API (scripted mode only), with real mouse and wheel events: lanes drawn, hover dims, a tap opens the drawer, content is requested only on demand, the filters, the table, zoom and full screen, reduced motion, dark theme, a 390 px layout, and the capability graph on Remediate with a real click on an agent. **Not verified:** pinch zoom on a touch device; the Time travel props `tainted`/`marked`/`layoutFrom` in a browser; LLM-mode forensics and a live run (they spend tokens: ask the owner first). No change under `api/ tests/ fixtures/ eval/ scripts/`. Backend suites (608 in both modes) are re-run at the end of P15d.

## Traps and findings a newcomer must know
- **Environment:** Python 3.11.9 in `.venv`; GNU Make is **not on PATH in the agent's Git Bash** until `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; Docker Desktop stops by itself between sessions (start `%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe`, then `docker compose up -d falkordb`); tests use the real FalkorDB.
- **Dev proxy trap (found in P13a):** `web/vite.config.ts` proxies `/api` to `http://localhost:8000`; on this machine Node resolves `localhost` to `::1` and uvicorn listens on IPv4 only, so the UI shows "Bad Gateway". Fixed in P13b by targeting `127.0.0.1`. `make api` + `make web` then work.
- **Live mode costs money:** the dev `.env` has a Groq key, so `/api/health` reports live agents as configured. Never click Live, run `make eval-live` or request `mode: "live"` / forensics `llm` while verifying the UI.
- **Never** run `ruff` on the repo root (D-015). `plan.md` is never edited by agents. Never stage with `git add -A`/`.`: the working tree carries an uncommitted P8 edit to `README.md` (B1/B3 rows) that is not part of this chain (D-034).
- Aggregate-return trap, `STARTS WITH 'a-'` also matching `a-sbx-`, MCP SDK 2.x (`MCPServer`), time travel shows current flag values: see `docs/DECISIONS.md`.
- **The local API does not survive between sessions:** if `curl http://127.0.0.1:8000/api/health` is refused, start `make api` in the background (FalkorDB in Docker keeps running). The agent's scratchpad (driver scripts) can also be wiped: the CDP driver is short to rewrite.
- Tool-call hygiene: pass long Python or quoted text to the shell via files; heredocs containing `'''` or regex escapes broke the shell several times.
- **UI verification recipe (not in the repo):** a ~70-line DevTools-protocol driver using Node 22's built-in `WebSocket` against headless Edge (`--remote-debugging-port`): navigate to a deep link, wait for text, click by text, read the DOM, take screenshots, record the network log (this is how the `X-PW-Human` header is checked). Deep links are documented in `ui-redesign.md` §3.2.

## Blocked / questions for the human
1. Please merge **P8** to `main` first, then this chain in order (D-034).
2. Confirm D-032…D-036 (see P13a) and the P14c layout deviation (lanes as columns).
3. Optional: allow one live run and one LLM forensics run (a few cents of tokens) so `LivePanel` and the LLM report wording can be checked against real data.

## Next action (exactly one)
Start **P14d** on `phase/p14d-memory-time-remediate-eval` from this branch: `docs/phases/P13-ui-redesign.md` § P14d, `ui-redesign.md` §13.6–13.9.
