# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-16 (P13c, after the app shell) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p13c-app-shell-entry`, from `phase/p13b-design-foundation`. The next sub-phase branches from this one. Uncommitted and not mine: `README.md` (P8 results rows).
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private until the project ends, D-014). Branches of this chain are pushed; **nothing is merged to `main` and no tag is set** (D-034). `main` = `34f1d85`.
- Verify with `git status -sb`, `git log --oneline -8`, `git ls-remote origin 'phase/p1[3-5]*'`.

## Where the project stands
- **Redesign chain:** P13a, P13b, P13c done. The app now lives at `/app/` (`web/app/index.html` → `src/app/main.tsx` → `Shell.tsx`); `/` is a placeholder landing page (G-004) whose only job besides the tagline is the legacy redirect (`/?tab=…` → `/app/?tab=…`, so the MCP gateway's "Review at" link keeps working). The six views are still the old components in `web/src/tabs/` inside the new shell. State of the URL: `src/app/url.ts`; navigation model: `src/app/navModel.ts`.
- Next: P13d (Connect state for hosted mode, key stripping already partly done, sign out, story-guide model). Spec: `ui-redesign.md` §12.

## Verification so far (real results)
- `npm test` 102 passed; `npm run build` strict OK with two entries; legacy links, navigation/history, workspace switch, theme, menu drawer, keyboard and the unreachable state were exercised in headless Edge (see PROGRESS evidence). No change under `api/ tests/ fixtures/ eval/ scripts/`. Backend suites (608 in both modes) are re-run at the end of P15d.

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

## Next action (exactly one)
Start **P13d** on `phase/p13d-access-onboarding` from this branch: `docs/phases/P13-ui-redesign.md` § P13d, `ui-redesign.md` §12.
