# P1 — Graph layer, runtime, replay

> **Tier 1** · Branch `phase/p1-runtime` · Depends on: P0 DONE (probe results and fallbacks recorded)
> **Read in plan.md (only these):** §7 (7.1–7.5), §8.1–8.5 and 8.9, §9, §10 (`q0_*`, `q1_*`, and `q2d`), §20.1, §22-P1, §4 rules 2, 4, 5, 6

## 1. Objective
Create the graph schema and seed loader, the registry, and a `Runtime` that turns tool calls into lineage writes with namespaced ids and a logical clock — plus a replay engine that rebuilds a graph from the shared event format (§20.1). Everything the gate, agents and evaluation stand on.

## 2. Requirements covered
F1 (lineage runtime), F3 (per-key secret sources, `sanitize`), F4 (`approve` recorded in the graph), groundwork for F5/F13 (workspace-parameterised graph names).
**Out of scope:** gate queries `q2a–q2c` (P2), orchestrator and sinks (P3), forensic queries (P4).

## 3. Prerequisites
P0 DONE. Probe outcomes (empty-`UNWIND` behaviour, delete method name, index DDL) are in `DECISIONS.md` Part C.

## 4. Files expected to change
Create: `fixtures/{registry,registry_eval,env,policy}.yaml`, `fixtures/issues/issue_42.md … issue_45.md`, `fixtures/docs/security_guide.md` · `api/graph/{schema.py,loader.py}` and `api/graph/queries/` files `q0_max_ts`, `q0_ids_with_prefix`, `q1_seed_agents`, `q1_seed_sources`, `q1_seed_sinks`, `q1_add_agent`, `q1_add_source`, `q1_start_session`, `q1_session_context`, `q1_read_source`, `q1_load`, `q1_write`, `q1_sanitize`, `q1_propose`, `q1_approve_artifact`, `q1_set_action_status`, `q1_supersede`, `q1_lookup_key`, `q1_key_exists`, `q1_lookup_prefix`, `q1_get_artifact`, `q2d_action_context` (all `.cypher`) · `api/runtime/{registry.py,runtime.py,events.py,replay.py}` · `tests/runtime/*`. Extend `tests/test_invariants.py`.
Exceptions live in `api/runtime/runtime.py` (matching the §21 layout); if a new file is wanted, record it in DECISIONS.

