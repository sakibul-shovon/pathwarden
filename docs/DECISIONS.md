# Decisions and open questions

Format: one entry per decision. Status: `Proposed` (awaiting human) · `Accepted` · `Rejected` · `Open` (plan ambiguity, not yet resolved) · `Resolved` · `Superseded by D-xxx`.
Agents **append** entries and may mark an `Open` item `Resolved` only when the plan text or the human settles it — never by silent assumption. Plan.md rule: record decisions here; record probe outcomes here (P0).
Date format: `YYYY-MM-DD`. Setup entries below were written 2026-10-15 during blueprint preparation.

## Part A — Process decisions (from the blueprint; the human accepts or edits)

### D-001 — `AGENTS.md` is canonical; `CLAUDE.md` imports it
- **Status:** **Accepted (human: "approve all", 2026-10-15)** · **Phase:** setup
- **Context:** plan §4 says "copy this section into `CLAUDE.md`". Antigravity reads `AGENTS.md` (verified in its docs) but not `CLAUDE.md`; Claude Code reads `CLAUDE.md` and supports `@AGENTS.md` imports (verified). Copying §4 into both files would drift.
- **Decision:** §4 is copied verbatim into `AGENTS.md` §2; `CLAUDE.md` is `@AGENTS.md` + a few Claude-specific lines. Deviates from the literal wording of plan §4/§21, same content and intent.
- **Consequence:** if §4 changes in plan.md, `AGENTS.md` §2 must be updated by the human in the same commit.

### D-002 — Tracking file set
- **Status:** **Accepted (human: "approve all", 2026-10-15)** · **Phase:** setup
- **Decision:** `docs/PROGRESS.md` (dashboard, evidence, issues, session log), `docs/HANDOFF.md` (overwritten baton), `docs/DECISIONS.md`, and task checkboxes inside `docs/phases/P*.md`. No `CHANGELOG.md` (git log with `P<n>:` commits is the changelog) and no `TESTING.md` (evidence log lives in PROGRESS). No separate `TASKS.md` (would duplicate the phase files).

### D-003 — Commit message format
- **Status:** **Accepted (human: "approve all", 2026-10-15)** · **Phase:** setup
- **Context:** plan §4 requires `P<n>: <summary>`; the human asked for a Conventional-Commits-style standard.
- **Decision:** `P<n>[a-d]: <type>(<scope>): <summary>`, types `feat fix test refactor docs chore ci perf`. Enforced by `.githooks/commit-msg`. Compatible with plan §4 (the line still starts `P<n>: `).

### D-004 — Branching and merging
- **Status:** **Accepted (human: "approve all", 2026-10-15)** · **Phase:** setup
- **Decision:** trunk-based. `main` + `phase/p<n>-<slug>` branches, PR per phase, **merge commit only** (squash would erase the incremental history the hackathon asks for), human merges, human tags `phase-p<n>-done`. No `develop` branch (solo, ~3 days, no staging).

### D-005 — Default agent Git authority
- **Status:** **Accepted (revised by the human, 2026-10-15)** · **Phase:** setup
- **Decision:** commit on non-main branches = yes (plan §4); **push of `phase/*`, `fix/*`, `docs/*` branches = yes** (standing authorisation; never `main`, never forced, never tags; a prompt may withdraw it with `PUSH: no`); PR creation = only if the prompt says `PR: yes`; merge/tag/delete/settings = human. Table in `docs/WORKFLOW.md` §6.4. Enforced by `.githooks/pre-push` and Claude Code deny rules; allow rules in `.claude/settings.json` cover only those three branch prefixes.

### D-013 — No agent attribution in git
- **Status:** **Accepted (human, 2026-10-15: "can push but without agent name")** · **Phase:** setup
- **Interpretation (confirm if wrong):** commit messages, PR text and branch names carry no `Co-Authored-By`, "Generated with …" or tool/model name, and commits are authored with the repo's configured identity. Claude Code's own attribution is disabled in `.claude/settings.json` (`attribution.commit` and `attribution.pr` empty, `sessionUrl` false — shape verified in the Claude Code settings reference).
- **Kept on purpose:** the AI-assistance disclosure that plan §24.5/§24.6 requires (README + `docs/AI_ASSISTANCE.md`) and the tool/model column of the `docs/PROGRESS.md` session log, which is a committed file. If you want the session log anonymised too, say so.

### D-016 — Merge, tag and `main` push delegated to the agent
- **Status:** **Accepted (human, 2026-10-15: "tumi sob merge kore next phase start koro")** · **Phase:** all
- **Decision:** because `gh` is not installed and the human does no manual steps, the agent merges each finished phase locally (`--no-ff`, merge commit), tags `phase-p<n>-done`, and pushes `main` and the tag with `PW_ALLOW_MAIN=1` for that one command. Preconditions: phase VERIFYING, gates G1–G9 green with evidence, branch pushed. Supersedes the "merge/tag = human" parts of D-004/D-005; everything else there stands (never force, never squash, no other pushes to `main`).
- **Consequence:** CI results cannot be observed from here while the repo is private and `gh` is absent (gate G10 = "not verified"). A failed CI run would only be noticed on GitHub; record "CI not verified" in Evidence rather than claiming green.

