# Phase index

Phases keep the ids from `plan.md` §22 (commits and tags use them). Two refinements, both dependency-driven (D-009): P10 is split into **P10a/b/c** so a usable UI exists right after P4, and a few shared queries move earlier (`q2d` → P1, `q3`/`q6`/`q6b` → P3).
Each phase file lists **only the plan sections to read**. Do not load the whole plan (~94 KB).

## Dependencies and recommended order

| Phase | Name | Tier | Depends on | Parallel-safe? |
|---|---|---|---|---|
| P0 | Probe and skeleton | 1 | human environment actions | — |
| P1 | Graph layer, runtime, replay | 1 | P0 | no |
| P2 | Gate | 1 | P1 | no |
| P3 | Scripted agents, demo scenarios, core API | 1 | P2 | no |
| P4 | Forensic Agent, quarantine, healing, memory API | 1 | P3 | no |
| P10a | UI: scaffold, Run, Investigate | 1 | P3, P4 | no |
| P5 | Evaluation (non-LLM defenses) | 2 | P2, P3 | beside P6 |
| P6 | Remediation (max-flow) | 2 | P0 (+ router mount in `api/main.py`) | **yes**, in a worktree, from right after P0 |
| P7 | Time travel | 2 | P1, P3 | beside P5/P6 |
| P10b | UI: Memory, Time travel | 2 | P4, P7, P10a | no |
| P10c | UI: Remediate, Evaluation, full demo | 2 | P5, P6, P10a | no |
| P8 | Live LLM mode | 3 | P3, P4, P5; LLM key (A-14) | no |
| P9 | MCP tool server and gateway | 3 | P3, P4 (P8 for the live-agent demo shot) | no |
| P11 | Multi-tenancy and hardening | 3 | P3, P4, P6, P9 | no |
| P12 | Ship | 1 | every phase that will ship | no |

**Recommended order:** P0 → P1 → P2 → P3 → P4 → **P10a** → P5 → P6 → P7 → **P10b → P10c** → P8 → P9 → P11 → P12.
After P10a the core story (leak → hold → forensics → heal) is demoable in the browser; every later phase adds depth and the project is always in a presentable state.

```
P0 ─ P1 ─ P2 ─ P3 ─ P4 ─ P10a ─┬─ P10b (needs P7)
 │                  │          └─ P10c (needs P5, P6)
 │                  ├─ P5 ──────────────┐
 │                  ├─ P7               ├─ P8 ─ P9 ─ P11 ─ P12
 └─ P6 (independent, worktree) ─────────┘
```

**Tiers (D-010):** 1 = submission-critical (P0–P4, P10a, P12) · 2 = differentiators shown in the video (P5, P6, P7, P10b, P10c) · 3 = depth (P8, P9, P11). Nothing is removed from scope; if time forces a cut the human decides, Tier 3 first, and records it in `DECISIONS.md` and the README limitations.

## Requirement coverage

### Features (plan §3) → phases

| Feature | Built in | Verified by |
|---|---|---|
| F1 Lineage runtime | P1, driven end-to-end in P3 | P1 runtime tests, P3 scenarios |
| F2 Deterministic gate | P2 | P2 gate tests, P5 evaluation |
| F3 Per-key secrets, schema sanitizer | P1 (registry, `sanitize`), P3 (TaskSchema) | P1/P3 tests, `benign_port_only_42` |
| F4 Human approval (declassification) | P1 (`approve`), P3 (API), P10a (UI), P11 (auth) | P2 approved→ALLOW, P11 header test |
| F5 Cross-session laundering | P3 (`q3`, sleeper), P4 | `attack_sleeper_44`, P4 sleeper report |
| F6 Forensic Agent | P4 (scripted), P8 (LLM mode) | P4 report tests, P8 fallback tests |
| F7 Retroactive quarantine | P4 (+ P10b UI) | P4 q4*/q4d tests |
| F8 Time-travel view | P7 (+ P10b UI) | P7 acceptance |
| F9 Max-flow remediation | P6 (+ P10c UI) | P6 tests |
| F10 Rule-of-Two badges | P3 (`q5`, API), P10a (UI) | green badges on `attack_pipeline_42` |
| F11 Scripted + live agents | P3 (scripted), P8 (live) | P3 scenarios, P8 live run |
| F12 MCP Gateway + tool server | P9 | P9 acceptance |
| F13 Multi-tenancy | P1 (workspace graphs), P11 | P11 isolation tests |
| F14 Evaluation harness | P5 (non-LLM), P8 (B1/B3, live study) | `make eval` ×2 identical |
| F15 Web UI, six tabs | P10a, P10b, P10c | per-phase manual checklists + `npm run build` |

### Plan sections → phases (nothing orphaned)

| Plan section | Where it is implemented or used |
|---|---|
| §1–§3, §25–§26 | context; §25–§26 feed README (P12) |
| §4 Rules | `AGENTS.md` §2 (setup); enforced via G4 tests from P0 |
| §5 Architecture | all phases; diagram in README (P12) |
| §6 Stack, verified APIs, ⚠️ PROBE | P0 |
| §7 Data model (7.1–7.5) | P1 · §7.6 capability graph: P6 |
| §8 Fixtures: 8.1–8.5, 8.9 | P1 · 8.6–8.7: P6 · 8.8: P9 · `api_keys.yaml`: P11 |
| §9 Runtime | P1 (+ orchestrator in P3, sandbox use in P4) |
| §10 Queries: q0, q1, q2d | P1 · q2a–q2c: P2 · q3, q5, q6, q6b: P3 · q4*, q8: P4 · q7*: P7 · r1–r7: P6 |
| §11 Gate | P2 |
| §12 Agents: 12.1, 12.2, 12.4 | P3 · 12.3 live: P8 |
| §13 Forensics: 13.1, 13.2, 13.4, 13.5 | P4 · 13.3 LLM plan: P8 |
| §14 Time travel | P7 (+ UI P10b) |
| §15 Remediation | P6 (+ UI P10c) |
| §16 MCP | P9 |
| §17 Multi-tenancy and security | P11 (threat model text: P12) |
| §18 API | P3 core, P4 forensics/heal/memory/artifacts, P5 eval, P6 remediation, P7 timeline, P11 auth |
| §19 Frontend | P10a tabs 1–2, P10b tabs 3–4, P10c tabs 5–6 |
| §20 Evaluation | 20.1 replay: P1 · 20.2–20.5, 20.7: P5 · B1/B3, 20.6: P8 |
| §21 Layout | P0 creates the skeleton; each phase fills its part |
| §22 Phases | this directory |
| §23 Deployment | local: P0/P3; hosted: P12 |
| §24 README, video, blog, submission | P12 |
| §27 Changelog | context only |

## Phase file anatomy (all follow it)

Header (tier, branch, prerequisites, **plan sections to read**) · 1 Objective · 2 Requirements covered (and what is *out of scope*) · 3 Prerequisites · 4 Files expected to change · 5 Tasks (`P<n>-T<k>` checkboxes — tick only with evidence) · 6 Tests and validation · 7 Acceptance criteria · 8 Risks and failure scenarios · 9 Definition of Done · 10 Git checkpoints.

Universal DoD on top of each phase's own: gates G1–G10 (`docs/WORKFLOW.md` §7), PR merged with a merge commit, `phase-p<n>-done` tag, PROGRESS/HANDOFF/DECISIONS updated.