## 5. Tasks
- [ ] **P1-T1 Fixtures, verbatim** from §8.1–8.5 and §8.9 (no `topologies/`, `gateway.yaml`, `api_keys.yaml` yet). Only `PWDEMO-…-NOT-A-REAL-KEY` fakes (rule 9).
- [ ] **P1-T2 Query loader.** Load `*.cypher` by file name from `api/graph/queries/`; clear error on a missing name; parameters passed as a dict, never interpolated. Reads use `ro_query` where the client documents it.
- [ ] **P1-T3 Schema, seeding, reset.** Create indexes (§7.5) with the DDL verified in P0; seed agents/sources/sinks with `q1_seed_*`; `reset(workspace)` = delete graph (method per P0) → create → seed. Pydantic `Registry` models validating `registry.yaml` (tool classes read/sanitize/write/load/external; unknown values rejected).
- [ ] **P1-T4 `LogicalClock` and `EventLog`.** Integer clock; events appended in the §20.1 shape to `state/<ws>/events.jsonl`; no wall-clock values anywhere in the graph.
- [ ] **P1-T5 Runtime construction.** Resolve A-01 (record the final signature). State from the graph: clock = `q0_max_ts` + 1 (1 for empty); counters from `q0_ids_with_prefix`, keeping only ids matching `^<prefix>(\d+)$` exactly. Namespaces `""` (main) and `sbx` (sandbox) produce disjoint ids (§7.2, §9).
- [ ] **P1-T6 Read side:** `start_session`, `read_source` (id must start with the tool's `source_prefix` **and** exist in the registry, else fail closed), `load` (QuarantinedError / ArtifactNotFoundError via `q1_get_artifact`), `load_by_key` (latest non-quarantined; `q1_key_exists` separates "never written" from "all quarantined"), `load_by_prefix` (one latest version per key, in `created_at` order, may be empty).
- [ ] **P1-T7 Write side:** `write` (context read from the graph with `q1_session_context` immediately before; `DERIVED_FROM` every context artifact; assert `derived_edges == len(context_ids)` using the P0 result for the empty case), `sanitize` (single input only, `sanitized=True`), `propose` (Action `proposed` + PAYLOAD + TARGETS + PROPOSED), `approve` (resolve payload with `q2d`, then `q1_approve_artifact`; resolves A-02), status/supersede helpers. Optional strings stored as `""`, never null.
- [ ] **P1-T8 Fail-closed errors:** `UnknownToolError`, `ToolClassError`, `QuarantinedError`, `ArtifactNotFoundError`, `KeyNotFoundError`; unknown sink or source → error, never a silent create.
- [ ] **P1-T9 Replay** (`replay.py`): execute a §20.1 event list (`start_session`, `read_source`, `sanitize`, `write`, `load`, `approve`, `propose`) mapping local refs to real ids; seed scenario `extra_sources` with `q1_add_source` and extra agents from `registry_eval.yaml`.
- [ ] **P1-T10 Tests and invariants** (below), including "runtime issues only named queries" and fixture-secret format checks.

## 6. Tests and validation
Every item from §22-P1: raw read creates `ORIGINATES_FROM` with correct trust · write derives from exactly the context · sanitize derives from exactly one input · new session has empty context · loading a quarantined artifact raises · unknown tool raises · replay of the §20.1 example builds the expected edges · `load_by_key` returns the latest non-quarantined version · `load_by_prefix` skips quarantined and keeps one version per key · a Runtime re-opened on an existing graph continues ids and clock without collision · a sandbox Runtime creates only `-sbx-` ids.
Additionally: prefix `a-` never counts `a-sbx-0003` · `content_hash` is sha256 of content · two agents' sessions never share context · a second write in a session also derives from the first write's artifact · class mismatch (`ToolClassError`) · edge-set equality (not just counts) for the replayed example.

## 7. Acceptance criteria
1. All listed tests pass on a real FalkorDB with `make test` and no API key.
2. The §20.1 example event list replays into a graph whose edge set equals a hand-written expectation.
3. Re-creating the Runtime mid-scenario yields no id or clock collision.
4. No Cypher in `api/runtime/` — only named queries; no string-formatted parameters.

## 8. Risks and failure scenarios
- Id/clock collisions after restart or between namespaces → silent graph corruption (hence tests 5 and 6 above).
- Keeping session context in Python instead of the graph → violates §9 and breaks restarts.
- Empty-`UNWIND` quirk makes `q1_write` return no row → false "derive failed" or silent under-linking.
- `null` instead of `""` in optional properties → later `STARTS WITH` / equality queries misbehave.
- Concurrent API requests racing the Python counter (relevant from P3): note the single-writer-per-workspace requirement now.
- Replay ref-mapping errors producing plausible but wrong graphs → compare edge *sets*.
- Registry that fails open on an unknown tool → violates rule 6.

## 9. Definition of Done
All tasks ticked with evidence · G1, G2, G4 (P1 additions), G5, G6, G10 · A-01 and A-02 marked Resolved in DECISIONS · PROGRESS/HANDOFF updated · PR merged · tag `phase-p1-done`.

## 10. Git checkpoints
`P1: feat(fixtures): registry, env, policy, issues` · `P1: feat(queries): query loader and schema` · `P1: feat(runtime): sessions, reads, loads` · `P1: feat(runtime): writes, sanitize, propose, approve` · `P1: feat(runtime): replay engine` · `P1: test(runtime): lineage and id-namespace tests` → PR → merge → tag.
