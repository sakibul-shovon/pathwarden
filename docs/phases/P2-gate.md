# P2 — Gate

> **Tier 1** · Branch `phase/p2-gate` · Depends on: P1 DONE · **Different-agent review recommended before merge**
> **Read in plan.md (only these):** §10 (`q2a`–`q2d`, with their ⚠️ PROBE notes), §11, §7.3, §22-P2, §4 rules 3, 6, 7, 8

## 1. Objective
The deterministic gate: for a proposed external action, run graph path queries and return ALLOW / HOLD / BLOCK with witness paths, writing the verdict to the graph and to a log. No content, no LLM.

## 2. Requirements covered
F2 (gate with witness paths), F4 (an approved payload passes), the semantic core of F5. Rules 3, 6, 7.
**Out of scope:** scripted agents and API (P3), forensics (P4).

## 3. Prerequisites
P1 DONE (runtime, replay, `q2d` already exists). P0 outcome for multi-type variable-length paths: if it FAILED, `q2a`/`q2b` use the recorded `UNION` fallback (plan §10).

## 4. Files expected to change
Create: `api/graph/queries/q2a_untrusted_witness.cypher`, `q2b_secret_witness.cypher`, `q2c_quarantine_check.cypher` · `api/runtime/gate.py` · `tests/gate/*`.
Modify: `tests/test_invariants.py` (P2 additions), `docs/DECISIONS.md` (A-03, A-04).

## 5. Tasks
- [ ] **P2-T1 Queries verbatim** from §10 (or the P0 fallback for `q2b`), and direct query tests on hand-built graphs (built with P1 replay).
- [ ] **P2-T2 `Verdict`, `GateResult`, `decide()`** following the decision order in §11 exactly: missing payload/sink → HOLD `MISSING_PROVENANCE`; quarantined payload/ancestor → BLOCK `QUARANTINED_LINEAGE`; external + both witnesses → HOLD `TRIFECTA` (BLOCK if `policy.strict`); external + only secret witness → ALLOW `SECRET_EGRESS_WARNING`; else ALLOW `CLEAN`. Writes `Action.status` + `verdict_reason` through `q1_set_action_status`. `llm_calls` is always 0.
- [ ] **P2-T3 Fail closed on errors.** A database error or timeout inside `decide()` must raise; it must never produce ALLOW. Test that the orchestrator-facing API leaves the action un-executed.
- [ ] **P2-T4 Verdict log** `state/<ws>/verdicts.jsonl` with `action_id, verdict, reason, witnesses, latency_ms, policy_version`. Define `policy_version` = sha256 of `fixtures/policy.yaml` (A-04).
- [ ] **P2-T5 Behaviour tests** (below) on replayed graphs.
- [ ] **P2-T6 Content-agnostic proof.** (a) Property-style test with a seeded RNG: randomise **all** artifact contents → identical verdicts and witness *endpoints*. (b) Static test: no `.content` in any `q2*`–`q8*` file that exists; no LLM/provider imports in `api/runtime/gate.py`.
- [ ] **P2-T7 Hop-bound consistency** (A-03): a test asserting the literal bound in the queries equals `policy.max_lineage_hops`; decide what happens to `query_timeout_ms` (enforce only if the client documents a timeout; else mark unenforced in DECISIONS).
- [ ] **P2-T8 Sabotage check** (recorded in Evidence): remove the `sanitized` exclusion from `q2a` → the sanitized-only test must fail; remove the `approved` exclusion from `q2b` → the approved test must fail; restore both.

## 6. Tests and validation
Per §22-P2: attack lineage → HOLD/`TRIFECTA` with correct witness endpoints (last node = ground-truth untrusted source / a secret source) · no convention written → ALLOW · approved payload → ALLOW · sanitized-only path → **no** untrusted witness · quarantined ancestor → BLOCK · missing payload → HOLD `MISSING_PROVENANCE` · content-agnostic.
Also: external sink + secret only → ALLOW with `SECRET_EGRESS_WARNING` · internal sink with secret + untrusted → ALLOW `CLEAN` · `strict: true` → BLOCK · witness lists non-empty exactly when the verdict says so · `q2b` does not exclude sanitized nodes (rule 7) · re-running `decide()` on the same action is idempotent and appends a second log line.

## 7. Acceptance criteria
1. All §22-P2 behaviours pass as tests on real FalkorDB, no API key.
2. Static invariants hold: no `.content` in gate/forensic/UI queries, no LLM import in the gate.
3. Sabotage check shows the sanitize/approve tests are not vacuous.
4. `GateResult` contains witnesses and quarantined ancestors as specified in §11.

## 8. Risks and failure scenarios
- **Wrong exclusion logic** (sanitized vs approved) is the single most damaging bug: it either leaks (false ALLOW) or over-holds. Rule 7 is the spec; test both directions.
- Equal-length paths: `ORDER BY hops LIMIT 1` may return different (equally valid) witnesses between runs. Tests and metrics must compare **endpoints**, not whole paths.
- Multi-type variable-length / `none()` semantics differ from Neo4j (probe-dependent).
- A gate that "fails open" on query error → catastrophic; covered by T3.
- Hard-coding the plan's example ids instead of computing → fails on other graphs.
- Latency numbers leaking into determinism comparisons.

## 9. Definition of Done
Tasks ticked with evidence · G1, G2, G4 (P2 additions), G5, G6, G8, G10 · independent review (PROMPTS §4) done and findings resolved · A-03/A-04 Resolved · tracking updated · PR merged · tag `phase-p2-done`.

## 10. Git checkpoints
`P2: feat(queries): witness and quarantine queries` · `P2: feat(gate): decision order and verdict log` · `P2: test(gate): behaviour and content-agnostic tests` · `P2: test(gate): sabotage-check evidence` → PR → review → merge → tag.
