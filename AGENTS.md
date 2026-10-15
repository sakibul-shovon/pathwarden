# Pathwarden — instructions for every coding agent

One engineering standard for Claude Code, Antigravity and any other agent. `CLAUDE.md` only imports this file.
Keep it short: procedures live in `docs/WORKFLOW.md`, prompts in `docs/PROMPTS.md`.

## 0. Source of truth and reading order

1. `plan.md` — binding requirements. **Never load all of it** (~94 KB). Read only the sections your phase file lists.
2. This file — rules.
3. `docs/HANDOFF.md` — where the previous agent stopped. It is a *claim*: verify it against git and the code.
4. `docs/PROGRESS.md` — phase status, evidence, known issues.
5. `docs/phases/P<n>-*.md` — the active phase: tasks, tests, acceptance criteria, Definition of Done.
6. `docs/DECISIONS.md` — decisions already made. Do not re-litigate them.

Conflict precedence: `plan.md` > this file > phase file > PROGRESS/HANDOFF > chat. If plan.md is ambiguous or wrong: **stop and ask** (§6).

## 1. Start of every session — before editing anything

1. `git status -sb`, `git branch --show-current`, `git log --oneline -5`. A dirty tree you did not create: report it, do not touch it.
2. Read `docs/HANDOFF.md`, then the active phase in `docs/PROGRESS.md`, then that phase file and the plan sections it lists.
3. Run `make test` for a baseline (once `make` exists, i.e. after P0). Record the result; do not start from an unknown state.
4. Restate in 3–5 lines what you will build and which tests prove it. Confirm it is inside the phase scope.

## 2. Project rules from plan.md §4 (verbatim — do not edit; change plan.md first)

### Working method

- Work one phase at a time (Section 22). Read only the sections that phase lists.
- Before coding a phase, restate in 3–5 lines what will be built and which tests prove it.
- After each phase: run `make test` and the phase acceptance check, update `docs/PROGRESS.md`, commit `P<n>: <summary>`.
- If a ⚠️ PROBE item fails or this plan is ambiguous: stop and ask. Record decisions in `docs/DECISIONS.md`.

### Hard rules

1. Never invent FalkorDB syntax, procedures or client methods. Use only what Sections 6 and 10 show or what the probe verified. No `apoc.*`, `gds.*`, Neo4j-only features. If a needed query is not in Section 10, stop and ask; do not write ad-hoc Cypher.
2. All Cypher lives in `api/graph/queries/*.cypher`, loaded by name. Queries return scalars or lists of scalars only (no raw nodes/paths into Python).
3. The gate and the Forensic Agent never read artifact `content`. No LLM call in the gate.
4. Only the runtime writes provenance. Agents never get a graph handle.
5. Trust labels come only from the registry, never from an LLM.
6. Fail closed on unknown tools, unknown sinks, or missing provenance.
7. `sanitized` cuts only untrusted paths. Only human `approved` cuts secret paths.
8. Risk-reducing actions may be automatic (quarantine, sandbox replay). Risk-increasing actions need a human (release, approval, applying a permission change).
9. Fake secrets only in the format `PWDEMO-SECRET-<8 hex>-NOT-A-REAL-KEY` / `PWDEMO-TOKEN-<8 hex>-NOT-A-REAL-KEY`. Never write strings shaped like real provider keys (`sk_live_`, `ghp_`, `AKIA…`) — GitHub push protection may block the repo.
10. Scripted mode, all tests and the deterministic evaluation must run with no API key.
11. Never hand-edit evaluation numbers or hard-code expected remediation results.
12. No new dependencies beyond Section 6 without asking. No features beyond this plan.
13. Before using any third-party SDK (MCP SDK, LiteLLM), read its current docs or source and write a tiny probe; do not rely on memory of its API.

Commit format refinement (D-003): plan §4 says `P<n>: <summary>`; the summary starts with a type, e.g. `P3: feat(api): add scenario runner`. Enforced by `.githooks/commit-msg`.

## 3. Engineering standards

- **Python 3.11**, type hints on every public function. Pydantic v2 at every boundary (API bodies, YAML fixtures, LLM JSON). Stdlib `logging`; no `print` in `api/`. Never log artifact `content`, env values or API keys.
- **Cypher**: parameters only (never format values into query text); one query per file; file name = query name; no `.content` in `q2*`–`q8*`.
- **Errors**: domain exceptions named in plan §9; API errors are `{"error": "<code>", "detail": "<text>"}` (§18); fail closed.
- **Determinism**: graph ids come from namespaced counters, time from the logical clock. No wall-clock, `uuid` or unseeded randomness in anything stored in the graph or written under `eval/results/`.
- **Tests**: pytest against a **real FalkorDB** (Cypher semantics are the main risk — never mock the DB). Mock only the LLM and the clock. Test graphs are named `pw_test_<random>` and deleted afterwards. Assert observable behaviour (verdicts, witness endpoints, edge sets, HTTP bodies), not implementation details. Every bug fix starts with a failing regression test. No test may need network access or an LLM key.
- **Frontend**: TypeScript `strict`, no `any` for API data (types mirror §18), polling only, Cytoscape built-in layouts only.
- **Dependencies**: only those in §6. Dev tooling (e.g. `ruff`) and any new package need a human OK and a `docs/DECISIONS.md` entry. LLM and MCP packages are optional extras (`llm`, `mcp`) so scripted mode stays light.
- **Scope**: no refactors, renames, formatting sweeps or features outside the current task.
- **No fake completeness**: a stub must fail loudly (`NotImplementedError`, non-zero exit) and be listed under *Known gaps* in `docs/PROGRESS.md`. Never present a placeholder as done.
- **Secrets**: the real `.env` (holds `PW_LLM_API_KEY`) is gitignored and must never be read, printed or copied into fixtures, tests, logs or docs. `fixtures/env.yaml` is the *synthetic* demo `.env` — do not confuse the two.
- **Comments**: only for non-obvious *why*. Match the surrounding code's style.

