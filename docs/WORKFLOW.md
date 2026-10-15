# Pathwarden — engineering workflow

Procedures behind `AGENTS.md`. Every agent (Claude Code, Antigravity, others) follows the same ones.
Requirement levels: **[MUST]** mandatory repository rule · **[SHOULD]** recommended practice, deviate only with a reason in `DECISIONS.md` · **[MAY]** optional, depends on team size/time.

## 1. Document map

| File | Purpose | Written by | Changes |
|---|---|---|---|
| `plan.md` | Requirements, source of truth | Human only | Rarely; agents never edit it |
| `AGENTS.md` / `CLAUDE.md` | Rules every agent loads | Human (agents propose via DECISIONS) | Rarely |
| `docs/phases/P*.md` | Phase spec: scope, tasks (checkboxes), tests, acceptance, DoD | Human-approved; agents tick boxes | Boxes often, text rarely |
| `docs/PROGRESS.md` | Phase dashboard, evidence log, known issues/gaps, session log | Every agent | Every session |
| `docs/HANDOFF.md` | The baton: exact state + next action. **Overwritten** each stop | Every agent | Every stop |
| `docs/DECISIONS.md` | Decisions and open plan ambiguities (ADR-lite) | Every agent | When a choice is made |
| `docs/BLUEPRINT.md` | Review-time analysis of the plan and this workflow | Setup only | Archive after approval |
| `docs/PROMPTS.md` | Copy-paste prompts for each situation | Human | Rarely |
| `.githooks/`, `.claude/settings.json`, `.github/` | Mechanical enforcement | Human-approved | Rarely |

There is deliberately no `CHANGELOG.md` or `TESTING.md`: `git log` (every commit is `P<n>: …`) is the changelog, and test results are the *Evidence log* in `PROGRESS.md`. Fewer files means fewer places to drift.

## 2. Agent operating protocol

### A. Before implementation [MUST]
1. Run the `AGENTS.md` §1 checklist (git state → HANDOFF → PROGRESS → phase file → listed plan sections).
2. Verify the handoff (§5.2) if the previous session was another agent or you cannot vouch for it.
3. Confirm prerequisites of the active phase are DONE in `PROGRESS.md` and their tags exist (`git tag -l 'phase-*'`).
4. Pick the **first unticked task** of the phase file unless HANDOFF names another. Never skip ahead.
5. Write the 3–5 line restatement (what, which tests prove it, what is out of scope). For a whole phase kickoff or anything touching > ~5 files, write a short task plan first and show it before editing.

### B. During implementation [MUST]
1. Stay inside the task's files and the phase's scope. Unrelated problems go to *Known issues* in `PROGRESS.md`, not into your diff.
2. Test-first for logic: write the failing test from the phase's test list, then the code.
3. Validate incrementally: run the narrowest relevant test after each change, `make test` before each commit.
4. Follow the plan literally for names, signatures, queries and formats. Where the plan is silent, choose the simplest option, record it in `DECISIONS.md`, and carry on; where the plan is *ambiguous or contradictory* in a way that could change behaviour, stop and ask (§2.D).
5. Preserve existing user changes. Never "tidy" files you were not asked to touch.
6. Commit at every green, logically complete step (see §6.3). Do not let work pile up uncommitted.

### C. After implementation [MUST]
1. Run the gates (§7) that apply. Fix failures; never mark a task done on a red gate.
2. `git diff` and `git diff --cached`: look for unrelated edits, debug output, leftover TODOs, secrets, accidentally staged files.
3. Verify each acceptance criterion; record command + real result in the Evidence log.
4. Tick the task boxes, update the `PROGRESS.md` phase row, overwrite `HANDOFF.md`.
5. Propose (or make, if authorised) the checkpoint commit. State the exact next task and its prerequisites.

### D. Stop-and-ask protocol [MUST]
Triggers are listed in `AGENTS.md` §6. Procedure: (1) stop editing; (2) leave the tree in a safe state (green + committed, or clean-ly described in HANDOFF); (3) write the question, the options you see and your recommendation under *Blocked / questions* in HANDOFF; (4) end the turn with that question. Do not guess and continue.

