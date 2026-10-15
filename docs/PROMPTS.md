# Reusable prompts

Paste into Claude Code, Antigravity or any agent. They assume nothing about earlier chats: the repository is the memory.
Replace `{PHASE}`, `{TASK}`. The **Authorisations** line states the Git rights for the session; the defaults are the standing rules in D-005 (commit on a phase branch: yes · push `phase/*`/`fix/*`/`docs/*`: yes · PR: no · merge/tag: human). Change a value to restrict or extend them. Git never carries an agent name (D-013).

---

## 1. Start or resume a session (use this first, in every tool)

```
You are working on the Pathwarden project in this repository. You have no chat history; the repo is the memory.

1. Read AGENTS.md completely. Its rules are binding.
2. Run: git status -sb ; git branch --show-current ; git log --oneline -10
3. Read docs/HANDOFF.md, then docs/PROGRESS.md. Treat HANDOFF.md as a CLAIM and verify it as described in
   docs/WORKFLOW.md section 5.2 (compare git state, run `make test` for a baseline).
4. Read the active phase file docs/phases/P<n>-*.md and ONLY the plan.md sections it lists.
5. Before editing anything, report: (a) discrepancies between HANDOFF.md and the real repo, (b) the baseline test result,
   (c) the task you will do next and the tests that prove it, (d) any blocker.
   If there are discrepancies you cannot explain or any blocker, STOP and report. Otherwise continue with the next task.

Authorisations this session: COMMIT: yes (green checkpoints, phase branch only) | PUSH: yes (phase/fix/docs branches only) | PR: no
Never read or print .env. Do not exceed the authorisations above. No agent/tool names in commits or PR text.
```

## 2. Implement a whole phase

```
Implement phase {PHASE} exactly as specified in docs/phases/{PHASE}-*.md. First run prompt 1's checks.

Work through the phase's tasks in order. For EACH task:
  - restate in 3-5 lines what you will build and which tests prove it; stay inside the phase's files and scope;
  - write the failing test first, then the code; run the narrowest tests, then `make test`;
  - tick the task box and add an Evidence row in docs/PROGRESS.md ONLY after the gate is green;
  - commit with `P<n>: <type>(<scope>): <summary>` (stage explicit paths, read `git diff --cached`).
Use plan.md as the source of truth for names, signatures, queries and formats. Never invent FalkorDB syntax, client methods or
SDK APIs. If the plan is ambiguous or a probe fails, apply AGENTS.md section 6 (stop and ask) — do not guess.

When all tasks are done: run gates G1-G10 (docs/WORKFLOW.md section 7), verify EVERY acceptance criterion with real output,
set the phase to VERIFYING in PROGRESS.md, overwrite docs/HANDOFF.md, and write the PR description from
.github/pull_request_template.md into docs/HANDOFF.md. Do not start the next phase.

Authorisations this session: COMMIT: yes | PUSH: yes (phase/fix/docs branches only) | PR: no
After any push, verify it (git fetch origin; compare git rev-parse HEAD with origin/<branch>) before saying it succeeded.
Report honestly: failed tests, skipped steps and unverified claims must be stated as such.
```

## 3. Implement one task

```
Do task {TASK} from docs/phases/{PHASE}-*.md and nothing else. Run prompt 1's checks first.
Restate the task and its proving tests, write the failing test, implement, run `make test`, review `git diff`, tick the box with
an Evidence row, commit (`P<n>: <type>(<scope>): <summary>`), overwrite docs/HANDOFF.md with the exact next action.
Out-of-scope problems go to "Known issues" in docs/PROGRESS.md, not into this diff.
Authorisations this session: COMMIT: yes | PUSH: yes (phase/fix/docs branches only) | PR: no
```

## 4. Independent review (use a DIFFERENT agent from the implementer; read-only)

