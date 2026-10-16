# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (P14d, after the remaining views) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p14d-memory-time-remediate-eval`, from `phase/p14c-graph-presentation`. The next sub-phase branches from this one. Uncommitted and not mine: `README.md` (P8 results rows).
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014). Branches of this chain are pushed; **nothing is merged to `main` and no tag is set** (D-034). `main` = `34f1d85`.
- Verify with `git status -sb`, `git log --oneline -8`, `git ls-remote origin 'phase/p1[3-5]*'`.

## Where the project stands
- **Redesign chain:** P13a–P13d (foundation, shell, access) and P14a–P14d (Run, Investigate, graphs, Memory/Time travel/Remediate/Evaluation) are done: **all six app views are rebuilt** under `web/src/app/views/*`, share `web/src/app/graph/` and `web/src/shared/`, and the original `tabs/`, the old graph components and `legacy.css` are gone. `web/src/landing/Landing.tsx` is still the P13a placeholder (G-004).
- **Layout deviation to confirm:** lanes are vertical columns with time running down (the spec's horizontal bands were ~1,900 px wide on real data); see the P14c notes in `docs/DECISIONS.md`.
- Next: **P15a — the public landing page** (`ui-redesign.md` §11, §15 V6/V7). Constraints from the spec: no fabricated content (the FIG. 1 witness plate and the results numbers come from recorded real data: `eval/results/summary.json`, a captured `explain` response), no "open source" wording until a licence exists and the repo is public, falsification criterion 3 is triggered (no content-agnostic-advantage claim against the LLM judges), and the legacy-link redirect in `web/src/landing/main.tsx` must keep working. Then P15b motion, P15c responsive/a11y hardening, P15d full regression, regenerated screenshots and docs.

## Verification so far (real results)
- `npm test` 359 passed in 29 files; `npx tsc --noEmit` and `npm run build` clean (main app chunk 133 kB). Every rebuilt view was exercised in headless Edge against the real API (scripted mode only) with real mouse, wheel and keyboard events, including the three human-confirmed actions (quarantine release, cut apply, topology reset) with the `X-PW-Human` header and a visual regression pass over all views and the landing page. **Not verified:** pinch zoom on a touch device; the live agent run and LLM-mode forensics (they spend provider tokens: ask the owner first). No change under `api/ tests/ fixtures/ eval/ scripts/`. Backend suites (608 in both modes) are re-run at the end of P15d. One unreproduced backend observation is recorded as I-002 in `docs/PROGRESS.md`.

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
Start **P15a** on `phase/p15a-landing` from this branch: `docs/phases/P13-ui-redesign.md` § P15a, `ui-redesign.md` §11.
