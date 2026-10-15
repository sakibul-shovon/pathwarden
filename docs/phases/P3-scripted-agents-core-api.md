# P3 — Scripted agents, demo scenarios, core API

> **Tier 1** · Branch `phase/p3-scripted-api` · Depends on: P2 DONE
> **Read in plan.md (only these):** §12.1, §12.2, §12.4, §8.4 (issue texts), §9 (Orchestrator bullet), §10 (`q3`, `q5`, `q6`, `q6b`), §11, §18 (core endpoints + `RunResult`), §5, §22-P3, §4 rules 6, 8, 10

## 1. Objective
Deterministic scripted Triage/Fixer/Release agents that reproduce the attack, an orchestrator that proposes → gates → executes mock sinks, the six demo scenarios, and the core REST API. After this phase the central story works end-to-end through HTTP.

## 2. Requirements covered
F10 (Rule-of-Two badges via `q5`), F11 (scripted agents), F5 (`attack_sleeper_44`, `q3`), F4 (approve/reject API), F3 (TaskSchema sanitizer), F1 end-to-end.
**Out of scope:** forensics/heal/quarantine endpoints (P4), live agents (P8), auth (P11), timeline/graph-at (P7), eval/remediation routes.

## 3. Prerequisites
P2 DONE. Decide A-05 (`make demo`) and A-06 (explain needs `q3/q6/q6b` now).

## 4. Files expected to change
Create: `api/agents/{schema.py,scripted.py,render.py}` · `api/runtime/{orchestrator.py,sinks.py}` · `api/scenarios/demo.py` · `api/graph/queries/{q3_laundering_memory,q5_session_facts,q6_lineage_subgraph,q6b_node_details}.cypher` · `api/routes/{workspace.py,actions.py}` · `tests/agents/*`, `tests/api/*`.
Modify: `api/main.py` (routers, error handler `{"error","detail"}`, per-workspace write lock), `docker-compose.yml` (add `api`), `Makefile` (`api`, `demo`), `tests/test_invariants.py`.

## 5. Tasks
- [ ] **P3-T1 `TaskSchema` and scripted extractor** (§12.1/§12.2 rules for component/severity/kind). Invalid → **no** sanitized artifact, error recorded in the session (fail closed).
- [ ] **P3-T2 `render_changelog(title, n, env_values, conventions, cite_doc) -> str`** — one pure function in `render.py` (Deployment diagnostics, base64 Checksum, doc citation exactly per §12.2). P5 reuses it; never duplicate.
- [ ] **P3-T3 Scripted Triage / Fixer / Release** per §12.2 including flags `disable_compromise` and `cite_security_guide`, the env-key selection rule (named keys → only those; mentions `.env` → all four; else `PORT`), `load_by_prefix("team_convention:")`, Release payload = latest non-quarantined `changelog:N`.
- [ ] **P3-T4 Orchestrator and sinks.** After `propose` call `gate.decide`; ALLOW → append payload to `state/<ws>/sinks/<sink_id>.jsonl`, status `executed`; guard off → execute with reason `GUARD_OFF`; sandbox runtime → sinks are no-ops. Gate exception ⇒ not executed. One writer per workspace (lock) so counters cannot race.
- [ ] **P3-T5 Demo scenarios** (§12.4, six of them) as data + runner; expected verdicts are the plan's literal table, **not** computed from the system.
- [ ] **P3-T6 Queries and services:** `q3`, `q5` (A/B/C logic in Python: `A='untrusted' in trusts`, `B='secret' in trusts`, `C = True in sink_external or state_writes>0`, green iff A+B+C ≤ 2), `q6`, `q6b`; `explain` returns GateResult, laundering, subgraph, query texts (A-06).
- [ ] **P3-T7 Endpoints:** `/health`, `/ws/{ws}/reset`, `/scenarios`, `/scenarios/{name}/run` (`RunResult` per §18), `/actions`, `/actions/{id}`, `/actions/{id}/explain`, `/actions/{id}/approve`, `/actions/{id}/reject`, `/artifacts/{id}?graph=main` (a `graph=sandbox` request returns a clear "not available until P4" error code), `/sessions/{id}/rule-of-two`, `/sinks/{sink_id}`. Error format per §18.
- [ ] **P3-T8 Export / replay round-trip:** export a demo run as a §20.1 scenario and replay it; edge sets must be equal.
- [ ] **P3-T9 `make api`, `make demo`** (A-05: runs the six scenarios, prints a verdict table, exits non-zero on any mismatch) and the compose `api` service.
- [ ] **P3-T10 Determinism (G7):** reset + run each scenario twice → identical `RunResult` (ignoring latency).

## 6. Tests and validation
API tests with `httpx` against the app and real FalkorDB. Expected results come from §12.4:
`benign_43` ALLOW/executed · `attack_pipeline_42` HOLD/`TRIFECTA` · `attack_sleeper_44` HOLD on the #44 release and `q3` names `team_convention:42` written Mon by triage · `attack_disguise_45` HOLD with a payload containing base64 only (assert no verbatim `PWDEMO-`) · `benign_lookalike` ALLOW · `benign_port_only_42` ALLOW.
Also: guard off → the fake secret `PWDEMO-SECRET-7f3a9c21-NOT-A-REAL-KEY` appears in the sink content · all three sessions of `attack_pipeline_42` have green badges · unknown scenario / workspace → error JSON · `approve` on a HELD action records an `Approval` and executes only if the gate then says ALLOW.

## 7. Acceptance criteria (plan §22-P3 plus measurable additions)
1. Every demo scenario returns its expected verdict via the API.
2. Guard-off attack shows the fake secret on the mock sink.
3. All sessions in `attack_pipeline_42` have green badges.
4. `make demo` exits 0 on a clean reset; two consecutive runs are identical (G7).
5. Export→replay round trip reproduces the same edge set.

## 8. Risks and failure scenarios
- Scripted agents drifting from §12.2 (env-key rules, which artifacts are loaded) silently change what the gate sees; encode §12.2 literally and test each rule.
- `render_changelog` duplicated or non-pure → P5 and P3 disagree.
- Counter races under concurrent requests (lock missing).
- Orchestrator executing after a gate exception.
- `approve`/`reject` are unauthenticated until P11: list under **Known gaps**, do not pretend it is hardened.
- Mock sink files on Windows paths/encodings; `state/` must stay gitignored.
- API restart mid-scenario → ids must continue from graph state (P1 guarantees; test it once here).

## 9. Definition of Done
Tasks ticked with evidence · G1, G2, G4, G5, G6, **G7**, G8, G10 · A-05/A-06 Resolved · unauthenticated approve listed in Known gaps · tracking updated · PR merged · tag `phase-p3-done`.

## 10. Git checkpoints
`P3: feat(agents): task schema, extractor, render_changelog` · `P3: feat(agents): scripted triage, fixer, release` · `P3: feat(runtime): orchestrator and mock sinks` · `P3: feat(queries): laundering, session facts, subgraph` · `P3: feat(api): core endpoints` · `P3: feat(scenarios): six demo scenarios and make demo` · `P3: test(api): scenario verdicts and determinism` → PR → merge → tag.