### E. Honest reporting [MUST]
- "Verified" = you ran it in *this* session and saw the output. "Reported" = taken from a handoff or a log. Label which is which.
- If a test fails, say so with the output. If you skipped a step, say so. Never report a push, merge, CI result or deployment you did not observe.
- A task that is partly done is *in progress*, not done. Stubs and TODOs are listed under *Known gaps*.

## 3. Phase lifecycle

States in the `PROGRESS.md` dashboard: `NOT_STARTED` → `IN_PROGRESS` → `VERIFYING` → `DONE` (or `BLOCKED` with a reason).

| Transition | Requires |
|---|---|
| NOT_STARTED → IN_PROGRESS | all prerequisite phases DONE; branch `phase/p<n>-<slug>` created from up-to-date `main` |
| IN_PROGRESS → VERIFYING | every task box ticked; `make test` green |
| VERIFYING → DONE | all gates G1–G10 pass, every acceptance criterion has evidence, DoD checked, PR merged to `main` (merge commit), human tags `phase-p<n>-done` |
| any → BLOCKED | an entry under *Blocked / questions* in HANDOFF and the reason in the dashboard |

`phase-p<n>-done` tags are the **last known good** points. A fresh agent can always `git diff phase-p<n-1>-done..HEAD --stat` to see what a phase changed.

## 4. Progress-tracking rules

### 4.1 Update table [MUST]

| Event | Update |
|---|---|
| Task finished and its gate green | tick the box in the phase file; append Evidence row |
| Any test / gate run you rely on | Evidence row (command, exit code, counts, date-time) |
| Design choice, plan gap, probe outcome | `DECISIONS.md` entry |
| Bug / debt / stub found but not fixed | `PROGRESS.md` → *Known issues* or *Known gaps* (with id, file, impact) |
| Commit made | nothing extra — but HANDOFF "Git state" must show the new HEAD at the next stop |
| Phase started / verifying / done / blocked | `PROGRESS.md` dashboard row |
| Every stop (planned, tool switch, token/context exhaustion, interruption) | overwrite `HANDOFF.md`; append one *Session log* line |

If you may be cut off (long task, low context), update HANDOFF **before** the risky step, not after.

### 4.2 Evidence rules
- One row per claim: `date-time | task | command | exit | result | agent`. Paste counts from the real output (`142 passed`), not adjectives.
- Evidence older than the last commit that touched the relevant code is *stale*; re-run before the phase goes to VERIFYING.
- Test output that disagrees with the tracker wins; fix the tracker.

### 4.3 Task ids
`P<n>-T<k>` (e.g. `P2-T4`). Defined once in the phase file. Commits, evidence rows, HANDOFF and PR descriptions reference them.

## 5. Agent handoff protocol

### 5.1 Sending side — at every stop [MUST]
Overwrite `docs/HANDOFF.md` from its template. It must let a fresh agent resume with no chat history: branch and HEAD, dirty files (verbatim `git status -sb`), active phase/task, what was done, partially done work with file paths and what remains, exact commands run and their real results, blockers, decisions made (ids), traps discovered, and **one exact next action**.
Leave the tree either clean-and-committed or fully described. Do not leave failing tests unexplained.

### 5.2 Receiving side — trust nothing, verify [MUST]
Truth hierarchy: **git state and code > test output you ran yourself > PROGRESS.md > HANDOFF.md > chat summaries.**
1. `git status -sb`, `git branch --show-current`, `git log --oneline -10`; compare with HANDOFF "Git state".
2. Mismatch → believe git; write the discrepancy under "Takeover notes" in the new HANDOFF.
3. Files modified but not listed as the previous agent's work belong to the human: do not touch.
4. Run `make test`. Compare with the recorded result. Red where HANDOFF said green → the first task is to diagnose that, not to add features.
5. Re-run the acceptance check of the last ticked task (spot check).
6. Only then continue with the "Next action".

### 5.3 Switching tools
Outgoing agent: finish with §5.1. Human: close the outgoing tool (one writer per working tree), open the new tool, paste the *Resume* prompt from `docs/PROMPTS.md`. No state lives in any tool's memory — the repository is the memory.

