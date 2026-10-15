# P4 — Forensic Agent, quarantine, healing, memory API

> **Tier 1** · Branch `phase/p4-forensics` · Depends on: P3 DONE · **Different-agent review recommended before merge**
> **Read in plan.md (only these):** §10 (`q3`, `q4`, `q4b`, `q4c`, `q4d`, `q8`), §13 (13.1, 13.2, 13.4, 13.5), §7.1, §9 (sandbox namespace), §18 (forensics, heal, quarantine, memory, artifacts), §22-P4, §4 rules 3, 8

## 1. Objective
Investigate a held action using metadata-only graph tools, quarantine everything derived from the untrusted source (reversibly), replay the work in a sandbox copy, show a diff, and let a human approve the healed release. Plus the memory-inventory API.

## 2. Requirements covered
F6 (scripted Forensic Agent), F7 (retroactive quarantine), F5 (sleeper root cause), F4 (human approval of healing).
**Out of scope:** the LLM forensic plan (P8), UI (P10a/b), auth header enforcement (P11).

## 3. Prerequisites
P3 DONE (`q3` already exists; `explain` works). Probe outcomes for `copy`/delete and `OPTIONAL MATCH … WHERE`.

## 4. Files expected to change
Create: `api/forensics/{agent.py,tools.py,report.py}` · queries `q4_quarantine_preview`, `q4b_affected_actions`, `q4c_quarantine_apply`, `q4d_quarantine_release`, `q8_memory_inventory` · `api/routes/{forensics.py,memory.py}` · `tests/forensics/*`.
Modify: `api/routes/actions.py` (artifact `?graph=sandbox`), `api/graph/client.py` (copy/delete/list per P0), `tests/test_invariants.py`, `docs/DECISIONS.md` (A-10).

## 5. Tasks
- [x] **P4-T1 Queries** `q4`–`q4d`, `q8` verbatim, with direct tests — including the P0 finding that a root whose only descendants are sanitized is still returned.
- [x] **P4-T2 Tools** (`tools.py`): `get_witnesses`, `trace_memory`, `preview_quarantine` (ids = sorted(set(roots+descendants) − {None})), `apply_quarantine` (idempotent: a second call must not create a second `Quarantine` node for the same artifacts), `sandbox_replay`, `gate_in_sandbox`, `list_memory_inventory`. Outputs are metadata only.
- [x] **P4-T3 Sandbox replay.** Delete `pw_<ws>__sbx` if present → `copy` main (destination must not exist) → sandbox Runtime (namespace `sbx`, sinks disabled) re-runs Fixer and Release for the held action's `task_ref` → returns the new action id (`act-sbx-…`).
- [x] **P4-T4 `ForensicReport`** (Pydantic, §13.4 fields) and the scripted plan (§13.2): witnesses → laundering → preview → apply → replay → gate in sandbox → report. `recommendation = APPROVE_HEALED_RELEASE` only if the sandbox verdict is ALLOW, else `ESCALATE_TO_HUMAN`. `mode="scripted"`, `fallback_used=false`, `llm_calls=0`.
- [x] **P4-T5 Heal approval** `POST /heal/{id}/approve`: read `task_ref`, fresh main Runtime (ids continue from graph state), re-run Fixer and Release (A-10: same mode as the original run), gate (expected ALLOW), execute, `SUPERSEDED_BY`, old status `superseded`.
- [x] **P4-T6 Endpoints:** `POST /forensics/{id}` (`mode:"llm"` → `{"error":"llm_not_configured"}` until P8), `POST /quarantine/{qid}/release` (q4d), `GET /memory` (q8), artifacts with `?graph=main|sandbox` and **no fallback between graphs**.
- [x] **P4-T7 Tests** (below) and the **sabotage check**: make `q4` include sanitized descendants → the test asserting `task:42` stays unquarantined must fail; restore.
- [x] **P4-T8 Invariant:** recursive test that no forensic tool output contains a `content` key.

## 6. Tests and validation (§22-P4)
Report for `attack_pipeline_42` names `team_convention:42` and keeps `task:42` unquarantined · sandbox verdict ALLOW · healed draft contains no `PWDEMO-` and no checksum block · heal approval executes a clean release and supersedes the old action · sleeper (`attack_sleeper_44`) report identifies `src:issue:42` · no tool output contains `content` · quarantine release (q4d) restores and works · healed payload id has the `-sbx-` namespace and is fetchable with `?graph=sandbox` · after heal approval, new main-graph ids do not collide with sandbox ids.
Also: applying quarantine makes later `load_by_key`/`load_by_prefix` skip those artifacts · `affected_actions` lists the held action · re-running forensics is idempotent · main graph is unchanged by `sandbox_replay` except what quarantine already did.

## 7. Acceptance criteria
1. All §22-P4 tests pass on real FalkorDB with no API key.
2. Forensics on both `attack_pipeline_42` and `attack_sleeper_44` yields a correct `ForensicReport` with `recommendation = APPROVE_HEALED_RELEASE`.
3. The full loop works through HTTP: run attack → forensics → heal approve → clean release visible in the sink.
4. Sabotage check recorded; recursive no-`content` invariant green.

## 8. Risks and failure scenarios
- **Over/under-quarantine:** too much destroys legitimate memory; too little leaves the poison. The sanitized-descendant exclusion is the crux (T7).
- `GRAPH.COPY` semantics: destination must not exist; stale sandbox from an earlier run; indexes/constraints copied.
- Id collisions between sandbox and main after healing (namespaces are the mitigation; test it).
- Sandbox accidentally writing real sink files.
- A forensic tool leaking `content` (rule 3).
- Heal approval is risk-increasing and currently unauthenticated until P11 → Known gap.
- Idempotency: double `apply_quarantine` / double heal approve creating duplicate nodes or releases.
- `q4` hop bound 20 vs policy 16 (A-03).

## 9. Definition of Done
Tasks ticked with evidence · G1, G2, G4 (P4 additions), G5, G6, G8, G10 · independent review done · A-10 recorded · tracking updated · PR merged · tag `phase-p4-done`.

## 10. Git checkpoints
`P4: feat(queries): quarantine and memory-inventory queries` · `P4: feat(forensics): metadata-only tools` · `P4: feat(forensics): sandbox replay` · `P4: feat(forensics): report and scripted plan` · `P4: feat(api): forensics, heal, quarantine release, memory` · `P4: test(forensics): acceptance and sabotage evidence` → PR → review → merge → tag.
