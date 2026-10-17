# Traceability: feature to evidence (P12-T7)

Plan §3 features F1-F15, where they are implemented, which tests pin them and where the recorded evidence is (`PROGRESS.md` = the evidence log; "UI check" = driven in the real UI in headless Edge, no human click-through). Status words are honest: **Done**, **Partial** (what is missing is stated) or **Not done**.

| # | Feature | Status | Code | Tests (names are in the files) | Evidence |
|---|---|---|---|---|---|
| F1 | Lineage runtime: every read, write and action as nodes and edges | Done | `api/runtime/runtime.py`, `api/graph/` | `tests/test_runtime_lineage.py`, `tests/test_replay.py`, `tests/test_registry_and_schema.py` | PROGRESS P1; `make probe` 36/36 |
| F2 | Deterministic gate with witness paths | Done | `api/runtime/gate.py`, queries `q2a`-`q2d` | `tests/test_gate.py` (attack held with both witnesses; verdicts independent of content; DB error never yields ALLOW) | PROGRESS P2; `make demo` 6/6; UI check P10a |
| F3 | Per-key secrets and a schema sanitizer against taint explosion | Done | `api/agents/`, `q1_sanitize`, `q2a`/`q2b` | `tests/test_gate.py` (a sanitized-only path gives no untrusted witness; sanitizing a secret does not declassify it), `tests/test_eval.py` (PW-coarse ablation) | PROGRESS P2, P5: PW-coarse FHR 73.3% vs PW 0.0% |
| F4 | Human approval recorded in the graph | Done | `Runtime.approve`, `Orchestrator.approve`, `q1_approve_artifact` | `tests/test_gate.py::test_human_approval_cuts_both_witnesses`, `tests/test_api.py`, `tests/test_security.py` (human header) | PROGRESS P3, P11 |
| F5 | Cross-session memory laundering (sleeper) | Done | scenario `attack_sleeper_44`, `q3` | `tests/test_scripted_agents.py`, `tests/test_forensics.py`, `tests/test_timetravel.py` | PROGRESS P3, P4, P7; UI check P10b |
| F6 | Forensic Agent: investigate, quarantine, sandbox replay, re-gate, diff, human approve | Done in scripted and LLM mode (LLM mode: hints, scripted fallback; verified once with a real model); the LLM mode answers `501` without a model | `api/forensics/`, `Workspace.heal_approve` | `tests/test_forensics.py` | PROGRESS P4; UI check P10a/P10c step 3-4 |
| F7 | Retroactive memory quarantine | Done | `q4*`, `Runtime.apply_quarantine` | `tests/test_forensics.py` (release restores memory), `tests/test_gate.py` | PROGRESS P4, P10b |
| F8 | Time-travel view | Done | `api/runtime/timetravel.py`, `q7`/`q7b` | `tests/test_timetravel.py` (13 tests, 4 sabotage checks) | PROGRESS P7, P10b |
| F9 | Capability-graph remediation, four provable cuts, brute-force optimum | Done | `api/remediation/`, `eval/remediation_optimum.py` | `tests/test_remediation.py` (200 random graphs against an independent max-flow) | PROGRESS P6; `eval/results/summary.md`: enterprise12 best 16 vs optimum 14 (gap 2) |
| F10 | Rule-of-Two badges per agent session | Done | `q5`, `api/runtime/explain.py` | `tests/test_api.py::test_every_session_of_the_attack_has_a_green_rule_of_two_badge` | UI check P10a |
| F11 | Scripted agents (offline, deterministic) and live LLM agents | **Partial.** Live agents and the visitor's own issue are done (fake-model tests; one real-model run each, not the study); LLM judges (B1/B3) and the live study are **not implemented** (P8-T8, T9) | `api/agents/scripted.py` | `tests/test_scripted_agents.py` | PROGRESS P3; the README and every result say "scripted" |
| F12 | MCP gateway and MCP tool server | Done with scripted MCP clients (real LLM agents through the gateway need P8) | `api/mcp/`, `mock_upstreams/` | `tests/test_mcp_gateway.py` (36 tests incl. the real process over stdio), `tests/test_mcp_tool_server.py` | PROGRESS P9: `make probe-mcp` 7/7, `make demo-mcp` holds the attack, UI check of `?ws=tinyqueue-mcp` |
| F13 | Multi-tenant: one graph per workspace, API keys scoped per workspace | Done (hosted mode, demo keys committed on purpose) | `api/auth.py`, `api/workspace.py` | `tests/test_security.py`, route classification in `tests/test_invariants.py`; suite green in both modes | PROGRESS P11 |
| F14 | Evaluation harness: 120 scenarios, 7 defenses, reproducible | Done except B1/B3 (`not_run`: the judges are not implemented, P8-T8) | `eval/` | `tests/test_eval.py` | PROGRESS P5/P6/P10c: `make eval` twice byte-identical; `eval/results/` |
| F15 | Web UI: six tabs | Done | `web/` | `npm run build` (tsc strict); no unit tests for the UI | PROGRESS P10a-c: full-demo checklist 8/8 in headless Edge, dev server and production build; **no human click-through** |

## Gaps stated (they also appear in the README)

- B1/B3 LLM judges and the live study (F11, part of F14): not implemented (P8-T8, T9; the study spends tokens, so the owner is asked first). Real LLM agents through the MCP gateway (F12): not tried.
- No independent review of the code (G-001); CI never observed on GitHub (private repository, no `gh`).
- Two deviations from plan §10 await the owner's review: D-017 (`q2c`), D-018 (capability-graph seed queries); further additive decisions D-019 and D-023.
- Not deployed (P12-T4), no video (P12-T5), no license (P12-T6): human tasks.