## 6. Git and GitHub policy

Remote: `origin` = `https://github.com/sakibul-shovon/pathwarden.git` (given by the human; visibility and current contents not yet verified — check with `git ls-remote origin` before the first push).

### 6.1 Model — trunk-based with phase branches [MUST]
- `main` is always green and always the last merged phase (or sub-phase). **No `develop` branch** — one developer plus agents, ~3 days, no staging environment: a second long-lived branch only adds sync work. [MAY] introduce it if more people join.
- All work happens on short-lived branches off an up-to-date `main`.

### 6.2 Branches [MUST]
| Pattern | Use |
|---|---|
| `phase/p<n>[a-d]-<slug>` | implementing a phase (`phase/p2-gate`, `phase/p10a-ui-run-investigate`) |
| `fix/<slug>` | bug fix after a phase merged (`fix/p2-witness-order`) |
| `hotfix/<slug>` | urgent repair of `main` or the deployed demo; minimal diff; same PR + CI rules |
| `refactor/<slug>`, `docs/<slug>`, `chore/<slug>` | only when explicitly requested; keep them tiny |

Parallel work [MAY]: only with `git worktree add ../pathwarden-<slug> -b phase/p<n>-<slug> main`, one agent per worktree, test graphs uniquely named (`pw_test_<random>`) because worktrees share one FalkorDB. Only P6 is independent enough to run beside the main line (see `docs/phases/README.md`).

### 6.3 Commits [MUST]
- Format: `P<n>[a-d]: <type>(<scope>): <summary>` — types `feat fix test refactor docs chore ci perf`; scope optional (`api`, `runtime`, `gate`, `web`, `eval`, `queries`, `docs`…); imperative, ≤ 72 chars; body explains *why* when not obvious. Enforced by `.githooks/commit-msg`. Merge/Revert commits are exempt.
- Small and logical: one concern per commit; tests and the code they cover go together; a commit never leaves `make test` red.
- Stage explicit paths. Read `git diff --cached` before every commit. Never commit: secrets, `.env`, generated junk (`state/`, caches), unrelated edits, failing tests, commented-out code.
- [SHOULD] Commit at least once per task. The hackathon requires *incremental* commits; a single end-of-phase commit is a process failure.
- [MUST] No agent attribution in git (D-013): no `Co-Authored-By`, "Generated with …" or tool/model names in commit messages, PR text or branch names, and no agent identity as author (never change `git config user.*`). [SHOULD] log tool + model in the PROGRESS session log instead; that log and the README disclosure (plan §24.5) are where AI assistance is documented.
- Never `--no-verify`, never edit commit dates, never amend or rebase pushed commits.

### 6.4 Authority matrix [MUST]

| Action | Agent | Human |
|---|---|---|
| read-only git (`status`, `diff`, `log`, `show`, `fetch`) | always | ✔ |
| create/switch branch off `main` | ✔ | ✔ |
| stage explicit paths, commit on a non-main branch | ✔ (green gates; plan §4) | ✔ |
| push a `phase/*`, `fix/*`, `docs/*` branch (never `main`, never forced, never tags) | ✔ standing authorisation (D-005), gates green; the prompt may withdraw it with `PUSH: no` | ✔ |
| open a PR | only if the prompt says `PR: yes` (needs `gh`, otherwise human) | ✔ |
| merge a PR (merge commit), create `phase-p<n>-done` tag, delete branches, change repo settings | **no** | ✔ |
| push to `main` | **never** (bootstrap exception: human with `PW_ALLOW_MAIN=1`) | rarely |
| force-push, `reset --hard`, `clean`, `checkout --`/`restore` of worktree files, `stash drop`, `branch -D`, rebase/amend of pushed commits, history rewrite | **no**, unless the human names the exact target in the current session | ✔ with care |
| set `PW_ALLOW_MAIN` / `PW_ALLOW_FORCE`, use `--no-verify` | **never** | ✔ |

`.claude/settings.json` denies or asks for the risky rows in Claude Code; `.githooks/` enforces commit/push rules for *every* agent. Neither is a security boundary — they catch the common forms. The rules above bind regardless.

