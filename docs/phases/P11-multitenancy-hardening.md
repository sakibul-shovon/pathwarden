# P11 — Multi-tenancy and hardening

> **Tier 3** · Branch `phase/p11-hardening` · Depends on: P3, P4, P6, P9 DONE (so every graph family is covered)
> **Read in plan.md (only these):** §17, §18 (auth + human endpoints), §11 (verdict log), §7.1 (graph names), §22-P11, §4 rules 4, 6, 8

## 1. Objective
Make workspaces real tenants and make human-only actions actually human-only: API keys scoped to one workspace, `X-PW-Human` on risk-increasing endpoints, and tests that prove isolation.

## 2. Requirements covered
F13 (one graph per workspace, keys scoped per workspace) and the security rules of §17.
**Out of scope:** real user accounts, OAuth, rate limiting, or cryptographic memory integrity (explicit non-goals).

## 3. Prerequisites
A-07 decided (which endpoints are human-only; tenant scope of remediation/eval endpoints). A-12 decided (what `fixtures/api_keys.yaml` contains).

## 4. Files expected to change
Create: `fixtures/api_keys.yaml` (demo keys only, non-provider format such as `pwdemo-key-…`) · `tests/security/*`.
Modify: `api/main.py` (auth dependency), `api/settings.py` (`PW_AUTH`), all route modules (apply the dependency), `tests/conftest.py` (client fixtures with/without keys), `tests/test_invariants.py` (every human-only route requires the header), `docs/DECISIONS.md` (A-07, A-12).

## 5. Tasks
- [x] **P11-T1 Key model:** `key → workspace` from the file; `PW_AUTH=off` keeps local mode working with no keys; `PW_AUTH=on` requires a valid key on every `/ws/{ws}/…` request and rejects a key used on another workspace (`403`, §18 error shape). Hosted keys come from the environment, never the repo (A-12).
- [x] **P11-T2 Graph-name scoping:** a request for workspace *A* can only touch `pw_A`, `pw_A__sbx`, `pw_mcp_A` (and `pw_eval_*`/`pw_cap_*` only per A-07). No endpoint accepts a raw graph name.
- [x] **P11-T3 Human endpoints:** the list from A-07 (at least action approve/reject, heal approve, quarantine release, remediation apply) requires header `X-PW-Human: true` **and**, in hosted mode, the workspace key. Missing header → rejected with a clear error, and nothing is written.
- [x] **P11-T4 Dedupe rule:** content-hash dedupe never merges artifacts with different origins — test that identical content read from two different sources produces two artifacts (or, if dedupe was never implemented, that this holds trivially).
- [x] **P11-T5 Verdict log:** a test proves `verdicts.jsonl` is written for every decision with the §11 fields.
- [x] **P11-T6 Full-suite matrix:** run the whole test suite with `PW_AUTH=off` and with `PW_AUTH=on` (test client supplies keys). No test silently assumes auth is off.
- [x] **P11-T7 Hygiene:** keys never logged; error messages do not reveal which workspaces exist; document the limitation that `X-PW-Human` is a deliberate-action guard, not authentication (it is a header any client can set), and that real approval authority in hosted mode rests on the workspace key.

## 6. Tests and validation (§22-P11)
A key for workspace *A* cannot read workspace *B* (including actions, artifacts, sinks, memory, graph-at, forensics, MCP graph) · approve / apply / heal-approve / quarantine-release without the human header are rejected and have no side effect · the verdict log is written.
Also: invalid key → 401 · key for A on a remediation/eval endpoint behaves per A-07 · a human-only route added later without the dependency fails the invariant test.

## 7. Acceptance criteria
1. All §22-P11 tests pass in both auth modes.
2. The invariant test lists every mutating route and shows which require the header.
3. The threat-model notes (non-goals) are recorded for the README.

## 8. Risks and failure scenarios
- Regressions across every endpoint (auth is cross-cutting) → run the full suite in both modes, per route group.
- Missing a route in the dependency; the invariant test (T-list) is the guard.
- Treating the header as authentication; keep the honesty note.
- Demo keys committed accidentally for hosted use (A-12).
- Cross-tenant leakage via sandbox/MCP/eval graphs and via error details.

## 9. Definition of Done
Tasks ticked with evidence · G1 in both auth modes, G2, G4, G5, G6, G8, G10 · A-07/A-12 Resolved · "unauthenticated approve" removed from Known gaps · tracking updated · PR merged · tag `phase-p11-done`.

## 10. Git checkpoints
`P11: feat(api): workspace-scoped api keys` · `P11: feat(api): human-only endpoint guard` · `P11: test(security): isolation and header tests` · `P11: test(api): full suite under both auth modes` → PR → merge → tag.

## 11. Outcome (2026-10-16)
All seven tasks done; evidence in `docs/PROGRESS.md` (P11 rows), decisions A-07/A-12 and D-028 to D-030 in `docs/DECISIONS.md` Part B13, the model in `docs/SECURITY.md`. Tests: `tests/test_security.py` (hosted-mode and human-header tests) and the route classification in `tests/test_invariants.py` (flat layout instead of `tests/security/*`).