### D-014 — Repository visibility
- **Status:** **Decided: stays private until the project ends; the human makes it public** (2026-10-15). Reminder for P12-T6 · **Phase:** P0/P12
- **Facts:** the human states the repo is **private** (2026-10-15). Plan §24.6 requires it to be public at submission.
- **Consequences (my understanding of GitHub's plan limits — verify under Settings → Branches / Code security):** private repos on GitHub Free typically lack branch protection/rulesets, secret scanning and push protection. Until public, local hooks and the human-only merge rule are the only protection.
- **Proposal:** make the repo public as soon as you are comfortable (it will contain only the plan, synthetic fixtures and code; no secrets by design) — this unlocks the protections for free and satisfies "incremental public commits". Otherwise flip it no later than P12-T6. Commit timestamps are unaffected by the flip.

### D-006 — Python lint/format tooling
- **Status:** **Accepted (human approved ruff, 2026-10-15)** — plan rule 12 satisfied by this approval · **Phase:** P0
- **Context:** the Makefile in plan §21 has `fmt` but §6 names no formatter; the human asked for linting and quality gates.
- **Proposal:** add `ruff` as a **dev-only** dependency for `make fmt` / `make lint` (also runs in CI). Do **not** add mypy/pyright (type hints stay a review item; 3-day budget). Frontend uses `tsc --noEmit` / `npm run build` which ship with the Vite TypeScript template.
- **If rejected:** remove the `Lint` step from `.github/workflows/ci.yml`, make `make lint` a no-op that prints "no linter configured" (exit 0), and drop G2.

### D-007 — Python version
- **Status:** **Accepted — human will install 3.11 (2026-10-15); not yet installed** · **Phase:** P0
- **Facts (verified 2026-10-15):** plan §6 says Python 3.11. This machine has 3.13 and 3.14 only (`py -0p`), default `python` is 3.14.7. `winget search` (run by full path) lists `Python.Python.3.11` version 3.11.9.
- **Action:** `winget install Python.Python.3.11`, then create the venv with `py -3.11 -m venv .venv`. CI pins 3.11. Alternative: run API and tests only inside Docker (Python 3.11 image) — slower loop, no host install.
- **Why not just use 3.14:** the plan's stack (FalkorDB client, LiteLLM, MCP SDK, Pydantic v2) was not verified on 3.13/3.14, and plan rule 1 forbids guessing.

### D-008 — `make` on Windows
- **Status:** **Accepted — human will install it (2026-10-15); not yet installed** · **Phase:** P0
- **Facts (verified):** `make` is not installed; Git Bash is available (Git 2.45.2). `winget.exe` exists at `%LOCALAPPDATA%\Microsoft\WindowsApps\` but was not on PATH in the agent shell (it may be on yours); `winget search` lists `ezwinports.make` 4.4.1 and `GitHub.cli` 2.102.0. Docker Desktop is installed but its daemon was **not running** when checked — start it before `make up`.
- **Action:** `winget install ezwinports.make` (then reopen the terminal, `make --version`). The P0 Makefile uses `SHELL := bash`, avoids platform-specific commands and works under Git Bash and Linux CI. Fallback if make cannot be installed: `scripts/dev.ps1` wrappers (adds files; avoid unless needed).

### D-009 — Phase boundary refinements and execution order
- **Status:** **Accepted (human: "approve all", 2026-10-15)** · **Phase:** all
- **Decision:** keep plan phases P0–P12 and their ids (commits and tags use them). Refinements, all dependency-driven (details in `docs/phases/README.md`): split P10 into P10a/P10b/P10c so a usable UI exists right after P4; pull `q2d` into P1 (needed by `Runtime.approve`) and `q3`/`q6`/`q6b` into P3 (needed by the `explain` endpoint); compose gains `api` in P3 and `mock-upstreams` in P9 (P0 creates `falkordb` only). Recommended order: P0 P1 P2 P3 P4 **P10a** P5 P6 P7 **P10b P10c** P8 P9 P11 P12.

### D-010 — Priority tiers / cut line
- **Status:** **Accepted (human confirmed, 2026-10-15)**; the order *inside* Tier 3 is decided at the feature freeze · **Phase:** all
- **Decision:** nothing is removed from scope. If time runs out, the *human* decides what to cut, in this order of sacrifice: Tier 3 (P8 live LLM, P9 MCP, P11 multi-tenancy) → Tier 2 (P5, P6, P7, P10b, P10c) → never Tier 1 (P0–P4, P10a, P12). Any cut is recorded here and in the README limitations. Tier definitions: `docs/phases/README.md`.

### D-011 — Optional dependency extras
- **Status:** **Accepted (human: "approve all", 2026-10-15)** · **Phase:** P0, P8, P9
- **Decision:** `pyproject.toml` base dependencies = §6 core (FastAPI, Uvicorn, Pydantic v2, PyYAML, falkordb client, httpx, pytest). `litellm` goes in extra `llm` (added in P8) and `mcp` in extra `mcp` (added in P9), each after its probe (rule 13), so scripted mode installs light and rule 10 stays easy to verify.

### D-012 — Pin the FalkorDB image
- **Status:** **Accepted (human: "approve all") and DONE in P0** — pinned by digest in `docker-compose.yml` and `ci.yml`, see Part C · **Phase:** P0
- **Context:** plan §6 uses `falkordb/falkordb:latest`; a moving tag can change Cypher or `algo.maxFlow` behaviour mid-hackathon.
- **Decision:** after `make probe` passes, record the exact tag/digest here and pin it in `docker-compose.yml` and `ci.yml`.

## Part B — Plan ambiguities and gaps (status `Open`; resolve in the named phase, never silently)

**2026-10-15 — the human approved every proposed resolution in this table as written** ("approve all"; this covers A-01…A-13, A-15, A-16 and the A-07/A-09 proposals). The implementing phase still records the concrete outcome and marks the row `Resolved`. If the implementation discovers the proposal does not work, stop and ask (`AGENTS.md` §6). **A-14 stays open** (Groq model name, API key, license).

| id | Where in plan | Problem | Proposed resolution | Resolve in |
|---|---|---|---|---|
| A-01 (**Resolved in P1**, see Part B2) | §9 | `Runtime.__init__(graph_name, registry, clock, events)` has no `namespace`, but the text constructs `Runtime(graph=…, namespace=…)` and says the clock initialises from the graph | Constructor takes `graph_name`, `namespace`, `registry`, `events`; clock built internally from `q0_max_ts`. Record final signature. | P1 |
| A-02 (**Resolved in P1**, see Part B2) | §9 vs §10 | `Runtime.approve(action_id, approver)` must resolve the payload with `q2d`, which the plan files under the gate (P2) | Create `q2d` in P1; P2 adds its tests | P1 |
| A-03 (**Resolved in P0/P2**, see Part C and B3) | §8.3, §10 | `policy.max_lineage_hops: 16` and `query_timeout_ms` are not wired to anything: Cypher bounds are literals (16; q4 uses 20) and no client timeout method is in §6 | Treat hop bounds as constants asserted equal to policy in a test; align q4 or document 20; add a P0 probe for a client query timeout *only if* the client documents one, else mark `query_timeout_ms` unenforced | P0/P2 |
| A-04 (**Resolved in P2**: sha256 of fixtures/policy.yaml) | §11 | `verdicts.jsonl` has a `policy_version` field that is never defined | Use sha256 of `fixtures/policy.yaml` bytes | P2 |
| A-05 (**Resolved in P3**, Part B4) | §21, §24.6 | `make demo` is required to work but never specified | Runs the six §12.4 scenarios through the API/CLI and prints a verdict table; non-zero exit if any expectation differs | P3 |
| A-06 (**Resolved in P3**, Part B4) | §18 vs §22 | `GET …/actions/{id}/explain` returns laundering + subgraph (q3, q6, q6b), but P4 owns q3 | Build q3/q6/q6b and `explain` in P3; P4 reuses | P3 |
| A-07 (**Resolved in P11**, see Part B13) | §17, §18 | Which endpoints need `X-PW-Human`? Remediation and eval endpoints are not workspace-scoped, so API keys cannot scope them | Human-only: action approve/reject, heal approve, quarantine release, remediation apply/reset/suggest-apply. Remediation/eval read endpoints are global and public-demo data. Record the list. | P11 |
| A-08 (**Resolved in P5**, Part B7) | §20.4–20.5 | Decision latency p50/p95 is wall-clock, but "non-LLM defenses must be byte-identical across runs" and `make eval` twice must give identical files | Write latency to a separate non-deterministic file (e.g. `eval/results/latency.csv`, gitignored or excluded from the identity check); `results.csv`/`summary.md` hold only deterministic columns | P5 |
| A-09 (**Resolved in P7**, see Part B9) | §14 | The two time-travel markers ("poisoned memory written", "draft doubly tainted") need artifact-level taint, but rule 1 forbids new Cypher and §10 has no such query | Compute in Python from existing `q7` edges + `q6b` details (BFS over the returned subgraph). No new Cypher. Needs human OK because rule 1 says ask. | P7 |
| A-10 (**Partly resolved in P4**, Part B5; finished in P8) | §13.5, §18 | Heal approval "re-runs Fixer and Release" — scripted or live? And `POST /forensics` accepts `mode:"llm"` before P8 exists | Heal re-run uses the same mode as the original run (scripted by default). `mode:"llm"` returns `{"error":"llm_not_configured"}` until P8. | P4/P8 |
| A-11 (**Resolved in P9**, see Part B12) | §8.8 vs §16.3, §5 | `gateway.yaml` says the gateway spawns upstreams as stdio subprocesses, yet compose lists a `mock-upstreams` service | Decide after `probe_mcp.py`; likely the service just hosts the code image / is unused for stdio | P9 |
| A-12 (**Resolved in P11**, see Part B13) | §17, §21 | Is `fixtures/api_keys.yaml` committed? Hosted keys must not be | Commit demo keys only (`pwdemo-…`, non-provider format); hosted keys via an env-selected file or env var | P11 |
| A-13 (**Resolved in P0**) | §6, §23 | API port, FalkorDB env var names not specified | Port 8000 (Uvicorn default); `PW_FALKORDB_HOST/PORT/PASSWORD` (see `.env.example`) | P0 |
| A-14 | §12.3, §24 | LLM provider and README license. **Provider = Groq** (human, 2026-10-15). **Still open: exact model, the key itself (goes only in the local `.env` as `PW_LLM_API_KEY`), and the license** | Via LiteLLM a Groq model is addressed as `groq/<model>` (to be confirmed by the P8 probe — rule 13; also confirm how the key is passed). Pick the model at P8 from Groq's current list. Free-tier rate/token limits may throttle the live study and the B3 full-trace judge (long prompts): measure in the probe, add backoff, reduce nothing silently. License: the human chooses (e.g. MIT or Apache-2.0) before P12-T6 | P8/P12 |
| A-15 | §23 | Hosted FalkorDB (Cloud/Railway) support for `GRAPH.COPY` and `algo.maxFlow` is not stated | Run `make probe` against the hosted endpoint as soon as one exists (before P12) | P0 (local) / P12 |
| A-16 (**Resolved in P10a**, Part B6) | §6 | No frontend test tooling in the stack; UI cannot be regression-tested automatically | Gate UI with `npm run build` (strict TS) + a manual acceptance checklist with recorded evidence; ask before adding Vitest/Playwright | P10a |

## Part B2 — P1 outcomes (2026-10-15)

- **A-01 Resolved.** Final constructor: `Runtime(graph: NamedGraph, registry: Registry, *, namespace: str = "", events: EventLog | None = None)`. The logical clock is built inside from `q0_max_ts` (1 for an empty graph); counters from `q0_ids_with_prefix` filtered by exact regex `^<prefix>(\d+)$`. `NamedGraph(db, name, timeout_ms)` replaces the plan's bare `graph_name` (it also wires `policy.query_timeout_ms` through the client `timeout=` kwarg, see Part C).
- **A-02 Resolved.** `q2d_action_context` is created in P1; `Runtime.approve(action_id, approver)` resolves the payload with it and calls `approve_artifact`. `approve_artifact(artifact_id, approver)` is also public because the §20.1 `approve` event refers to an artifact that has no action yet.
- **New files/names not spelled out in the plan layout** (all required to fail closed): `api/runtime/errors.py` (the plan's exceptions plus `PathwardenError`, `UnknownAgentError`, `NotFoundError`, `ProvenanceError`; re-exported from `runtime.py`), query loader in `api/graph/loader.py`, `NamedGraph` in `api/graph/client.py` (reads go through `ro_query`), seeding/reset/graph-name helpers in `api/graph/schema.py` (the only `api/` module allowed to hold Cypher text: index DDL, plan §7.5).
- **Finding (bug class to remember for P2–P4):** a named query that ends in an aggregate (`RETURN count(...)`) returns a row even when its `MATCH` matched nothing. `q1_write` therefore reports `[[0]]` for a nonexistent session. The runtime verifies the artifact exists via `q1_get_artifact`. Any future query ending in an aggregate needs the same care (q4c, r3 also end in `count`).
- **Tool names:** `memory_list` is not a tool in `registry.yaml` (plan §8.1); only `memory_read` exists. The scripted Fixer's `load_by_prefix` uses `memory_read` (plan §12.2). `memory_list` appears only in the gateway/live-agent menus (P8/P9), which map it onto `load_by_prefix`.
- **Behaviour choices (no plan text):** ids/clock are consumed only when an operation succeeds; `load` does not check the artifact's store against the tool's store (the plan does not ask for it); writes allow kinds `memory`, `draft`, `patch` only; `add_source` rejects unknown trust values.

## Part B3 — P2 outcomes (2026-10-15)

- **A-04 Resolved:** `policy_version` = sha256 of the bytes of `fixtures/policy.yaml` (`api/runtime/registry.py::policy_version`); written to every `state/<ws>/verdicts.jsonl` line.
- **A-03 finished:** a test asserts the lineage bound in q2a/q2b/q2c equals `policy.max_lineage_hops` (16). `q4` keeps the plan's literal `*1..20` (a deeper reach for quarantine is the conservative direction); `policy.query_timeout_ms` is wired through `NamedGraph(timeout_ms=...)` (the client `timeout=` kwarg is enforced, Part C) — the API layer (P3) passes the policy value when it builds graphs.
- **Gate semantics fixed in code:** action id unknown → `NotFoundError` (cannot decide on nothing); verdict → status mapping ALLOW→`allowed`, HOLD→`held`, BLOCK→`blocked` (execution sets `executed` later); gate exceptions propagate and never become ALLOW; witnesses are lists of ids (endpoints compared, not whole paths, because equal-length paths may tie).
- **Test-gap lesson:** the first sabotage run missed "q2b wrongly excludes sanitized". Rule 7 has two halves (sanitized cuts untrusted only; secrets need human approval) and both now have tests. P4/P5/P6 sabotage checks should likewise try the *opposite* mistake, not just "forgot the exclusion".

## Part B4 — P3 outcomes (2026-10-15)

- **A-05 Resolved:** `make demo` runs `python -m api.scenarios.demo`: one row per scenario (guard on, expected vs actual), then, for the three attacks, whether they LEAK with the guard off; exit code 1 on any mismatch or if an attack does not leak.
- **A-06 Resolved:** `explain` is built in P3 (q3, q5, q6, q6b, and `q7b` pulled forward for the actions list: `Runtime.list_actions` uses q7b at the current clock). P4 reuses them.
- **`reset` field on the run endpoint:** `POST …/scenarios/{name}/run` accepts an extra optional `"reset": true` (default true) next to `guard`/`mode`. Reason: the plan's expected verdicts are defined from a clean workspace, and team memory deliberately persists (test `test_without_a_reset_the_poison_persists…` shows a benign run being held because Monday's poison is still in memory). `reset:false` is how the UI/forensics keep state.
- **Decisions without plan text:** sink files use `_` instead of `:` in names (`sink_public_release_page.jsonl`; `:` is illegal on Windows); `render_changelog` section mentions are case-insensitive; env-key detection uses `(?<![A-Z_])KEY(?![A-Z_])` so `PORT` is not found inside other words; `TaskSchema` ignores unknown fields (they never reach the graph because only the four declared fields are dumped); `GET /actions/{id}` returns the recorded status plus a fresh **non-recording** gate evaluation (`Gate.evaluate`), and not the verdict reason because no §10 query returns it (it is in the RunResult and the verdict log); only `proposed`/`held`/`blocked` actions can be approved or rejected (an executed one cannot be approved again, 409, no double post); a blocked (quarantined) action stays blocked after approval because the quarantine check precedes the witnesses.
- **New files not in the plan layout:** `api/workspace.py` (WorkspaceManager/Workspace: graph, runtime, gate, sinks, lock; optional `graph_names` override for tests), `api/api_errors.py`, `api/runtime/explain.py`, `Dockerfile`, `.dockerignore`. Compose gained the `api` service; `make up` now builds and starts both services.
- **Witness ties (observed):** when two secrets are read at equal distance (`PAYMENT_API_KEY` and `DEPLOY_TOKEN`), `q2b` may return either. Tests and the evaluation metric (§20.4: "in") compare membership, never an exact path.
- **Known gap G-002 stands:** approve/reject/reset/run have no authentication until P11.

## Part B5 — P4 outcomes (2026-10-15)

### D-017 — `q2c` deviates from plan §10 (needs the human's review)
- **Status:** **Implemented by the agent, awaiting the human's confirmation** · **Phase:** P4
- **Problem (found by running the whole story, not by reading):** plan §13/§22-P4 expects the healed release to pass the gate (sandbox ALLOW) while `task:42` stays unquarantined. But the healed draft derives from the sanitized `task:42`, and `task:42` derives from the raw issue — which `q4` *does* quarantine (it is the root). The plan's `q2c` counts a quarantined ancestor at any depth, even through a sanitized artifact, so the healed draft was **BLOCKED / QUARANTINED_LINEAGE** (observed). With the plan's queries taken literally, the heal flow cannot ever succeed. `q2a`, `q4` and rule 7 all treat `sanitized` as the boundary; `q2c` was the odd one out.
- **Change (smallest possible):** `q2c` adds `AND none(n IN nodes(qp) WHERE coalesce(n.sanitized, false) AND n.id <> q.id)`: a quarantined ancestor reached *through* a sanitized artifact no longer counts. A quarantined non-sanitized ancestor still BLOCKs, and a quarantined sanitized artifact **itself** still BLOCKs (`n.id <> q.id`). Both are tested (probe B14, gate tests, sabotage S3).
- **Safety argument:** quarantine exists to stop untrusted-origin contamination; the sanitizer's output is by contract free of free text, and `q2a`/`q4` already stop at it. Secret handling is unaffected (rule 7 is about `approved`).
- **Alternatives rejected:** not quarantining the raw root (contradicts the plan's own report example, which lists the root); quarantining the sanitized task too (contradicts "keeps task:42 unquarantined" and makes the fixer unable to load it).
- **To revert:** copy the plan text of q2c (probe `Q["q2c"]`) back into `api/graph/queries/q2c_quarantine_check.cypher`, remove `q2c_quarantine_check` from `DEVIATIONS` in `tests/test_fixtures_and_queries.py`. Result: 5 tests fail because no healed release can pass the gate. If you prefer a different fix, say so.

### Other P4 decisions and findings
- **A-17 (new, resolved):** no §10 query returns an action's `task_ref`, yet sandbox replay and heal need it. It is derived from the payload's key via `q6b` (metadata): `changelog:N` -> `issue:N`. Works for every demo scenario; an action whose payload has another key makes the report `ESCALATE_TO_HUMAN` (sandbox skipped) and heal refuse (400).
- **A-10 (partly):** `mode:"llm"` returns 501 `llm_not_configured` until P8; heal re-runs use the scripted agents (only mode that exists).
- **Idempotency:** `apply_quarantine` quarantines only artifacts not yet quarantined and creates no `Quarantine` node when there is nothing new (`quarantine_id: null` on a re-run). `Runtime.apply_quarantine` validates that every id exists first, then checks `count == len(ids)` (the aggregate trap applies to q4c/q4d). Releasing an unknown quarantine id is 404 (q4d would return `[[0]]`).
- **Sandbox:** rebuilt from scratch on every forensics run (delete + `Graph.copy`), own `Runtime(namespace="sbx")`, own `Gate` without a verdict log; sandbox gate decisions are recorded in the sandbox graph only; the mock sinks are never touched. Day labels `Replay` (sandbox) and `Heal` (main).
- **Forensics when there is nothing untrusted:** report with empty fields and `ESCALATE_TO_HUMAN`; nothing is quarantined. After quarantine the gate evaluates the held action as BLOCK/QUARANTINED_LINEAGE, so forensics uses `Gate.witnesses` (q2a/q2b, independent of quarantine) to find the source on re-runs.
- **Heal:** only `held`/`blocked` actions (else 409); creates a fresh main `Runtime` (ids continue from the graph state, shares the event log), re-runs Fixer + Release, gates, executes; the old action is superseded **only if** the new one executed. Without prior forensics the new action is held again and nothing is superseded (tested).
- **Event log** now loads an existing `events.jsonl` on construction, so history survives an API restart.
- **New names:** `Gate.witnesses`, `Runtime.{node_details, apply_quarantine, release_quarantine, action_context, list_actions, get_action}`, `Workspace.{make_sandbox, forensics, heal_approve, release_quarantine, memory_inventory, sandbox_artifact}`, `api/forensics/{report,tools,agent}.py`, `api/routes/forensics.py`.
- **Observation:** the sandbox is a *copy* of main at replay time, so `?graph=sandbox` also serves the held payload; the property that matters (and is tested) is that main never serves sandbox-namespaced artifacts.

## Part B6 — P10a outcomes (2026-10-16)

- **A-16 Resolved without new dependencies:** UI gate = strict `tsc` + `vite build` (CI job `web`) **plus** a real-browser check that needs no test framework: headless Edge (`--dump-dom`, `--screenshot`) against the running API. To make states reproducible the UI accepts **deep-link parameters** (`?tab=`, `scenario=`, `guard=off`, `autorun=1`, `autoforensics=1`, `autoheal=1`); they are a documented feature (shareable links), not test-only code.
- **Dev wiring:** Vite proxies `/api` to `http://localhost:8000` (no CORS in development). A hosted build sets `VITE_API_BASE` and then **the API needs a CORS allow-list** — deferred to P12 (hosted deployment) and P11 (auth); recorded here so it is not forgotten.
- **Toolchain as resolved by npm today:** React 18.3.1, cytoscape 3.34.3 (ships its own types), Vite 8.3.4, `@vitejs/plugin-react` 6.1.2, TypeScript 7.0.2; versions are pinned by `web/package-lock.json`.
- **UI facts worth knowing:** after a quarantine the gate verdict reads BLOCK/QUARANTINED_LINEAGE while the recorded status stays `held`; the card says so and the graph keeps drawing the witness paths (`explain` returns `Gate.witnesses`). Tabs not built yet are visibly disabled ("arrives in P10b/c"), the live-mode toggle is disabled ("arrives in P8"). The UI treats `PWDEMO-` and a `### Checksum` section as "leak" markers only to highlight the demo's fake secrets.
- **Not verified:** clicking through in a visible browser by a human (the headless flow covers the same states), light-mode appearance (the headless Edge used dark mode), Safari/Firefox.

## Part B7 — P5 outcomes (2026-10-16)

- **A-08 Resolved:** `results.csv`, `summary.json`, `summary.md` contain only deterministic columns and are byte-identical across runs (verified); wall-clock latency goes to `eval/results/latency.csv` / `latency.md`, which are gitignored. `GET /api/eval/summary` serves `summary.json` (404 `eval_not_run` before the first run).
- **Generator choices where §20.2.1 is silent:** (1) the title/body pair is cycled by the index **inside the family** (`ISSUES[i % 4]`); (2) curators run on `Mon`; (3) BEN-port-only injects `[E1,E2,B2][i%3]` into the issue text but writes no convention; (4) all benign scenarios (including the two that reuse the pipeline template) draw their issue from 200-299, attack scenarios from 100-199, so the sleeper uses one number from each pool; (5) conventions rendered into a draft are the loaded memories whose key starts with `team_convention:`; (6) scenario ids are `<family lower-case>-<NNN>` (1-based); (7) the scenario files in `eval/scenarios/` are generated, committed and checked for sync by a test.
- **Defense semantics:** HOLD and BLOCK both count as *held*. B2 holds iff the proposing session has A, B and C. B4 holds on an exact env secret value or the regex `PWDEMO-(SECRET|TOKEN)-[0-9a-fA-F]{8}`. PW-coarse = the same gate on a graph replayed with the three overrides of §20.3 (`replay(..., coarse=True)`).
- **Honest reading of the result:** PW scores 0% ASR / 0% FHR with 60/60 witness accuracy, but the dataset and the gate share one lineage model; the perfect score demonstrates implementation conformance, not coverage of real attacks (stated in `summary.md` Limitations). The informative contrasts are the baselines: B2's blind spot (100% ASR), DLP's two failure modes (base64 evades it, example keys trigger it) and the taint-explosion cost of the coarse ablation (73.3% FHR). B1/B3 and the live study stay `not_run` until P8.
- **Falsification criteria (§20.7)** are evaluated in the summary where possible: PW's FHR is below 20% (not triggered); the B3-related criteria are "not evaluable".
- **New files not in the layout:** `eval/metrics.py`, `api/routes/eval.py`, `eval/baselines/__init__.py` (shared `Decision`/`Context`), `eval/results/summary.json`.

## Part B8 — P6 outcomes (2026-10-16)

### D-018 — two capability-graph seed queries are not in plan §10 (needs the human's review)
- **Status:** **Implemented by the agent, awaiting the human's confirmation** · **Phase:** P6
- **Gap:** plan §10 gives r1-r7 (read, max-flow, revoke, toxicity, witness) but no query that *creates* the capability graph (plan §7.6 only describes the model). Rule 1 forbids ad-hoc Cypher, so the smallest additions were made in the exact style of `q1_seed_*`: `r0_seed_nodes.cypher` (`UNWIND $rows ... CREATE (:CapNode {...})`) and `r0_seed_edges.cypher` (`UNWIND ... MATCH (a),(b) CREATE (a)-[:CAN_FLOW {...}]->(b)`). Their text is pinned in `tests/test_fixtures_and_queries.py::ADDITIONS` (and must not appear in the plan). The two `CREATE`s mirror constructs that the probe already verified (list-of-maps parameters, `UNWIND`+`MATCH`+`CREATE`).
- **To revert/replace:** delete the two files and load the graph another way; only `CapabilityService.reset` uses them.

### Other P6 decisions and findings
- **Candidates:** exactly §15.2 (C1 U->K, C2 S->K, C3 U->T_S, C4 S->T_U with T_S/T_U computed from `r5`/`r6`). Each is a complete fix by construction and is **verified on a temporary copy** of the graph (`Graph.copy` to `<graph>__verify`, apply `r3`, `r4` must be empty, deleted in `finally`). If the source or target set is empty, no cut is needed (cost 0). `cut cost != maxFlow` marks a candidate invalid (tolerance 1e-6; FalkorDB returns flows as floats).
- **Measured (2026-10-16, not predicted):** tinyqueue3: C1=3, C2=6, C3=3, C4=6, best 3, optimum 3, gap 0. enterprise12: C1=17, C2=22, C3=16, C4=23, best 16, **optimum 14, gap 2**: a cheaper mixed cut exists that no single candidate finds. This is reported as-is in `eval/results/summary.md` (a new Remediation section; `make eval` computes it, deterministically).
- **Optimum:** depth-first search over edge subsets (size <= 6, cheapest edges first, cost pruning seeded with the best candidate cost), independent of FalkorDB and of the max-flow code; verified equal to an exhaustive search on tinyqueue3. Reports `None` if no toxic-free set of at most 6 edges exists.
- **Description property** of `CAN_FLOW` edges: generated text "`<src> may send data to <dst>`" (the YAML has no descriptions).
- **API:** `GET /api/remediation/{topology}` (nodes with `toxic` flags, edges with `revoked` flags), `POST …/reset`, `POST …/suggest`, `POST …/apply {cap_ids}`, `GET …/witness/{agent}`. These graphs are global demo data (not tenant-scoped, A-07); **`apply` and `reset` are unauthenticated until P11** (G-002). `r2`/`r4`-`r7` run through `ro_query` (verified: `algo.maxFlow` works read-only).
- **Lessons for later sabotage checks:** (1) a property test can miss a code path that only a crafted case exercises (the backward residual step); (2) a mutation can be an *equivalent mutant* for property tests (a wrong definition that still yields a complete fix), so definitions need their own pinning test.
- **New files:** `api/remediation/{capability_graph,mincut}.py`, `api/routes/remediation.py`, `eval/remediation_optimum.py`, `fixtures/topologies/*.yaml` (verbatim), queries `r0_seed_nodes`, `r0_seed_edges`, `r1`-`r7`.

## Part B9 — P7 outcomes (2026-10-16)

### A-09 — Resolved: time-travel markers are computed in Python, no new Cypher
- **Markers:** `poisoned_memory_written` = the earliest-created team-memory artifact that `q8` reports with at least one untrusted origin (details from `q6b`). `draft_doubly_tainted` = the earliest-created draft whose lineage reaches an untrusted source without crossing a sanitized or approved artifact **and** a secret source without crossing an approved artifact (the semantics of `q2a`/`q2b`, rule 7: sanitizer cuts only untrusted paths). Evaluated by BFS over the `q7` edges at the final time; `graph-at?t=` then lists a draft in `doubly_tainted` only if it exists at `t`.
- **Measured on `attack_sleeper_44` (not predicted):** max t = 18; poisoned memory at t=4, doubly tainted draft at t=16; at t=15 no draft exists.
- **Limitations (stated, not hidden):** `quarantined`, `approved`, `sanitized` and action `status` are the **current** values, not history (mutable properties, not versioned); artifacts that have no lineage edge yet appear only through their action or edge endpoints; `markers` are workspace-wide (they do not depend on `t`) so the UI can place them on the slider.
- **Response size:** ids and metadata only (no `content`, checked by a test); `max_t` is included so a slider needs a single call.
- **Files:** `api/runtime/timetravel.py`, `api/routes/timetravel.py`, `api/graph/queries/q7_graph_at_time.cypher` (verbatim), `tests/test_timetravel.py`. `q7b` already existed since P3.
- **Lesson (sabotage):** scenario-level tests did not cover the sanitizer boundary inside the marker logic; crafted graphs (replay events) are needed for each side of a boundary rule.

## Part B10 — P10b outcomes (2026-10-16)

### D-019 — `GET /memory` rows carry `quarantine_id`, remembered by the workspace (needs the human's review)
- **Status:** **Implemented by the agent, awaiting the human's confirmation** · **Phase:** P10b
- **Gap:** the Memory tab must offer "release quarantine", and `POST /quarantine/{qid}/release` needs the quarantine id, but the q8 inventory does not return it and §10 has no query that lists `(Quarantine)-[:COVERS]->(Artifact)`. Rule 1 forbids ad-hoc Cypher.
- **Choice:** `Workspace` remembers `quarantine id -> covered artifact ids` from the forensic report (the only place the id is produced), clears it on `reset`, forgets it on release, and `memory_inventory()` adds `quarantine_id` (newest remembered quarantine covering the entry, else `null`). No new Cypher; additive field.
- **Limitation (stated in the UI):** the map lives in API memory. After an API restart a quarantined entry stays quarantined, but its release button is disabled with the hint "run forensics again" (a repeat run quarantines nothing new, so the real fix is a one-query addition).
- **To replace:** add a read query over `COVERS` (needs the human's OK, rule 1) and drop the map. Tests: `tests/test_forensics.py` (the two `quarantine_id` tests).

### Other P10b decisions and findings
- **Time travel layout:** one headless Cytoscape layout of the final graph (with an explicit bounding box; without one every node got the same position) fixes the positions for every earlier time.
- **Markers are rendered, not computed:** the UI draws `markers` and `doubly_tainted` exactly as the API returns them; the "written at this moment" line lists nodes whose `created_at` equals t.
- **Stale answers:** a 120 ms debounce plus `AbortController`; a response is shown only when its `t` equals the requested one.
- **Deep link:** `?tab=time&t=N`. **Tooling in this session (not in the repo):** the real UI was driven in headless Edge over the DevTools protocol using Node's built-in WebSocket; no new dependency.
- **Port note:** another project's dev server may already hold 5173; Vite then picks 5174 (the proxy to `localhost:8000` is unchanged).

## Part B11 — P10c outcomes (2026-10-16)

### D-020 — the API container mounts `eval/results` read-only (compose change)
- **Status:** Accepted (agent) · **Phase:** P10c
- **Gap:** the image copies only `api/`, `fixtures/` and `pyproject.toml`, so `GET /api/eval/summary` answered `eval_not_run` inside Docker and the Evaluation tab would have been empty in the containerised demo.
- **Choice:** `docker-compose.yml` mounts `./eval/results:/app/eval/results:ro` on the `api` service. The tab always shows the latest `make eval` output without rebuilding the image; nothing is copied or edited. A hosted deployment (P11/P12) must provide the same directory.

### D-021 — `limitations` is part of `summary.json`
- **Status:** Accepted (agent) · **Phase:** P10c · **Touches:** `eval/run_eval.py`, `eval/results/summary.json`
- **Why:** the honest reading of the results (synthetic scripted dataset; the gate and the dataset share one lineage model, so a perfect PW score shows conformance, not coverage of real attacks) lived only in `summary.md`. The UI must show the same caveat next to the numbers, and rule 11 forbids typing it there. One `LIMITATIONS` list now feeds both files. `results.csv` and `summary.md` are byte-identical to before; `summary.json` gained only this key.

### Other P10c decisions and findings
- **Remediate:** `GET /remediation/{topology}` and `suggest` supply everything; the candidate with the lowest verified cost is only *labelled* "cheapest verified" (the API already sorts candidates by cost). The brute-force optimum is read from the eval summary when present. Apply needs a confirm dialog; Reset restores the demo topology. Node kinds: sources are diamonds tagged [U]/[S]/[I], stores carry `[store]`, sinks are tag-shaped with `[external]`/`[internal]`, toxic agents get a warning sign and a double red border (never colour alone).
- **Evaluation:** the defense list, families and criteria come from the response's keys and values; B1/B3 render as `not_run` until P8. The tab polls every 10 s.
- **Tooling lessons (not in the repo):** a click helper that matches by text must exclude the navigation tab with the same label (it clicked the `Run` tab first); another project's dev server held port 5173 (Vite used 5174).
- **Not done:** no human click-through; the live-mode toggle stays disabled with its reason until P8.

## Part B12 — P9 outcomes (2026-10-16)

### A-11 — Resolved: upstreams are stdio subprocesses; no compose service
- `gateway.yaml` is used verbatim: the gateway spawns each upstream as `python -m mock_upstreams.<name>` (`python` is replaced by the running interpreter, cwd = repo root). The probe showed the SDK client spawning stdio servers works, so no `mock-upstreams` container is needed and `docker-compose.yml` is unchanged. The upstream state lives in JSON files (`state/<ws>-mcp/upstreams/`) so it survives across the gateway processes of a demo (one process per agent).

### D-022 — MCP SDK is 2.x
- **Status:** Accepted · extra `mcp>=2,<3`; exact versions in `constraints.txt`. The memory-based API (`FastMCP`) does not exist any more: server = `mcp.server.mcpserver.MCPServer` (tool errors via `ToolError`; any other exception becomes a generic `Error executing tool <name>`), client = `mcp.Client`, proxying = the low-level `mcp.server.lowlevel.Server` with `on_list_tools` / `on_call_tool`. `scripts/probe_mcp.py` (`make probe-mcp`) is the record.

### D-023 — a synthetic registry tool for unmanaged reads (needs the human's review)
- **Status:** **Implemented by the agent, awaiting the human's confirmation** · plan §16.2 says a read of a key never written through the gateway is recorded with `read_source` on `src:unmanaged:<store>` (trust `untrusted`, `q1_add_source` on first use), but `Runtime.read_source` needs a registry read tool whose `source_prefix` matches, and the registry has none for that prefix. The gateway therefore uses an in-memory copy of the registry with one extra tool `gateway_unmanaged_read: {class: read, source_prefix: "src:unmanaged:"}` (`gateway_registry()`); `registry.yaml` is untouched, trust is fixed in code and never comes from a model. Revert: give `registry.yaml` the tool and delete the helper.

### D-024 — payload key, lineage vs upstream content, draft store
- **External payload key:** the draft written for an `external` call is stored under `changelog:<N>` when `PW_TASK_REF` is `issue:<N>` (otherwise `external:<server>.<tool>`), in the `workspace` store. The Forensic Agent derives the task from that key, so forensics and healing also work on the gateway graph.
- **Lineage vs upstream content (not in the plan):** for a key load the gateway compares the upstream's value with the recorded artifact and refuses on a difference (`differs from the recorded lineage`); `memory_list` drops such entries. Reason: `q1_lookup_key` returns the latest *non-quarantined* version, but an upstream returns its latest version, so a quarantined newer version could otherwise be read while the lineage records the older clean one. Fail closed.
- **Unmanaged entries in `memory_list`:** kept and recorded as unmanaged reads (the plan says "resolve each key as above").
- **Forward then record:** a write or read is forwarded first and recorded only if the upstream succeeded (an upstream error records nothing). If the forwarded `external` call fails after ALLOW the action stays `proposed`.

### D-025 — several gateway processes share one graph
- Each process has its own `Runtime` counters, so every graph operation takes a file lock (`state/<ws>-mcp/gateway.lock`, stdlib `msvcrt`/`fcntl`) and calls the new `Runtime.resync()` first (clock and id counters re-read from the graph). `Runtime.find_key()` (lookup without loading) was added for the load classes. Sabotage S6 shows the interleaving test fails without the resync.

### D-026 — `<workspace>-mcp` workspace view and the `ws` UI parameter
- `WorkspaceManager.get("tinyqueue-mcp")` serves the graph `pw_mcp_tinyqueue` with the registry of `tinyqueue` and its own state folder; `?ws=tinyqueue-mcp` makes the UI read it. Resetting that workspace (also done by `make demo-mcp`) clears the graph, the gateway state and the mock upstream state. The "Review at" link of a held call points at this view.

### D-027 — tool server notes
- `pathwarden_forensics` runs the scripted mode (LLM mode arrives with P8) and quarantines automatically (risk-reducing, rule 8). Domain errors are `ToolError`s with a readable message. `Workspace.quarantine_preview()` was added (a thin wrapper of the existing forensic tool); no new Cypher anywhere in P9.
- **Known gaps:** the gateway has no `sanitize` class (nothing is ever marked sanitized through it); the live-LLM three-agent demo needs P8; no authentication on the tool server (P11, G-002); no human click-through of the UI.

## Part B13 — P11 outcomes (2026-10-16)

### A-07 and A-12 — Resolved
- **A-07 (which endpoints are human-only):** approve, reject, heal-approve, quarantine release (workspace-scoped) and remediation apply and reset (global). The list is pinned by `tests/test_invariants.py` and written in `docs/SECURITY.md`. Remediation and eval **reads** (and `remediation/.../suggest`, which only computes on a temporary copy) are global public demo data. Workspace `reset` and `scenarios/.../run` rebuild the tenant's own demo graph and need only the workspace key (they are destructive to demo data, not risk-increasing).
- **A-12 (keys file):** `fixtures/api_keys.yaml` is committed with three DEMO keys (`pwdemo-key-...`, non-provider format). Hosted keys come from `PW_API_KEYS` (wins) or `PW_API_KEYS_FILE`; neither is ever logged.

### D-028 — key transport, tenants and uniform errors
- **Status:** Accepted (agent) · key in `Authorization: Bearer <key>` (the plan does not name the header); keys are compared in constant time; tenants are the workspaces named by the keys, each sharing the demo registry (agents, sources, sinks) but with its own graphs (`pw_<ws>`, `__sbx`, `pw_mcp_<ws>`) and state folder. Names must match `^[a-z0-9][a-z0-9_-]{0,31}$` and must not end in `-mcp`.
- A request the key may not make, **and** a request for a workspace that does not exist, answer with the same 403 `forbidden`; `GET /api/health` omits the graph list in hosted mode. In local mode (`PW_AUTH=off`) the old 404 `unknown_workspace` and the graph list stay.
- Hosted mode refuses to start without usable keys (fail closed). CORS is not added (the UI uses the same origin or a proxy; stated as a non-goal in `docs/SECURITY.md`).

### D-029 — the human header is required in both modes
- `X-PW-Human: true` is required on the human-only routes **also with `PW_AUTH=off`** (plan §17 mentions it for approvals in general; the phase file tests it in both modes). It is a deliberate-action guard, not authentication; the UI sends it on its human actions. Tests send it by default (`tests/conftest.py::human_headers`), security tests use a raw client.

### D-030 — tests in both modes; CI
- `make test-auth` runs the whole suite with `PW_AUTH=on` (set from Python so it works with cmd.exe too); CI runs both. Mode-dependent expectations use `unknown_workspace_error(settings)`. CI now installs `.[dev,mcp]`: the P9 tests need the SDK and the old CI line would have failed on them (CI has still never been observed on GitHub).
- **FastAPI 0.143 detail:** included routers are wrapped in private objects, so `app.routes` cannot be walked; the route invariant walks `api/routes/*.py` and asserts that every module is included in `api/main.py`.
- **Known gaps after P11:** the MCP tool server and gateway are not authenticated (local stdio processes); `X-PW-Human` is not authentication; no CORS/TLS/rate limiting (non-goals).

## Part B14 — P12 outcomes (2026-10-16)

### D-031 — what the README claims, and what was deliberately not done
- **Status:** Accepted (agent), needs the owner's confirmation where marked.
- The README states plainly: results come from scripted agents; B1/B3 are `not_run`; no live mode; no independent review; no license; not deployed; `X-PW-Human` is not authentication. The plan's draft disclosure (§24.5) said the author reviewed every Cypher query by hand and the author can explain every component; **that was not what happened** (the owner delegated everything), so it was replaced by what is true (`docs/AI_ASSISTANCE.md`), with two statements marked for the owner to confirm. Making a claim the owner cannot stand behind would cost more than the gap.
- **No license file was added**: the choice is the owner's (A-14). Until then the README says no rights are granted.
- **Results in the README are guarded** against drift by `tests/test_docs.py` (the table is the generated one; numbers in prose are compared with `summary.json`).
- **`make setup` and `scripts/wait_for_db.py`** were added so the plan's quickstart `make up && make demo` works from a clean clone: without a virtualenv `make demo` had no dependencies, and `make up` returned before the database accepted commands. Both were found by running the clean-clone test, not by reading.
- **Deployment is not done**: it needs the owner's accounts, and the FalkorDB capability probe must run against the chosen host first (A-15, `docs/DEPLOY.md`).

## Part B15 — UI redesign (P13–P15, 2026-10-16)

Source: `ui-redesign.md` (research and specification). Phase slicing: `docs/phases/P13-ui-redesign.md`.

### D-032 — the owner's go-ahead and how the open questions were applied
- **Status:** Accepted (agent), based on the owner's instruction of 2026-10-16: do the whole plan ("sob gulai kora lagbe"), split into phases, push each phase.
- The plan's questions Q1–Q13 (`ui-redesign.md` §23.4) were shown to the owner with a recommendation each. The instruction to implement everything is applied as acceptance of the **recommended** answer to every question, with one narrowing: Q6 (test tooling) is limited to **Vitest** (dev dependency); Playwright and axe are not installed (a ~hundreds-of-MB browser download for little gain next to the existing headless-Edge recipe). Declined options stay declined: no approve-as-is/reject UI (Q7), no workspace-reset button (Q8), no backend changes B1–B4 (Q10, Q11).
- If the owner meant otherwise for any question, each answer is independent and easy to revert.

### D-033 — deviations from plan §19 (plan.md is not edited)
- Plan §19 describes six tabs, plain CSS and polling. The redesign keeps plain CSS, polling and the six views, and adds: a public landing page at `/`, the application at `/app/`, a navigation rail, review dialogs instead of `window.confirm`, and an optional manual theme switch. Binding precedence says plan.md wins, so this entry is the explicit override the plan asked for (`ui-redesign.md` §3.8, Q2); the owner confirms or reverts it.
- `AGENTS.md` §3 "Cytoscape built-in layouts only" is kept: the lanes layout is the built-in `preset` layout with positions computed in TypeScript.

### D-034 — branch base and no merge
- `main` does not contain P8 (live mode UI, LLM judges). The redesign must preserve live mode, so P13a branches from `phase/p8-live-llm` and every later sub-phase from the previous one. The pushed branches therefore also carry the P8 commits.
- Agents do **not** merge to `main` or tag for this chain: the owner asked for pushes only, and P8 itself is not verified. Merge order for the owner: P8, then P13a … P15d.
- The uncommitted edit to `README.md` that existed when this work began (B1/B3 rows of the results table) belongs to P8 and is left untouched; every commit stages explicit paths.

### D-035 — commit hook widened to P19
- `.githooks/commit-msg` accepted only `P0`–`P12`. The redesign needs P13a–P15d, so the pattern is widened to `P0`–`P19` with an optional `a`–`d` suffix. Nothing else in the hook changed; no commit was made with `--no-verify`.

### D-036 — new dev dependency: Vitest
- Added in P13b as a **dev** dependency of `web/` only (unit tests for pure functions: `whySentence`, `lanesLayout`, `outcomeOf`, legacy redirect, URL parsing). Rationale and alternatives: `ui-redesign.md` §19.5, §21.13. No runtime dependency is added by the redesign.

### P13b notes (design foundation)
- **Fonts live in `web/src/shared/styles/fonts/`, not `web/public/fonts/`** (plan §16.4 said `public`): CSS `url()` assets are hashed and rebased by Vite, so a `base` path cannot break them. The cost is that the first-view fonts cannot be `<link rel="preload">`ed by a stable URL; if landing CLS needs it (P15a) a `?url` import in the entry HTML script will do. Families, weights and licences: IBM Plex Sans 400/500/600, IBM Plex Mono 400/500/600, Newsreader variable (200–800), all SIL OFL 1.1 from the Fontsource packages (tarballs only, no scripts run); licence texts sit next to the files. The Newsreader package also ships an optical-size (`opsz`) build, which answers the plan's U4 (not used: 132 KB vs 58 KB).
- **`@types/node` (dev only)** was added next to Vitest (it is Vitest's peer dependency) and enabled in `web/tsconfig.json` so that `fs`-based tests type-check; Vitest replaces plain CSS imports (even `?raw`) with an empty string, so `tokens.test.ts` reads `tokens.css` with `fs`.
- **`web/system.html` + `src/shared/dev/system-main.tsx`**: a development-only page that renders every primitive and token in the current theme (with a System/Light/Dark switch). It is served by `npm run dev` only; the production build does not contain it (checked: `dist/` has no reference).
- **Dev proxy fix:** `web/vite.config.ts` now proxies to `127.0.0.1:8000` (was `localhost`), see HANDOFF "Dev proxy trap".
- **`legacy.css`** is the old stylesheet rewritten on the tokens with the same class names (and the old variable names as aliases, because Cytoscape reads some of them). It shrinks as each view is rebuilt in P14 and is deleted in P14d.

### P13c notes (app shell and entry split)
- **History:** switching view or workspace uses `pushState` (the Back button returns to the previous view); the plan said `replaceState` for URL updates. In-view state will use `replaceState` (P14b `action=`). The address bar is normalised once on load: the one-shot flags (`autorun`, `autoforensics`, `autoheal`) and `key` are dropped from it after the first render, so reloading a deep link no longer re-runs the scenario (the flags still work from a pasted link; the key is stored first, see below).
- **`?key=`** is captured when `api/client.ts` loads (stored in `sessionStorage` under the same name `pw_key`), because the app now rewrites the address bar. P13d adds the visible Connect flow.
- **Legacy links:** the redirect is a tested TypeScript function (`shared/lib/legacyRedirect.ts`) run by the landing entry before anything renders, not an inline script, so the list of parameters cannot drift from its tests. It forwards `/?tab=…&ws=…` (the MCP gateway's "Review at" link) to `/app/` with the identical query and hash; a plain visit or unrelated parameters (`?utm_source=…`) show the landing page.
- **Navigation order** is Run, Investigate, Memory, Time travel | Remediate, Evaluation (plan Q9, labels unchanged). Tab ids and deep-link parameters are unchanged.
- **Views were not moved** to `app/views/` (plan §19.2): they stay in `web/src/tabs/` until each is rebuilt in P14, to avoid renames that carry no behaviour. `App.tsx` became `app/Shell.tsx` + `app/url.ts`; `main.tsx` became `app/main.tsx`.
- **Polling:** every `usePoll` now skips ticks while the tab is hidden or a POST is in flight (the POST holds the workspace lock) and refreshes when the tab is visible again / the POST ends. The rail polls `GET /actions` every 5 s for the attention count; like opening Investigate it creates the workspace graph from the registry if it does not exist yet.
- **Case-insensitive filesystems:** `nav.ts` next to `Nav.tsx` is a collision on Windows and macOS (found by `tsc`); the model file is `navModel.ts`.
- **Manual theme switch (O6)** lives in the status footer; the stored choice is applied before the app renders.
- **The landing page is a placeholder** until P15a (Known gap G-004).

### P13d notes (access and onboarding)
- **No new authentication model.** Hosted access is still one bearer key per workspace (`docs/SECURITY.md`); the UI only gained a usable front end for it. Client-side checks (workspace pattern, key length 8) mirror `api/auth.py` to save a round trip; what the server answers (401, 403) is what the user is told. No accounts, no password recovery, no client-only access control.
- **The probe is `GET /api/ws/{ws}/scenarios`**: it passes the same access dependency as every workspace route but only returns the static scenario list, so it touches no graph. Only the four workspace views (Run, Investigate, Memory, Time travel) show the Connect screen; Remediate and Evaluation stay readable without a key (public demo data, `ui-redesign.md` §10.5). Remediation apply/reset still need a key and report their own 401.
- **Key handling:** kept in `sessionStorage` (`pw_key`, tab-scoped) and in memory; sent only as `Authorization: Bearer`; removed from the address bar after load (`?key=` is captured when `api/client.ts` loads); `<meta name="referrer" content="no-referrer">` on `/app/`; **Sign out also forgets a build-time `VITE_API_KEY`** (otherwise signing out would do nothing). The key is never rendered, not even masked.
- **Returning visitors** (no query string) land on the view they used last (`pw_onboarding.lastTab` in `localStorage`, convenience only, try/catch). A deep link always wins.
- **Story guide:** only the data model and its storage are built here (`app/guide.ts`, tested: six steps, presets never carry `autorun`, corrupt storage falls back to a fresh start); the guide UI arrives with the Run view in P14a.

### P14a notes (Run view)
- **A display bug of the old Run tab was fixed, not ported.** It called a run LEAKED whenever the public page matched `PWDEMO-` or `### Checksum`, so the benign `benign_lookalike` (which quotes the documented example key `PWDEMO-SECRET-00000000-NOT-A-REAL-KEY`) was labelled LEAKED even with the guard on. The plan's rule is now implemented and tested: LEAKED needs the guard to be off (`reason GUARD_OFF`) **and** a matching page; a gated release is POSTED. The check stays a display check of the page text, labelled as such, never a gate verdict.
- **Outcome wording** is a pure function of the API's last action (`runLogic.outcomeOf`, `OutcomeStrip.presentOutcome`): HELD, BLOCKED, LEAKED, POSTED, POSTED · WARNING (`SECRET_EGRESS_WARNING`), POSTED · GUARD OFF, NOTHING PROPOSED, and an `other` that shows an unknown status in capitals instead of guessing. The strip does not show `0 LLM calls` (the run result has no such field); that figure comes from `GET /actions/{id}` and is shown on the case file (P14b).
- **First view moved to `app/views/run/`**; the other five stay in `web/src/tabs/` until they are rebuilt. `api/client.ts` re-exports `ApiError` from the new side-effect-free `api/errors.ts` (importing the client touches `window`, which broke unit tests). The error catalogue (`app/errorCatalogue.ts`, plan §13.12) is shared by all views from here on.
- **`?autorun=1` runs once per page load** (a ref guards React StrictMode's double effect run; the old tab ran twice in development).
- **Feedback during a run** follows the response-time limits: under 1 s only the button label changes; after 1 s a status block says what is running and for how long (no percent, no estimate: the API reports none); the result is announced politely and focus moves to the verdict heading.
- **Story guide:** steps 1 and 2 are completed by the Run view (a LEAKED run, a HELD run with the guard on); steps 3–6 will be completed by the views they belong to. The guide never runs anything for the user.
- **Disabled options say why in visible text** (shared `SegmentedControl` fix): a disabled option's hint is always shown next to the selected option's hint.
- **Not exercised:** `LivePanel` renders the live-agent summary of `RunResult.live` but was not run against a real live run (it spends provider tokens; the repo rules say to ask first). Its stop-reason mapping is unit-tested.

### P14b notes (Investigate: queue and case file)
- **The page never invents what the API does not return.** The *Decided* box shows the status recorded in the graph; the *Gate now* box shows the verdict the gate computes again every time the case opens (`GET /actions/{id}` re-gates). After forensics quarantines the lineage the two differ (HELD vs BLOCK `QUARANTINED_LINEAGE`), and the page says why in one sentence instead of hiding either. The reason the gate gave at decision time is not stored or returned, so it is not shown. The order of an LLM forensic run's tool calls is not recorded either, so an LLM report shows the findings and says no order is shown; only the scripted report is a numbered step list.
- **The why sentence is built from the gate result only** (`caseLogic.whySentence`): the payload's key, the untrusted source and the number of steps, the memory that carried it (key, author, day, "and N more"), the secret source and its steps; for a quarantined lineage it names the quarantined ancestors. It never reads artifact `content` (hard rule 3).
- **Witness paths are the signature component.** Each path is an ordered list from the payload to its source, named by the key people know (`team_convention:42`) with the id after it, plus facts (kind, agent, day, quarantined). Untrusted is a solid rail and secret a dotted rail, and each is also written as a word with its step count and the name of the query that computed it (`q2a_untrusted_witness`, `q2b_secret_witness`). "Show the query" shows the exact text the API returns; nothing is written client-side (hard rule 1).
- **Release is a deliberate act behind a review dialog** (§13.11): what will happen, what already happened automatically (the quarantine id and artifact count), the first lines of the healed payload, and who is on record (`maintainer`, header `X-PW-Human: true`). The dialog opens focused on Cancel, Esc closes it and returns focus to the button that opened it. Forensics itself carries no human header (quarantine is risk-reducing); the heal approval is the only human call in this view.
- **A stale `?action=` link is announced, not followed silently.** Ids restart at `act-0001` after every run, so a saved link can name an action that does not exist; the view then opens the first case that needs a decision and says which id was not found. A 404 mid-session shows a separate notice with a button to the current actions.
- **`?autoforensics=1&autoheal=1`** still run the whole flow once on load (forensics, then the heal approval once the report recommends it); the flags are removed from the address bar, which keeps `action=`.
- **The open action is in the address bar** (`?tab=investigate&action=act-0001`, `replaceState`, so the back button is not filled with every click). "When was this written?" opens Time travel at the logical time of the `poisoned_memory_written` marker from `GET /graph-at`, never a value computed by the page; Back returns to the same case.
- **The lineage graph is still the old Cytoscape component** with its legacy colours; P14c replaces its layout, drawer and trace. The graph is a figure with a caption that states the counts and both step counts in text.
- **Layout fix with a general cause:** `.pw-visually-hidden` is absolutely positioned; inside a scroll box that is not itself positioned, the hidden header cell of a wide table's last column escaped the box and made the page 125 px too wide on a phone. `.pw-scroll` is now `position: relative` (this also covers the Run view's event table), and every grid of the case file pins its columns to `minmax(0, 1fr)`; a unit test reads the CSS for that rule.
- **Legacy CSS removed** (`.split`, `.actions`, `.query`, `.diff`, `.item`, `.status`, `.del`, `.add` and their two tokens) after grepping that nothing else used them; the old `tabs/Investigate.tsx` is deleted.

## Part C — Probe outcomes (P0, 2026-10-15; `make probe` = 35 PASS, 0 FAIL, 0 NOTE)

Environment: FalkorDB image `falkordb/falkordb@sha256:b0bdcac2cbaff989e77cb0610439b7a9289e86de033ccbbd4368b66fb680ae7a` (created 2026-10-14; graph module `ver 42201`, server `redis_version 8.10.2`) · `falkordb` Python client **1.8.0** · Python 3.11.9. D-012 is done: compose and CI pin that digest.
Verification of the probe itself: all 43 Cypher blocks of plan §10 are present verbatim in the probe (checked programmatically); a sabotaged copy (sanitized exclusion removed from q2a and q4) makes exactly the 3 relevant checks fail (A07, A12, B05), so the checks are not vacuous.

| Probe item | Result | Verified syntax / fallback |
|---|---|---|
| connect + params, `ro_query` | PASS | `FalkorDB(host, port, password)`, `g.query(q, params)`, `g.ro_query(q)`; `ro_query` rejects writes |
| **graph list / delete method names** | PASS, **plan §6 is wrong** | `db.list()` **does not exist** in client 1.8.0 → use `db.list_graphs()`. Delete is `Graph.delete()`. (`api/graph/client.py` already uses `list_graphs`.) |
| `Graph.copy` | PASS | `g.copy(dest_name)`; copying onto an existing graph raises; delete the destination first |
| index DDL (§7.5) | PASS | all 7 `CREATE INDEX FOR (x:L) ON (x.p)` statements run (`indices_created` = 7); `list_indices()` available |
| multi-type variable-length `[:A\|B*1..16]` | PASS | no `UNION` fallback needed for q2a/q2b |
| `none()` + `coalesce` over `nodes(path)` | PASS | q2a semantics verified incl. sanitized-only path → no witness |
| list projection, list concatenation | PASS | `[1,2] + [3]`, `[n IN nodes(p) \| n.id]` |
| `algo.maxFlow` docs example + edge property projection | PASS | A→B 10, A→C 5, B→C 8 ⇒ maxFlow 13 with flows A->B 8, A->C 5, B->C 8; **`edges[i].cap_id` projection works → r2 primary, no fallback**. `maxFlow` comes back as a **float** (e.g. `0.0` when nothing flows, and after revocation r2 returns one row `[0.0, [], []]`) — treat as float in P6 |
| `UNWIND`+`CREATE`+`DELETE` of relationships (r3) | PASS | properties copied to `REVOKED_FLOW` |
| list-of-maps parameters | PASS | |
| `OPTIONAL MATCH … WHERE` keeps the outer row (q4) | PASS | root with only a sanitized descendant is returned with `descendants = []`; with an unsanitized descendant it is included, sanitized excluded |
| `STARTS WITH` | PASS | **prefix `a-` also returns `a-sbx-0003`** → the exact-regex filter `^a-(\d+)$` in Python is mandatory (as plan §9 says) |
| `ORDER BY` on a returned alias + `LIMIT` | PASS | `q1_lookup_key`; `count(a)` returns a row with 0 for an absent key |
| property of a matched node inside `CREATE` | PASS | `agent_id: s.agent_id`, `task_ref: s.task_ref` copied; `''` stored (not null) |
| `MERGE` on a node | PASS | idempotent |
| empty `UNWIND` + `RETURN count(...)` | PASS | **returns a row with 0** (plan's "no rows" fallback not needed); the artifact created before the `UNWIND` still exists |
| `q0_max_ts` on an empty graph | PASS | returns `[[None]]` → the runtime must start the clock at 1 (as plan §9 says) |
| client query timeout | PASS | `g.query(q, params, timeout=ms)` exists and **is enforced** (raises `ResponseError`) |
| every §10 query (q0–q8, r1–r7) smoke-run on an attack graph / capability graph built with the runtime's own `q1_*` queries | PASS | witnesses `[a-0006,a-0004,a-0001,src:issue:42]` (3 hops) and `[a-0006,a-0005,src:env:PAYMENT_API_KEY]` (2 hops); q3 names `team_convention:42` written Mon by triage; q4 preview = raw issue + memories + draft with the sanitized `task:42` excluded; q5 gives all-green Rule-of-Two letters; q6 = 11 edges; q8 flags the convention; quarantine is enforced on `q1_load`/`q1_lookup_key`/`q2c` and reversible (q4c/q4d); approval cuts both witnesses |

Consequences recorded: **A-03 Resolved** (a client `timeout` kwarg exists and is enforced → `policy.query_timeout_ms` can be wired; the hop bound is still a literal in the Cypher, so keep the test that asserts it equals `policy.max_lineage_hops`). **A-13 Resolved** (API port 8000; env names `PW_FALKORDB_HOST/PORT/PASSWORD`). Plan §6 should be corrected by the human: `names = db.list()` → `db.list_graphs()`.

### D-015 — ruff must never touch Markdown (incident, 2026-10-15)
- **Status:** Accepted · **Phase:** P0
- **What happened:** the first `make fmt` ran `ruff format .`; ruff 0.17 formats Python code blocks inside Markdown, which rewrote 11 code blocks in `plan.md` (whitespace/line-breaks only; no content change). Detected from the "file changed on disk" notice, reverted with `git restore -- plan.md` (verified identical to HEAD).
- **Fix:** `pyproject.toml` excludes `*.md`, `docs`, `plan.md`; the Makefile passes explicit folders (`api tests scripts`); `tests/test_invariants.py::test_formatter_and_linter_never_touch_markdown_or_the_plan` guards both.
