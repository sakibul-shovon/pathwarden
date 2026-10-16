# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (P15b, after motion) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p15b-motion`, from `phase/p15a-landing`. The next sub-phase branches from this one. Uncommitted and not mine: `README.md` (P8 results rows).
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014). Branches of this chain are pushed; **nothing is merged to `main` and no tag is set** (D-034). `main` = `34f1d85`.
- Verify with `git status -sb`, `git log --oneline -8`, `git ls-remote origin 'phase/p1[3-5]*'`.

## Where the project stands
- **Redesign chain:** P13a–P13d, P14a–P14d, P15a (landing) and **P15b (motion)** are done. Motion lives in `web/src/shared/lib/motion.ts` (sequencer, reduced-motion check, duration tokens, `withViewTransition`), `web/src/app/graph/canvasMotion.ts`, the token-driven CSS and `web/src/shared/components/Working.tsx`; its rules are tested in `web/src/shared/styles/motion.test.ts`.
- **To confirm:** lanes as vertical columns (P14c notes); `scripts/capture_landing_story.py` (P15a notes); the motion deviations (P15b notes).
- Next: **P15c — responsive and accessibility hardening** (`ui-redesign.md` §18, §21.6–21.7): keyboard behaviour of every view (§18.2), focus management, landmarks and names, the contrast table, target sizes, zoom to 200 % and reflow at 320 px, reduced motion (done), and the automated accessibility run with zero serious violations plus a screen-reader smoke test. **A tool such as axe-core is a new dependency (AGENTS.md: ask first):** do not add it to `package.json`; fetch it into the scratchpad and inject it into the page through the DevTools protocol for the run, and record the result as evidence. Then P15d: full regression (`make test` and `make test-auth`, 608 each), regenerated `docs/img/*` from the real UI, README, MCP and DEPLOY docs, final handoff.

## Verification so far (real results)
- `npm test` 455 passed in 35 files; `npx tsc --noEmit` and `npm run build` clean. Every row of the §17.4 motion catalogue was measured in headless Edge against the real API in normal and in reduced motion (series sampled every 20–25 ms for the dialog, the traces, the zoom). **Not verified:** frame rate in the performance panel, the mobile menu sheet's motion on its own, touch, pinch zoom, a screen reader, the automated accessibility run (P15c); the live agent run and LLM-mode forensics (tokens: ask the owner first). No change under `api/ tests/ fixtures/ eval/ Makefile scripts/`. Backend suites (608 in both modes) are re-run at the end of P15d.

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
3. Confirm or remove `scripts/capture_landing_story.py` (P15a), and say whether the page should be prerendered so it shows something without JavaScript.
4. Optional: allow one live run and one LLM forensics run (a few cents of tokens) so `LivePanel` and the LLM report wording can be checked against real data.

## Next action (exactly one)
Start **P15c** on `phase/p15c-responsive-a11y` from this branch: `docs/phases/P13-ui-redesign.md` § P15c, `ui-redesign.md` §18 and §21.6–21.7.
