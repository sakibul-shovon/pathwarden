# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (P15d, the redesign chain is complete) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p15d-regression-docs`, from `phase/p15c-responsive-a11y`. It is the tip of the chain: `p13a-redesign-baseline` → `p13b-design-foundation` → `p13c-app-shell-entry` → `p13d-access-onboarding` → `p14a-run-view` → `p14b-case-file` → `p14c-graph-presentation` → `p14d-memory-time-remediate-eval` → `p15a-landing` → `p15b-motion` → `p15c-responsive-a11y` → `p15d-regression-docs`, all on top of `phase/p8-live-llm`. Uncommitted and not mine: `README.md` (P8 results rows).
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014). Branches of this chain are pushed; **nothing is merged to `main` and no tag is set** (D-034). `main` = `34f1d85`.
- Verify with `git status -sb`, `git log --oneline -8`, `git ls-remote origin 'phase/p1[3-5]*'`.

## Where the project stands
- **Redesign chain:** P13a–P15d are **all done and verified** (D-032…D-036 and the P13a–P15d notes in `docs/DECISIONS.md`): six views, a project page, motion, responsive and accessible, regenerated screenshots, updated README, MCP and DEPLOY docs. Nothing is merged to `main` and no tag is set (D-034).
- **To confirm (owner):** lanes as vertical columns (P14c notes); `scripts/capture_landing_story.py` (P15a notes); the motion deviations (P15b notes); whether to keep the accessibility scan as a repeatable check (P15c notes: it used axe-core from the scratchpad, not a repository dependency); whether the page should be prerendered so it shows something without JavaScript.
- **Not verified:** the live agent run and LLM-mode forensics (cost; ask first), a screen reader, a touch device, a real Windows high-contrast theme, frame rate, CI on GitHub (not observed), the usability sessions of `ui-redesign.md` §21.9.

## Verification so far (real results)
- `make test` **608 passed** (268.68 s) and `make test-auth` **608 passed** (119.95 s) against the real FalkorDB, both exit 0; `make lint` clean (it failed first on 18 E501 in my P15a script: fixed); `sh scripts/scan_secrets.sh` ok; `tests/test_docs.py` 5 passed.
- `npm test` 463 passed in 36 files; `npx tsc --noEmit` and `npm run build` clean. Deployment check of §21.12 (static server, `/api` proxy, API stopped, legacy links) passed; accessibility (P15c) axe 0 violations in 42 scans, no overflow at any tested width, zoom or font size.
- Eight screenshots regenerated from the running UI and reviewed (one clipped column found and fixed). No change under `api/ tests/ fixtures/ eval/ Makefile` in the whole chain (`git diff --stat phase/p8-live-llm -- api tests fixtures eval Makefile` is empty).

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
1. Please merge **P8** to `main` first, then this chain in order (D-034), or tell the agent to do it (AGENTS.md §4 allows the agent to merge and tag once a phase is VERIFYING with every gate green; D-034 held it back so far). Also: the owner's uncommitted P8 edit in `README.md` (the B1/B3 result rows) is still only in the working tree and was deliberately kept out of every commit of this chain; **until it is committed, a clean checkout fails `tests/test_docs.py::test_the_readme_results_table_is_exactly_the_generated_one`** (I-003 in `docs/PROGRESS.md`), so commit it before merging.
2. Confirm D-032…D-036 (see P13a) and the P14c layout deviation (lanes as columns).
3. Confirm or remove `scripts/capture_landing_story.py` (P15a), and say whether the page should be prerendered so it shows something without JavaScript. Say whether the axe scan should become a repository dev dependency (P15c).
4. Optional: allow one live run and one LLM forensics run (a few cents of tokens) so `LivePanel` and the LLM report wording can be checked against real data.

## Next action (exactly one)
The owner reviews and merges: `phase/p8-live-llm` first, then the twelve branches of the chain in order into `main` (merge commits, `--no-ff`), then tags if wanted. After that, the only code left is the optional items under *Blocked / questions*; there is no unfinished task in `docs/phases/P13-ui-redesign.md`.
