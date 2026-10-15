# P7 — Time travel

> **Tier 2** · Branch `phase/p7-timetravel` · Depends on: P1, P3 DONE (the sleeper scenario exists)
> **Read in plan.md (only these):** §14, §10 (`q6b`, `q7`, `q7b`, `q8`), §12.4 (`attack_sleeper_44`), §18 (`timeline/max`, `graph-at`), §22-P7, §4 rule 1

## 1. Objective
Let a viewer replay the lineage graph at any logical time `t`, with markers for "poisoned memory written" and "draft becomes doubly tainted".

## 2. Requirements covered
F8 (time-travel view backend). **Out of scope:** the slider UI (P10b).

## 3. Prerequisites
P1 (logical clock on every node), P3 (`attack_sleeper_44` runnable). **A-09 must be approved by the human before T3:** rule 1 forbids writing Cypher that is not in §10, and §10 has no artifact-level taint query. Proposal: compute the markers in Python from existing results (`q7` edges + `q6b` node details), no new Cypher.

## 4. Files expected to change
Create: `api/graph/queries/q7_graph_at_time.cypher`, `q7b_actions_at_time.cypher` · `api/routes/timetravel.py` · `tests/timetravel/*`.
Modify: `tests/test_invariants.py` (no `.content` in q7/q7b), `docs/DECISIONS.md` (A-09).

## 5. Tasks
- [ ] **P7-T1 Queries** `q7`, `q7b` verbatim; `q6b` for node metadata (already from P3).
- [ ] **P7-T2 Endpoints:** `GET /ws/{ws}/timeline/max` → `{"t": int}` (current logical clock) and `GET /ws/{ws}/graph-at?t=` returning nodes (with metadata), edges and actions at time `t` (q7 + q7b + q6b). Reject non-integer / negative `t` with the §18 error shape.
- [ ] **P7-T3 Markers (after A-09):** "poisoned memory written" = earliest `created_at` of a `team_memory` artifact with an unsanitized untrusted origin (from `q8` + `q6b`); "draft doubly tainted" = earliest `t` at which some draft's lineage within the returned edges reaches both an untrusted and a secret source (BFS in Python over `q7` edges, trust from `q6b`). Document that `quarantined` reflects **current** state, not history.
- [ ] **P7-T4 Tests** (below).

## 6. Tests and validation
Using `attack_sleeper_44`: at the logical time of Monday's `team_convention:42` write, the graph shows the convention but **no** draft; at the final time it shows the doubly tainted draft and both markers; `edges(t1) ⊆ edges(t2)` for `t1 < t2` · `t = 0` is empty · `t` beyond max equals max · actions at `t` only include actions created `<= t` · invalid `t` → error JSON · no `content` in any response.

## 7. Acceptance criteria (§22-P7)
1. For `attack_sleeper_44`, the graph at the time of the Monday memory write shows the convention but no draft.
2. At the final time it shows the doubly tainted draft.
3. Marker times are derived, not hard-coded, and match the data.

## 8. Risks and failure scenarios
- Marker definitions are not in the plan (A-09): getting the human's OK first avoids rework.
- `q7` returns edges by the *source artifact's* `created_at`; endpoint nodes (Sources) need metadata from `q6b`.
- Mutable flags (`quarantined`, `approved`) are current-state; showing them in the past is misleading unless labelled.
- Off-by-one on `<=` and on clock start (1 for an empty graph).
- Large graphs → slow responses; return only ids + metadata.

## 9. Definition of Done
Tasks ticked with evidence · G1, G2, G4, G5, G6, G8, G10 · A-09 Resolved · tracking updated · PR merged · tag `phase-p7-done`.

## 10. Git checkpoints
`P7: feat(queries): graph and actions at time` · `P7: feat(api): timeline and graph-at endpoints` · `P7: feat(api): taint and memory markers` · `P7: test(timetravel): sleeper replay` → PR → merge → tag.