### 6.5 Pull requests and merging [MUST]
1. One PR per phase (or sub-phase), from `phase/…` into `main`, using `.github/pull_request_template.md`.
2. Required before merge: CI `repo-hygiene` and `api` green (and `web` after P10a), all acceptance criteria evidenced in the PR, tracking files updated.
3. [SHOULD] For the correctness-critical phases (P2 gate, P4 forensics, P5 evaluation, P6 remediation) a **different agent** reviews the PR with the review prompt in `docs/PROMPTS.md` and reports findings before the human merges.
4. Merge method: **merge commit** only (no squash, no rebase-merge) so the incremental history survives. Configure GitHub → Settings → General → Pull Requests accordingly.
5. After merge the human tags `phase-p<n>-done` on `main`, and `PROGRESS.md` marks the phase DONE.

### 6.6 Sync, conflicts, failures [MUST]
- Start of work: `git fetch origin`; `git status -sb`; branch from `origin/main`. If `main` moved while you work: `git merge origin/main` into your branch (no rebase of anything already pushed), re-run the gates.
- Conflicts: stop and resolve file by file by reading both sides. Never blanket `--ours`/`--theirs`, never `checkout --theirs .`. In tracking docs keep both sides' facts, then re-verify the claims. After resolving, run **all** gates.
- Integration failure after merge: do not patch on `main`. Branch `fix/…` (or `hotfix/…`), add a regression test, PR. If `main` is broken and the cause is unclear, the human may revert the merge commit (`git revert -m 1 <merge>`) — never reset.
- Verify remote operations: after a push, `git fetch origin` then compare `git rev-parse HEAD` with `git rev-parse origin/<branch>`; say "CI not verified" unless you saw it.

### 6.7 Repository protection and security
**The repository is currently private (D-014).** As far as I know, GitHub Free does not offer branch protection, rulesets, secret scanning or push protection on private repos; check Settings → Branches / Code security to see what your plan allows. While those are unavailable, the *local* guards (`.githooks/`, Claude Code deny rules) and your discipline as the only merger are the protection, so agents must never push to `main` and you merge only after CI is green. The repo must be public before submission (plan §24.6, P12-T6); making it public earlier unlocks the server-side protections below for free.

One-time GitHub setup (human) — [MUST] for items 1–3 once available, [SHOULD] for 4:
1. **Branch protection on `main`** (Settings → Branches → rule for `main`): require a pull request (0 approvals is fine solo), require status checks `repo-hygiene` and `api`, block force pushes, block deletions. `gh` is not installed on this machine; use the web UI, or after `winget install GitHub.cli` and `gh auth login`:
   ```sh
   gh api -X PUT repos/sakibul-shovon/pathwarden/branches/main/protection --input - <<'EOF'
   {
     "required_status_checks": {"strict": false, "contexts": ["repo-hygiene", "api"]},
     "enforce_admins": false,
     "required_pull_request_reviews": {"required_approving_review_count": 0},
     "restrictions": null,
     "allow_force_pushes": false,
     "allow_deletions": false
   }
   EOF
   ```
   Status-check names must match the CI job names; the check only becomes selectable after it has run once.
2. **Code security** (Settings → Code security): enable secret scanning, push protection, Dependabot alerts (free on public repos).
3. **Pull Requests**: allow merge commits; disable squash merging and rebase merging.
4. [SHOULD] Delete head branches after merge.

Local secrets protection [MUST]: `git config core.hooksPath .githooks` once per clone (a `make hooks` target in P0 does it); `.gitignore` already excludes `.env*` (except `.env.example`). `scripts/scan_secrets.sh` runs in the pre-commit hook and in CI.

Config separation [MUST]: *local* = gitignored `.env`; *CI* = workflow env, no real secrets needed (tests need none); *hosted* = platform environment variables with `PW_AUTH=on` and keys that never enter the repo. [MAY] a staging environment — not planned for this hackathon.

Dependency hygiene [SHOULD]: add dependencies only with approval (rule 12); Dependabot alerts on; run `npm audit --omit=dev` once in P12 and record the result.

