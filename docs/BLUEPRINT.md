# Pathwarden development blueprint — for review

**Status: PROPOSED — nothing here is implemented or committed.** This is the review entry point. After approval it can be archived; the durable rules live in `AGENTS.md`, `docs/WORKFLOW.md`, `docs/phases/`, and the tracking files.
Prepared 2026-10-15 18:15 (+06) from `plan.md` v2.1 and the state of this machine and folder.

## 1. What is proposed (in one screen)

- **One standard for every agent:** `AGENTS.md` (canonical, 102 lines / 9 KB, includes plan §4 verbatim — diff-checked) read natively by Antigravity and imported by `CLAUDE.md` for Claude Code.
- **Phases:** the plan's P0–P12 kept as-is (ids used in commits/tags), P10 split into P10a/b/c, recommended order puts a clickable UI right after P4. 15 phase specs in `docs/phases/`, each with the 10 required fields.
- **Tracking:** `docs/PROGRESS.md` (dashboard + evidence + issues), `docs/HANDOFF.md` (overwritten baton), `docs/DECISIONS.md` (decisions + 16 plan ambiguities), task checkboxes in the phase files.
- **Git:** trunk-based, `phase/*` branches, PR per phase, merge commits only, human merges and tags; agents commit (green, explicit paths) and may push `phase/*`, `fix/*`, `docs/*` branches (never `main`, never forced); **no agent name anywhere in git** (D-013). Enforced mechanically by git hooks (any agent), Claude Code permission rules, CI, and GitHub branch protection once the repo's plan allows it (D-014).
- **Quality:** ten measurable gates (G1–G10), architecture invariants as tests (the plan's hard rules, executable), sabotage checks for the correctness-critical phases, cross-agent review.
- **Prompts:** six copy-paste prompts (`docs/PROMPTS.md`): resume, implement phase, implement task, independent review, fix failures, hand over.

## 2. Verified facts, assumptions, recommendations

**Verified this session**
- `plan.md`: 1,807 lines / 94,549 bytes, v2.1; 15 features (F1–F15), 13 phases, 120 evaluation scenarios, 7 defenses. Too large to load per session (≈ 80k tokens) → phase files name the sections to read.
- Folder: only `plan.md` existed; it is **not a git repository**.
- Machine (Windows 10 Pro): git 2.45.2 ✔ · Docker 29.7.2 ✔ (daemon state not checked) · Node 22.12.0 ✔ · **Python 3.13 and 3.14 only (plan: 3.11)** · **`make` ✘** · **`gh` ✘** · `uv` ✘.
- `plan.md` was last modified 15 Oct 2026 18:06 (+06), i.e. after the hackathon start (12:01 AM IST = 00:31 +06).
- Time left at 18:14 (+06): until 19 Oct 00:29 (+06) = **~78 h wall-clock**.
- Claude Code docs: `CLAUDE.md` supports `@AGENTS.md` imports (recommended over symlinks on Windows); instructions are context, not enforcement; permission rule order is deny → ask → allow; Bash rules are not a security boundary; target < 200 lines.
- Antigravity docs: workspace rules come from `AGENTS.md`, `GEMINI.md` or `.agents/rules/*.md`; `AGENTS.md` is read on every surface; 24 KB per file; precedence between `GEMINI.md` and `AGENTS.md` is **not documented** → this repo ships no `GEMINI.md`.
- From you: remote is `https://github.com/sakibul-shovon/pathwarden.git`.

**Not verified (do not rely on):** hook behaviour (my scratch-repo test was declined — P0-T1 tests them in your real clone) · CI (never run) · winget package ids · every FalkorDB/MCP/LiteLLM behaviour (P0/P8/P9 probes) · that Antigravity loads `AGENTS.md` in your build (getting-started step 7 checks) · whether the remote is empty/public.

**Assumptions:** API port 8000; env var names `PW_FALKORDB_*`; the checkpoint schedule in `PROGRESS.md`; local time zone +06.

## 3. Project analysis

**What it is.** A graph-native defence against cross-agent, cross-session "toxic flows": FalkorDB stores lineage of every artifact; a deterministic gate checks "does this payload descend from untrusted AND secret sources?"; a Forensic Agent quarantines and heals; max-flow computes cheapest permission cuts; an MCP gateway makes it drop-in; an evaluation harness measures it honestly.

**Components → phases.** Graph + runtime (P1) → gate (P2) → agents/orchestrator/API (P3) → forensics (P4) → evaluation (P5) → remediation (P6) → time travel (P7) → live LLM (P8) → MCP (P9) → UI (P10a–c) → tenancy (P11) → ship (P12). Full feature and section coverage tables: `docs/phases/README.md`. **Nothing from F1–F15 or §1–§27 is dropped.**

**Constraints that shape the process.** Plan rules 1–13 (no invented FalkorDB/SDK APIs, all Cypher in named files, gate never reads content, fail closed, fake secrets only, no key needed for tests, no new dependencies, probe SDKs first). They are enforced where possible by tests (`tests/test_invariants.py`) rather than by trust.

**Where correctness risk concentrates.** The sanitized-vs-approved exclusion logic (P2), quarantine reach (P4: must not quarantine sanitized descendants), max-flow cut extraction (P6), generator exactness and determinism (P5). These phases get sabotage checks and a second agent's review.

## 4. Phase plan (summary — details in `docs/phases/`)

| Order | Phase | Tier | Outcome that is verifiable |
|---|---|---|---|
| 1 | P0 Probe and skeleton | 1 | `make probe` PASS or recorded fallbacks; CI green; hooks proven |
| 2 | P1 Graph, runtime, replay | 1 | lineage tests; ids/clock survive restart; replay builds expected edges |
| 3 | P2 Gate | 1 | HOLD/ALLOW/BLOCK semantics; content-agnostic; sabotage-checked |
| 4 | P3 Scripted agents + core API | 1 | six demo scenarios give plan verdicts; fake secret leaks with guard off |
| 5 | P4 Forensics + healing | 1 | quarantine → sandbox → clean release via HTTP |
| 6 | **P10a UI Run + Investigate** | 1 | the core story clickable in a browser |
| 7–9 | P5 Eval · P6 Remediation · P7 Time travel | 2 | `make eval` ×2 identical · verified cuts · sleeper replay |
| 10–11 | P10b, P10c UI | 2 | full demo clickable end-to-end |
| 12 | P8 Live LLM | 3 | live run, B1/B3, live study (needs your key) |
| 13 | P9 MCP | 3 | same attack held through the gateway |
| 14 | P11 Multi-tenancy | 3 | cross-tenant isolation, human-endpoint guard |
| 15 | P12 Ship | 1 | final checklist, public repo, video, submission |

Tier 3 is the first thing a human may cut if time runs out (D-010). P6 can run in a separate worktree beside P1–P5.

## 5. Plan issues found (details and proposed fixes: `DECISIONS.md` Part B)

I did not edit `plan.md`. Highest impact first:
- **A-08** `make eval` must be byte-identical, yet metrics include wall-clock latency → split latency into a separate file.
- **A-09** Time-travel markers need artifact-level taint but rule 1 forbids new Cypher → compute in Python from existing queries (needs your OK).
- **A-07 / A-12** Which endpoints are "human-only", whether remediation/eval endpoints are tenant-scoped, and what `api_keys.yaml` contains.
- **A-11** Compose runs `mock-upstreams` as a service, but `gateway.yaml` says the gateway spawns upstreams over stdio.
- **A-01 / A-02 / A-06** Constructor signature mismatch in §9; `Runtime.approve` needs `q2d` (a P2 query); `explain` needs `q3/q6/q6b` before P4.
- **A-03 / A-04 / A-05** `policy.yaml` values and `policy_version` are never wired/defined; `make demo` is undefined.
- **A-13 / A-14 / A-15 / A-16** Missing: env var names, LLM provider/key, license, hosted-FalkorDB capability (`GRAPH.COPY`, `algo.maxFlow`), UI test tooling.
- **Rule 12 vs your quality request:** no formatter/linter is in the approved stack → D-006.

## 6. Risks and mitigations

| # | Risk | Mitigation |
|---|---|---|
| R1 | ~78 h for 13 phases / 15 features | tiers, early UI (P10a), feature freeze 18 Oct 12:00 (+06), P12 started on time, human-owned cut decision |
| R2 | Python 3.11 and `make` missing → P0 blocked | install first (D-007/D-008); both are one-line installs |
| R3 | FalkorDB behaves differently from the plan's Cypher | P0 probe with *value* assertions; fallbacks recorded before P1 |
| R4 | Subtle logic bugs in gate/quarantine/min-cut | invariants as tests, sabotage checks, cross-agent review |
| R5 | Agents inventing FalkorDB/MCP/LiteLLM APIs | rules 1 and 13, probes, `tests/test_invariants.py` |
| R6 | Non-reproducible evaluation | G7 byte-compare, no wall-clock in outputs, sorted iteration |
| R7 | Hosted FalkorDB lacks `GRAPH.COPY` / `maxFlow` | probe the hosted endpoint early (A-15); keep local path + video as fallback |
| R8 | Secret leak / GitHub push protection blocks the repo | fake-secret format, `scan_secrets.sh` in hook and CI, `.env` gitignored and denied to agents |
| R9 | Tool switching loses state or two agents collide | HANDOFF baton + verification protocol, one writer per working tree |
| R10 | Context overflow from the 94 KB plan | phase files list only the sections to read; `plan.md` never imported |
| R11 | UI cannot be regression-tested (no tooling in stack) | strict `tsc` build gate + recorded manual checklists; ask before adding Vitest |
| R12 | LLM cost / nondeterminism / no key | fake LLM for tests; `make eval-live` is `ask`; live results reported as they are |
| R13 | Windows quirks (CRLF, shell, symlinks) | `.gitattributes` LF, `SHELL := bash`, Git Bash, `@AGENTS.md` import instead of symlink |
| R14 | Private repo: no server-side branch protection / push protection (likely, on GitHub Free) | local hooks + deny rules + human-only merge; make the repo public early or by P12-T6 (D-014) |
| R15 | Groq free-tier rate/token limits throttle the live study and the B3 full-trace judge | measure in the P8 probe, add backoff, run `make eval-live` only with your OK, report any reduction openly |
| R16 | Docker Desktop daemon not running | start it before `make up`; P0 acceptance runs from a started daemon |

## 7. Decisions

**Answered by the human on 2026-10-15** (recorded in `DECISIONS.md`):

| Question | Answer | Recorded as |
|---|---|---|
| `ruff` as dev-only dependency | approved | D-006 Accepted |
| Install Python 3.11 and `make` | yes (human installs; not done yet) | D-007, D-008 Accepted |
| Remote empty and public? | **private**; emptiness not stated | D-014 Open |
| Agent push authority | agents may push, **without any agent name** in git | D-005 revised, D-013 Accepted |
| LLM provider / license | **Groq**; license not stated | A-14 partly answered |
| Cut line (tiers) | confirmed | D-010 Accepted |

**Later the same day the human also approved** D-001…D-004, D-009, D-011, D-012 and every proposed resolution in `DECISIONS.md` Part B ("approve all"), and asked the agent to do the git/GitHub and tool-install steps itself. The remote was checked: reachable and empty.

**Still open:**
1. **D-014** — when to make the repo public (unlocks free branch protection and push protection; required before submission).
2. **A-14** — Groq model name, the key (local `.env` only, needed for P8), and the repo license (needed before P12-T6).
3. **Merge delegation** — D-004/D-005 keep merge + tag human-only; the human may delegate them to the agent.

## 8. Repository layout and file purposes (created now)

```
AGENTS.md                      canonical rules for every agent (plan §4 verbatim + engineering/git/tracking rules)
CLAUDE.md                      @AGENTS.md + Claude Code notes
plan.md                        requirements (unchanged)
.gitignore  .gitattributes     secrets/junk exclusion · LF line endings (hooks/Makefile break on CRLF)
.env.example                   documented config names; real .env is gitignored and denied to agents
.claude/settings.json          Claude Code: attribution off; allow push of phase/fix/docs branches; deny force-push/reset/clean/--no-verify/.env; ask on merge/rebase/restore/stash/tag
.githooks/pre-commit           no commits on main (except root), runs secret scan
.githooks/commit-msg           enforces  P<n>[a-d]: <type>(<scope>): <summary>
.githooks/pre-push             blocks push to main, forced/non-fast-forward pushes, remote deletes
scripts/scan_secrets.sh        provider-shaped keys, tracked .env, values from local .env — used by hook and CI
.github/workflows/ci.yml       jobs repo-hygiene, api (FalkorDB service); web job ready to enable in P10a
.github/pull_request_template.md   evidence-based PR checklist
docs/WORKFLOW.md               operating manual: protocol, tracking, handoff, git policy, gates
docs/PROMPTS.md                reusable prompts + diff-review checklist
docs/PROGRESS.md               dashboard, evidence log, issues, gaps, session log
docs/HANDOFF.md                baton, overwritten each stop
docs/DECISIONS.md              D-001…D-012 proposals, A-01…A-16 plan ambiguities, probe results
docs/phases/README.md          order, tiers, dependency graph, feature + section coverage
docs/phases/P*.md              15 phase specs
docs/BLUEPRINT.md              this review document
```
Created later by phases (not now): `pyproject.toml`, `Makefile`, `docker-compose.yml`, `api/`, `fixtures/`, `eval/`, `web/`, `tests/`, `mock_upstreams/`, `README.md`.
Deliberately *not* created: `GEMINI.md` (undocumented precedence), `CHANGELOG.md`/`TESTING.md`/`TASKS.md` (would duplicate git log, the evidence log, and the phase checklists), `.cursor/` or other per-tool configs, a `develop` branch.

## 9. Getting started (exact sequence)

**0. Review** this document; answer §7; set statuses in `DECISIONS.md`.

**1. Install missing tools** (PowerShell). The three package ids were confirmed with `winget search` on this machine (Python 3.11.9, make 4.4.1, GitHub CLI 2.102.0); `winget.exe` was not on PATH in the agent shell, so if `winget` is not found in yours, run it as `& "$env:LOCALAPPDATA\Microsoft\WindowsApps\winget.exe" install …`:
```powershell
winget install Python.Python.3.11
winget install ezwinports.make
winget install GitHub.cli               # optional: PRs and branch settings from the terminal; then `gh auth login`
```
Reopen the terminal, **start Docker Desktop**, then verify: `py -3.11 --version` · `make --version` · `docker info` · `git --version`.

**2. Check the remote is empty** (the repo is private, so this uses your stored GitHub login): `git ls-remote https://github.com/sakibul-shovon/pathwarden.git`. No output = empty. If it lists refs, stop and tell me — do not force anything.

**3. Initialise and make the root commit** (Git Bash):
```sh
cd /g/Projects/Pathwarden
git init -b main
git remote add origin https://github.com/sakibul-shovon/pathwarden.git
git config core.hooksPath .githooks
git add -- plan.md AGENTS.md CLAUDE.md .gitignore .gitattributes .env.example .claude/settings.json .githooks scripts/scan_secrets.sh .github docs
git update-index --chmod=+x .githooks/pre-commit .githooks/commit-msg .githooks/pre-push scripts/scan_secrets.sh
git status -sb                      # review: no .env, nothing unexpected
git commit -m "P0: chore: bootstrap agent workflow and plan"
```
The hooks run for the first time here (untested until now). If one misbehaves, tell me — do not use `--no-verify`.

**4. One-time push of the root commit to `main`** (the pre-push hook blocks `main` otherwise; this is the documented human exception):
```sh
PW_ALLOW_MAIN=1 git push -u origin main
```
CI runs; `repo-hygiene` must pass, `api` steps are skipped until `pyproject.toml` exists.

**5. GitHub settings (browser)** — after the first CI run, details in `docs/WORKFLOW.md` §6.7. While the repo is private, Settings → Branches / Code security may simply not offer these options (D-014); making the repo public unlocks them: make the repo public · protect `main` (PR required, checks `repo-hygiene` and `api`, no force-push/deletion) · Code security: secret scanning + push protection + Dependabot alerts · Pull Requests: allow merge commits only.

**6. Start P0.** In Claude Code or Antigravity, open the folder and paste prompt 1 (*Start or resume*) then prompt 2 with `{PHASE}` = `P0` from `docs/PROMPTS.md`. The agent creates `phase/p0-skeleton`.

**7. Check the rules actually loaded.** Claude Code: `/status` should list the project settings; ask "What are hard rules 3 and 7?". Antigravity: ask the same; if it cannot answer, copy `AGENTS.md` into `.agents/rules/pathwarden.md` (documented location; remember to keep it in sync).

**8. Each phase:** agent works → `VERIFYING` → PR → CI green → (P2/P4/P5/P6) review by a *different* agent (prompt 4) → you merge with a **merge commit** → tag `phase-p<n>-done` → `PROGRESS.md` DONE. When switching tools: agent runs prompt 6, you open the other tool and paste prompt 1.

## 10. Day-to-day loop

```
read HANDOFF → verify vs git + make test → pick first unticked task → test first → implement → make test
   → tick box + evidence → commit (P<n>: type(scope): …) → … → all tasks → gates G1–G10 → VERIFYING → PR
   → CI + review → human merge + tag → next phase        (stop anywhere: overwrite HANDOFF, never leave an unexplained red tree)
```

## 11. Honest limits of this setup

Hooks and permission rules catch the common forms of risky git use; they are not a security boundary (the Claude Code docs say the same). A determined or confused agent can still bypass them; the rules, the PR/CI gate and your review are the real protection. Nothing in this blueprint has been executed against a real repository yet — P0 is where that changes.
