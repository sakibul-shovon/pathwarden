# AI-assistance disclosure

Written to be true. Items the agent cannot know are marked **[owner to confirm]**; the owner must settle them before submission (they change what is claimed, not what the code does).

## Who did what

| Part | Done by | Evidence |
|---|---|---|
| `plan.md` (requirements, graph model, the Cypher of §10, gate semantics, sanitizer rules, evaluation design, remediation design) | supplied by the repository owner. **[owner to confirm]** how the plan itself was produced and whether any AI tool helped write it | the file is committed unchanged; no agent edits it (a test and the git hooks guard it) |
| Workflow and process (`AGENTS.md`, `docs/WORKFLOW.md`, phase files, quality gates, git policy) | proposed by Claude Code, approved by the owner ("approve all", D-001 to D-016) | `docs/DECISIONS.md` Part A |
| **All application code, tests, fixtures, evaluation harness, UI and documentation** | **Claude Code (Anthropic), model recorded in the `docs/PROGRESS.md` session log (Sonnet 5.5)**, working one phase at a time on `phase/*` branches | the git history (every commit follows `P<n>: <type>(<scope>): <summary>`); `docs/PROGRESS.md` evidence log |
| Merges to `main`, tags and pushes | Claude Code, delegated by the owner (D-016) after each phase's gates were green | merge commits and `phase-p<n>-done` tags |
| Decisions that are the owner's | the owner: Groq as the LLM provider, repository private until the end, no agent names in git, cut-line order | `docs/DECISIONS.md` |

## What was and was not reviewed by a human

- The owner approved the process and the phase plan and delegated the work and the merges. The owner did **not** review the code line by line during the build. **[owner to confirm or correct, and add any review done before submission]**
- There was **no independent reviewer**, human or second agent (known gap G-001). The single-agent setup is the reason for the compensating controls below.
- The plan's draft disclosure claimed that the author reviewed and tested every Cypher query by hand. That is **not** what happened and is not claimed here. What is true: the queries are the plan's own text; a test checks programmatically that they are verbatim copies of plan §10; `make probe` runs each of them against a real FalkorDB (36 checks); and two queries deviate from the plan and are flagged for the owner's review (D-017 `q2c`, D-018 two capability-graph seed queries).

## Controls that compensate for the missing review

- 512 tests run against a **real** FalkorDB (the database is never mocked), in two auth modes (`make test`, `make test-auth`). Static invariants (`tests/test_invariants.py`) execute the plan's hard rules: Cypher only in `.cypher` files, no content read by the gate, no LLM client in the gate, every route key-scoped or classified.
- **Sabotage checks** per phase: deliberately breaking the code in a targeted way and confirming a test fails. They found real gaps that were then closed with new tests (for example P2 S4, P6 S1 and S3, P7 S2 and S3, P9 S8 and S11, P10b M3); the numbers are in the evidence log.
- Measured results are recorded as measured, never predicted; `make eval` is deterministic and byte-identical across runs.
- Every deviation from the plan is a numbered decision in `docs/DECISIONS.md` and is listed in `docs/HANDOFF.md` for the owner.

## Incidents worth knowing

- The first `make fmt` rewrote code blocks inside `plan.md` (the formatter also formats Markdown). It was detected from the "file changed on disk" notice, reverted, and made impossible (D-015).
- The plan's `q2c`, taken literally, made the healing flow impossible; the agent proved it with a probe and recorded a deviation instead of silently changing the query (D-017).
- A sabotage run created a real graph `pw_nope` in the development database; it was found and deleted by hand (P11 evidence).

## Not done (so nothing here is overstated)

The live LLM mode, the LLM judges (B1/B3) and the live study are **not implemented** (phase P8, blocked on a model name from the owner). Every result in the README comes from scripted agents. CI has never been observed on GitHub from the development environment (private repository, no `gh`).