### 6.8 One writer per working tree [MUST]
Two agents editing the same folder at once corrupts both. Finish with the stop checklist before switching tools.

## 7. Quality gates

Gates are commands with exit codes, not opinions. A task is not done, and a phase not VERIFYING, until the applicable gates pass *this session*.

| Gate | Check | Command / evidence | Applies |
|---|---|---|---|
| G1 Tests | whole suite green, no LLM key, no network beyond localhost | `make test` (with `PW_LLM_*` unset) | always |
| G2 Lint/format | clean | `make lint` (tool per D-006) | always, once defined |
| G3 Types/build | strict TS compiles and bundles | `npm run build` in `web/` | phases touching `web/` |
| G4 Invariants | static architecture rules hold | `pytest tests/test_invariants.py` | always (grows per phase, see below) |
| G5 Secrets | nothing credential-shaped, no `.env` tracked | `sh scripts/scan_secrets.sh` | always |
| G6 Acceptance | each criterion verified with evidence | Evidence log row per criterion | phase end |
| G7 Determinism | two consecutive runs give byte-identical outputs | phase file names the command; `diff`/`cmp` result | P3, P5, P6 (and any deterministic output) |
| G8 Diff review | no unrelated edits, secrets, debug output, dead code, placeholders-as-done, duplicated logic | read `git diff` against the checklist in `PROMPTS.md` | every commit |
| G9 Tracking | phase file, PROGRESS, HANDOFF, DECISIONS updated | `git diff docs/` shows it | every stop |
| G10 CI | `repo-hygiene` + `api` (+ `web`) green on the PR | CI page, or "not verified" | before merge |

`tests/test_invariants.py` (G4) turns the plan's hard rules into tests. It starts in P0 and each phase extends it:
P0 no `apoc.`/`gds.`/Neo4j-only tokens in `*.cypher`, no credential-shaped strings, no Cypher keywords inside Python string literals outside `api/graph/` · P1 every `*.cypher` file is loaded by some code path and every loaded name exists · P2 no `.content` in `q2*`–`q8*`, no LLM imports in `api/runtime/gate.py` or `api/forensics/` · P4 no `content` key in any forensic tool output (recursive) · P5 eval outputs contain no wall-clock fields (A-08) · P11 every mutating human endpoint rejects a request without `X-PW-Human`.

Test-quality rules [MUST]
- Test behaviour through public seams (runtime calls, HTTP, `make` targets), against real FalkorDB. Do not assert private helper calls or the text of a query.
- Each acceptance criterion in a phase file maps to at least one test or one recorded manual check.
- Negative paths count: unknown tool, missing provenance, quarantined input, malformed LLM JSON, empty results.
- [SHOULD] **Sabotage check** for P2, P4, P6: temporarily break the behaviour (e.g. stop excluding sanitized nodes in q2a) and confirm the relevant test fails; record it in Evidence. This catches vacuous tests.
- Flaky tests are bugs: fix or delete with a DECISIONS entry; never retry-until-green.

Anti-patterns a reviewer rejects: stub or `pass` shown as complete · hard-coded expected results (rule 11) · tests that restate the implementation · copy-pasted Cypher or logic that belongs in one place · swallowed exceptions · unverified new dependency · "fixed" by loosening an assertion · scope creep.

## 8. Verification cheatsheet

| Question | Command |
|---|---|
| Where am I? | `git status -sb && git branch --show-current && git log --oneline -5` |
| What changed in this phase? | `git diff --stat main...HEAD` · `git diff phase-p<n-1>-done..HEAD --stat` |
| Is the suite green? | `make test` |
| Does FalkorDB behave as the plan assumes? | `make probe` |
| Secrets clean? | `sh scripts/scan_secrets.sh` |
| Is a push really there? | `git fetch origin && git rev-parse HEAD origin/<branch>` |
| What did the previous agent claim vs. leave? | `docs/HANDOFF.md` vs. the first four rows above |
| Which phases are done? | `docs/PROGRESS.md` dashboard + `git tag -l 'phase-*'` |
