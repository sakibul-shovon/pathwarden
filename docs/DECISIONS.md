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
| A-05 | §21, §24.6 | `make demo` is required to work but never specified | Runs the six §12.4 scenarios through the API/CLI and prints a verdict table; non-zero exit if any expectation differs | P3 |
| A-06 | §18 vs §22 | `GET …/actions/{id}/explain` returns laundering + subgraph (q3, q6, q6b), but P4 owns q3 | Build q3/q6/q6b and `explain` in P3; P4 reuses | P3 |
| A-07 | §17, §18 | Which endpoints need `X-PW-Human`? Remediation and eval endpoints are not workspace-scoped, so API keys cannot scope them | Human-only: action approve/reject, heal approve, quarantine release, remediation apply/reset/suggest-apply. Remediation/eval read endpoints are global and public-demo data. Record the list. | P11 |
| A-08 | §20.4–20.5 | Decision latency p50/p95 is wall-clock, but "non-LLM defenses must be byte-identical across runs" and `make eval` twice must give identical files | Write latency to a separate non-deterministic file (e.g. `eval/results/latency.csv`, gitignored or excluded from the identity check); `results.csv`/`summary.md` hold only deterministic columns | P5 |
| A-09 | §14 | The two time-travel markers ("poisoned memory written", "draft doubly tainted") need artifact-level taint, but rule 1 forbids new Cypher and §10 has no such query | Compute in Python from existing `q7` edges + `q6b` details (BFS over the returned subgraph). No new Cypher. Needs human OK because rule 1 says ask. | P7 |
| A-10 | §13.5, §18 | Heal approval "re-runs Fixer and Release" — scripted or live? And `POST /forensics` accepts `mode:"llm"` before P8 exists | Heal re-run uses the same mode as the original run (scripted by default). `mode:"llm"` returns `{"error":"llm_not_configured"}` until P8. | P4/P8 |
| A-11 | §8.8 vs §16.3, §5 | `gateway.yaml` says the gateway spawns upstreams as stdio subprocesses, yet compose lists a `mock-upstreams` service | Decide after `probe_mcp.py`; likely the service just hosts the code image / is unused for stdio | P9 |
| A-12 | §17, §21 | Is `fixtures/api_keys.yaml` committed? Hosted keys must not be | Commit demo keys only (`pwdemo-…`, non-provider format); hosted keys via an env-selected file or env var | P11 |
| A-13 (**Resolved in P0**) | §6, §23 | API port, FalkorDB env var names not specified | Port 8000 (Uvicorn default); `PW_FALKORDB_HOST/PORT/PASSWORD` (see `.env.example`) | P0 |
| A-14 | §12.3, §24 | LLM provider and README license. **Provider = Groq** (human, 2026-10-15). **Still open: exact model, the key itself (goes only in the local `.env` as `PW_LLM_API_KEY`), and the license** | Via LiteLLM a Groq model is addressed as `groq/<model>` (to be confirmed by the P8 probe — rule 13; also confirm how the key is passed). Pick the model at P8 from Groq's current list. Free-tier rate/token limits may throttle the live study and the B3 full-trace judge (long prompts): measure in the probe, add backoff, reduce nothing silently. License: the human chooses (e.g. MIT or Apache-2.0) before P12-T6 | P8/P12 |
| A-15 | §23 | Hosted FalkorDB (Cloud/Railway) support for `GRAPH.COPY` and `algo.maxFlow` is not stated | Run `make probe` against the hosted endpoint as soon as one exists (before P12) | P0 (local) / P12 |
| A-16 | §6 | No frontend test tooling in the stack; UI cannot be regression-tested automatically | Gate UI with `npm run build` (strict TS) + a manual acceptance checklist with recorded evidence; ask before adding Vitest/Playwright | P10a |

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
