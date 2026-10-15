# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-15 ~19:30 (+06) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p0-skeleton` (created from `main` at `38cf308`, the pushed root commit). HEAD = tip of `origin/phase/p0-skeleton` — verify with `git log --oneline -8` and `git status -sb`.
- Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (private, D-014). `main` = `38cf308` on the remote (verified with `git ls-remote`).
- Expected working tree: clean. If anything is uncommitted it is not mine to discard — report it.

## Where the project stands
- Active phase: **P0 (IN_PROGRESS)**. Tasks T1–T8 and T10 are done with evidence in `PROGRESS.md`. Open: **T9** (the CI run on GitHub has not been seen — repo is private and `gh` is not installed), **T11** (GitHub settings), **T12** (n/a: no hosted FalkorDB yet).
- Built: `pyproject.toml`, `constraints.txt`, `Makefile`, `docker-compose.yml` (FalkorDB pinned by digest), `api/{main,settings}.py`, `api/graph/client.py`, `scripts/probe_falkordb.py`, `tests/` (14 tests), CI with guards removed.
- Environment on this machine (installed 2026-10-15): Python 3.11.9 (`py -3.11`, venv in `.venv`), GNU Make 4.4.1 (at `%LOCALAPPDATA%\Microsoft\WinGet\Packages\ezwinports.make_…\bin` — **not yet on PATH in the agent's Git Bash**; prefix commands with `export PATH="$PATH:/c/Users/shovon/AppData/Local/Microsoft/WinGet/Packages/ezwinports.make_Microsoft.Winget.Source_8wekyb3d8bbwe/bin"`; a fresh terminal has it), Docker Desktop (started by the agent; FalkorDB container `pathwarden-falkordb-1` may be running — `make up` / `make down`).

## Verification so far (real results, 2026-10-15)
- `make probe`: **35 passed, 0 failed** on the digest-pinned image (and earlier on `:latest`). Details and plan errata: `DECISIONS.md` Part C.
- `make test`: **14 passed**. `make lint`: clean. `make fmt` leaves `plan.md` unchanged. `/api/health` returned `{"falkordb":"ok","graphs":[]}`.
- Clean venv (`pip install -c constraints.txt -e ".[dev]"`) reproduces the same results — **CI itself has never run**.
- Hooks verified directly in the real repo (details in the Evidence log). The local-`.env`-value scan (third check of `scan_secrets.sh`) is **not** exercised yet because no `.env` exists.

## Traps and findings a newcomer must know
- **Plan §6 is wrong about the client:** `db.list()` does not exist in falkordb 1.8.0 — use `db.list_graphs()`. `plan.md` is the human's file; do not edit it, tell the human.
- **Never run `ruff format .` / `ruff check .` on the repo root:** ruff 0.17 rewrites Python code blocks inside Markdown (it altered plan.md once; D-015). Use `make fmt` / `make lint` only.
- `make api` runs `uvicorn api.main:create_app --factory` — there is deliberately no module-level `app`, so importing `api.main` never reads a `.env`.
- Maxflow values come back as floats; empty `UNWIND` returns a row with `0`; `STARTS WITH 'a-'` also returns `a-sbx-…` ids (filter in Python); empty graph `q0_max_ts` is `None`.

## Blocked / questions for the human
1. **Merge of P0:** merge + tag are human-only (D-004/D-005) and `gh` is not installed, so a PR cannot be opened from here. Options: (a) human merges on github.com; (b) human delegates merge+tag+push of `main` to the agent (then the agent does `git switch main && git merge --no-ff phase/p0-skeleton`, tags `phase-p0-done`, and pushes with the documented `PW_ALLOW_MAIN=1` exception); (c) install `gh` and log in once.
2. Look at the Actions tab of the repo (private) and tell the agent whether `repo-hygiene` and `api` are green — only then can P0-T9 be ticked.
3. Still open: when to make the repo public (D-014), Groq model + key + license (A-14).

## Next action (exactly one)
Resolve question 1 (how P0 gets merged), then start **P1** (`docs/phases/P1-graph-runtime-replay.md`) on `phase/p1-runtime`, branched from the merged `main`.
