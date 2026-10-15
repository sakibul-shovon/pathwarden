# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-15 (blueprint preparation) · **Agent / tool / model:** Claude Code / Sonnet 5.5
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: _none — `G:\Projects\Pathwarden` is not a git repository yet_
- HEAD: _none_ · Remote: `origin` should be `https://github.com/sakibul-shovon/pathwarden.git` (stated by the human; not yet verified — run `git ls-remote origin`)
- `git status -sb`:
  ```
  (not a repo yet; files present: plan.md, AGENTS.md, CLAUDE.md, .gitignore, .gitattributes, .env.example,
   .claude/settings.json, .githooks/*, scripts/scan_secrets.sh, .github/*, docs/*)
  ```
- Uncommitted work: everything above (nothing has been committed)

## Where the project stands
- Active phase / task: **none.** Setup is awaiting human approval of `docs/BLUEPRINT.md`.
- Done this session: read all of `plan.md`; checked the machine and the Antigravity/Claude Code conventions; wrote the shared agent instructions, hooks, CI, PR template, workflow docs, phase specs and prompts.
- Partially done: —

## Verification so far (real results)
- Hooks (`.githooks/*`) and `scripts/scan_secrets.sh`: `sh -n` parse OK; **behaviour NOT tested** (the human declined a scratch-repo test). Test them in P0-T1 inside the real clone.
- `.claude/settings.json` parses as JSON; `ci.yml` **not** machine-validated (PyYAML absent) and CI has never run.
- `AGENTS.md` §2 is byte-identical to `plan.md` §4 (diffed). No CRLF in any new file. No credential-shaped strings in any new file.
- Environment facts checked 2026-10-15: git 2.45.2 ✔ · Docker 29.7.2 ✔ · Node 22.12.0 ✔ · Python 3.13 and 3.14 only (**plan needs 3.11**) · `make` ✘ · `gh` ✘ · `uv` ✘.

## Blocked / questions for the human
Answered 2026-10-15 (now recorded): ruff approved (D-006) · install Python 3.11 + make (D-007/D-008, **not yet installed**) · push of phase/fix/docs branches allowed, no agent names in git (D-005/D-013) · repo is private (D-014) · LLM provider Groq (A-14) · cut line confirmed (D-010).
Also approved (human, "approve all"): D-001…D-004, D-009, D-011, D-012 and all Part B resolutions except A-14. Remote verified reachable and empty. The human asked the agent to do git/GitHub pushes and tool installs itself.
Still open — see `docs/BLUEPRINT.md` §7:
1. When to make the repo public (D-014).
2. Groq model name, API key (local `.env` only) and license (A-14).
3. Whether merge + tag stay human-only or are delegated to the agent (D-004/D-005).

## Decisions and constraints a newcomer must know
- `plan.md` is binding; `AGENTS.md` §2 is its §4 verbatim. Open plan ambiguities are listed as A-01…A-16 in `DECISIONS.md`.
- Never read or print `.env`. Fake secrets only as `PWDEMO-…-NOT-A-REAL-KEY`.

## Next action (exactly one)
Human: install the tools and start Docker Desktop, then follow `docs/BLUEPRINT.md` §9 *Getting started* (steps 1–6). The first agent task after that is **P0-T1** in `docs/phases/P0-probe-skeleton.md`.