## 4. Git rules (full policy: `docs/WORKFLOW.md` §6)

- Work on `phase/p<n>-<slug>` (fixes: `fix/<slug>`; docs: `docs/<slug>`). **Never commit on `main`/`master`.**
- **Commit** (authorised by plan §4) when the relevant gates are green: stage explicit paths (no `git add -A`/`.`), read `git diff --cached`, one logical change per commit, `P<n>[a-d]: <type>(<scope>): <summary>`. Never `--no-verify`. Never commit failing tests, secrets, generated junk or unrelated changes.
- **Push** of `phase/*`, `fix/*`, `docs/*` branches **is authorised** (D-005): `git push -u origin <branch>` once its gates are green. Never to `main`/`master`, never forced, never tags. The task prompt may withdraw it with `PUSH: no`.
- **Merge and tag are delegated to the agent (D-004/D-005, human decision 2026-10-15)**, only when the phase is VERIFYING with every gate green and evidence recorded: `git switch main && git merge --no-ff phase/<branch>` (merge commit, never squash/rebase), annotated tag `phase-p<n>-done`, then push `main` and the tag with `PW_ALLOW_MAIN=1` — that variable may be set **only for this step** and for the one-time bootstrap. Never force-push; never push anything else to `main`. Delete branch, repo settings, visibility: human only.
- **No agent attribution in git** (D-013): no `Co-Authored-By`, "Generated with …", or tool/model name in commit messages, PR text or branch names. Commits use the repo's configured identity; never change `git config user.*`. Tool and model are logged in `docs/PROGRESS.md`; the AI-assistance disclosure (plan §24.5) lives in the README and `docs/AI_ASSISTANCE.md`.
- **Forbidden unless the human names the exact target in this session**: force-push, `reset --hard`, `clean`, `checkout -- <path>`, `restore` of worktree files, `stash drop`, `branch -D`, rebase/amend of pushed commits, any history rewrite, editing commit dates, setting `PW_ALLOW_FORCE`, or setting `PW_ALLOW_MAIN` for anything except the phase-merge push above.
- **Never claim an unverified result.** After a push, compare `git rev-parse HEAD` with `git ls-remote origin <branch>`. For tests, quote the real command and its result. If you cannot see CI, say "CI not verified".
- One agent per working tree at a time. Parallel work needs `git worktree` and the human's say-so.

## 5. Tracking rules (full table: `docs/WORKFLOW.md` §4)

- `docs/HANDOFF.md` is **overwritten** at every stop (planned or not) using its template.
- `docs/PROGRESS.md`: update the phase row, append evidence (command + real result) and a session-log line.
- Tick a task box in the phase file **only** with evidence. A failed gate keeps the task unticked.
- Record every design choice that a later agent could question in `docs/DECISIONS.md`.

## 6. Stop and ask (do not work around)

Stop, write the question in `docs/HANDOFF.md` → *Blocked / questions*, and end your turn with it when:
plan.md is ambiguous or self-contradictory · a ⚠️ PROBE item fails · you need Cypher that is not in §10 · you need a new dependency · a requirement seems to need dropping or weakening · an acceptance criterion cannot be verified · a destructive action seems necessary · the working tree contains changes you do not understand · a security-relevant choice is unclear.

## 7. Definition of done (any task)

Acceptance criteria each verified with evidence · gates G1–G10 pass (`docs/WORKFLOW.md` §7) · diff reviewed for regressions, secrets and unrelated edits · tracking files updated · checkpoint commit proposed or made per §4 · next action stated precisely.

## 8. Commands (defined in P0; until then they do not exist)

| Command | Purpose |
|---|---|
| `make up` / `make down` | start / stop FalkorDB (+ API, mock upstreams once they exist) |
| `make probe` | `scripts/probe_falkordb.py` — PASS/FAIL per ⚠️ PROBE item |
| `make test` | full pytest suite incl. static invariants (needs FalkorDB) |
| `make lint` / `make fmt` | lint / format (tool per `docs/DECISIONS.md` D-006) |
| `make demo` · `make eval` · `make eval-live` | demo run · deterministic evaluation · LLM evaluation (costs money — ask first) |
| `make api` · `make web` · `make mcp-server` · `make gateway` | run services |
| `sh scripts/scan_secrets.sh` | secret-shape scan of tracked files |

Windows: run shell scripts and `make` from Git Bash. All text files use LF (`.gitattributes`).
