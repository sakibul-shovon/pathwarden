# P6 — Remediation (max-flow)

> **Tier 2** · Branch `phase/p6-remediation` · Depends on: P0 only (needs FalkorDB and the `api/main.py` skeleton to mount a router) · **Parallel-safe:** may run in a separate worktree beside P1–P5 · **Different-agent review recommended**
> **Read in plan.md (only these):** §7.6, §8.6, §8.7, §10 (`r1`–`r7`), §15, §18 (remediation endpoints), §22-P6, §4 rules 1, 11

## 1. Objective
Build the capability graph for a topology, find toxic agents, compute four provably-complete minimum cuts with `algo.maxFlow`, verify them, apply one on human request, and compare the best candidate with a brute-force optimum.

## 2. Requirements covered
F9 (four max-flow cuts, verification, apply, witness, optimum gap). Both topologies: `enterprise12` and `tinyqueue3`.
**Out of scope:** the Remediate tab (P10c), evaluation-table integration beyond writing the optimum report (P5/P10c).

## 3. Prerequisites
P0 DONE, including the probe results for `algo.maxFlow` edge-property projection, multi-type paths, `copy`, and delete.

## 4. Files expected to change
Create: `fixtures/topologies/{enterprise12,tinyqueue3}.yaml` (verbatim §8.6/§8.7) · `api/remediation/{capability_graph.py,mincut.py}` · queries `r1_all_edges`, `r2_maxflow`, `r3_apply_revocation`, `r4_toxic_agents`, `r5_reachable_agents`, `r6_agents_reaching_external`, `r7_toxic_witness` · `api/routes/remediation.py` · `eval/remediation_optimum.py` · `tests/remediation/*`.
Modify: `api/main.py` (one line mounting the router — keep the diff tiny to avoid merge conflicts when run in parallel).

## 5. Tasks
- [x] **P6-T1 Fixtures and loader:** load a topology into `pw_cap_<topology>` as `CapNode`s (kind, trust, external) and `CAN_FLOW` edges with `cap_id = "<src>-><dst>"`, `cost`, `description`; validate (cost 1–10, endpoints exist). `reset` reloads from YAML.
- [x] **P6-T2 Toxicity** (`r4`) and per-agent witness (`r7`); `r5`/`r6` for the T_S / T_U sets.
- [x] **P6-T3 Candidate definitions C1–C4** (U→K, S→K, U→T_S, S→T_U) per §15.2; sets computed from `r5`/`r6` in Python; empty target sets yield "no cut needed" rather than an error.
- [x] **P6-T4 Cut extraction** (`mincut.py`) per §15.3: `r1` edges, `r2` flows by `cap_id` (0 if absent), residual BFS from all sources (forward if `flow < cost`, backward if `flow > 0`), cut = edges from visited to unvisited, **assert `sum(cost) == maxFlow`** else mark the candidate invalid and log.
- [x] **P6-T5 `suggest`:** for each candidate `copy` the graph to a temp graph, apply with `r3`, require `r4` empty, delete the temp graph (also on failure); return candidates sorted by cost with `cap_ids`, `total_cost`, `verified`, descriptions.
- [x] **P6-T6 `apply`** (human) via `r3` on the real graph, return toxic agents before/after; `reset`; endpoints per §18.
- [x] **P6-T7 Brute-force optimum** (`eval/remediation_optimum.py`): plain Python, edge subsets of size 1..6 cheapest-first, toxicity by BFS on an in-memory edge list; report `optimum_cost`, `best_candidate_cost`, `gap`. Not used by the product. Measure runtime on `enterprise12` (30 edges).
- [x] **P6-T8 Tests** (below) and a sabotage check (corrupt the residual-BFS direction → `sum(cost)==maxFlow` or `verified` test must fail).

## 6. Tests and validation (§22-P6)
Every candidate satisfies `sum(cost) == maxFlow` · every candidate verified (`r4` empty after apply on a temp copy) · apply on the real graph empties `r4` · the optimum script reports a gap · both topologies load.
Also: `REVOKED_FLOW` edges are ignored by every `CAN_FLOW` query · temp graphs never leak · results are never hard-coded (rule 11): tests assert **properties** (verified, cost equality, `best_candidate_cost >= optimum_cost`), not specific numbers · toxic-agent list on each topology is derived, then checked against an independent Python BFS.

## 7. Acceptance criteria
1. All §22-P6 tests pass on real FalkorDB, no API key.
2. For both topologies `suggest` returns four candidates, each `verified: true` or an explicit invalid reason with a log line.
3. `eval/remediation_optimum.py` completes in acceptable time and reports `gap >= 0`.
4. Applying the cheapest verified candidate leaves zero toxic agents; `reset` restores the original.

## 8. Risks and failure scenarios
- `algo.maxFlow` edge-property projection may not work as in `r2` → the plan's fallback (project endpoint names, map to `cap_id` in Python).
- Multi-source/multi-target flow semantics and "only positive-flow edges are returned": treat missing as 0.
- C3/C4 correctness depends on correct T_S/T_U; an independent BFS test is mandatory.
- Brute force over C(30,≤6) subsets × BFS may be slow in Python; time it, prune by cost bound.
- `r7` chained `WITH … ORDER BY … LIMIT` semantics differ per engine (probe).
- Mutating the live capability graph and forgetting to reset breaks later demos.
- Parallel work: merge conflicts in `api/main.py` and `pyproject.toml`; keep those diffs minimal.

## 9. Definition of Done
Tasks ticked with evidence · G1, G2, G4, G5, G6, G7 (deterministic outputs), G8, G10 · independent review done · tracking updated · PR merged · tag `phase-p6-done`.

## 10. Git checkpoints
`P6: feat(remediation): topology fixtures and loader` · `P6: feat(remediation): toxicity and witness queries` · `P6: feat(remediation): maxflow cuts and verification` · `P6: feat(api): remediation endpoints` · `P6: feat(eval): brute-force optimum` · `P6: test(remediation): properties and sabotage evidence` → PR → review → merge → tag.