```
You are an independent reviewer for phase {PHASE} of Pathwarden. Do NOT edit files and do NOT commit.
1. Read AGENTS.md, docs/phases/{PHASE}-*.md and the plan.md sections it lists.
2. Inspect: git log --oneline main..HEAD ; git diff main...HEAD --stat ; then read the diff in full.
3. Run the gates yourself (make test, make lint, pytest tests/test_invariants.py, sh scripts/scan_secrets.sh) and, for P2/P4/P6,
   do a sabotage check: temporarily break the key behaviour in a scratch copy or by describing the exact change, and confirm a test fails.
   (If you cannot do this without editing the working tree, say so and describe it instead.)
4. Check: every acceptance criterion has a test or recorded evidence; plan hard rules 1-13; fail-closed behaviour; determinism;
   no placeholder presented as done; no duplicated logic; no unrelated edits; no secrets; tests assert behaviour, not implementation.
5. Output findings ranked by severity: file:line, what is wrong, a concrete failing scenario, suggested fix.
   End with a verdict: APPROVE / CHANGES REQUESTED, and list what you verified yourself versus what you took from the PR text.
```

## 5. Fix failing gates or tests

```
A gate is failing: {paste the failing command and its output}.
1. Reproduce it first and quote the real output.
2. Find the root cause. Do NOT weaken, delete or skip a test to make it pass, and do not add retries.
3. Write a regression test that fails for the right reason, then the smallest fix. Re-run the FULL gate, not just the one test.
4. If two honest attempts fail, STOP: record what you tried and what you learned in docs/HANDOFF.md ("Blocked / questions") and report.
5. Commit the fix separately (`P<n>: fix(<scope>): <summary>`). Update Evidence only with the new real result.
If the failure shows the plan or a probe assumption is wrong, apply AGENTS.md section 6 instead of working around it.
```

## 6. Stop and hand over (use before switching tools, or when context runs low)

```
Stop implementing now and prepare a handoff.
1. Run `make test` and report the real result (even if red).
2. Run `git status -sb` and `git diff --stat`. Commit only work that is green and logically complete; leave the rest uncommitted
   and describe it. Never discard anything.
3. Overwrite docs/HANDOFF.md from its template: branch, HEAD, verbatim git status, active phase/task, what is done, what is
   partial (with file paths and what remains), commands run with real results, blockers, decisions (D-/A- ids), traps, and ONE exact next action.
4. Update docs/PROGRESS.md (phase row, Evidence, Known issues/gaps, Session log line) and tick only boxes with evidence.
5. Reply with the next action and anything the next agent must double-check.
Push the branch only if this session allows it (standing default: yes for phase/fix/docs branches), then verify the push as described in prompt 2.
```

## 7. Phase closeout (human-run checklist, after the PR is open)

1. CI green on the PR (`repo-hygiene`, `api`, and `web` once it exists). 2. Different-agent review (prompt 4) for P2/P4/P5/P6. 3. Merge with **merge commit**. 4. `git switch main && git pull --ff-only`. 5. `git tag -a phase-p<n>-done -m "P<n> done" && git push origin phase-p<n>-done` (the push hook allows tags). 6. Mark the phase DONE in `docs/PROGRESS.md`.

---

## Diff review checklist (gate G8)

- [ ] Only files in this task's scope changed; no formatting sweeps, renames or "while I was here" edits
- [ ] No secrets, no `.env`, no real-provider-shaped strings; only `PWDEMO-…-NOT-A-REAL-KEY` fakes
- [ ] No Cypher outside `api/graph/queries/`; no `.content` in `q2*`–`q8*`; no LLM call in the gate or forensic tools
- [ ] Fail-closed on unknown tools/sinks/missing provenance
- [ ] No wall-clock, `uuid` or unseeded randomness in graph data or `eval/results/`
- [ ] No debug prints, commented-out code, TODOs presented as done; stubs fail loudly and are in Known gaps
- [ ] Each new behaviour has a test that would fail without it; no test asserts implementation details
- [ ] No duplicated logic (e.g. `render_changelog` exists once); no unnecessary abstraction
- [ ] New dependency? Approved and recorded in `docs/DECISIONS.md`
- [ ] Docs and tracking files updated; commit messages match `P<n>: <type>(<scope>): <summary>`
