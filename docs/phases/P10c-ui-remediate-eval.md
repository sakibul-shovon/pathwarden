# P10c — UI: Remediate, Evaluation, full demo

> **Tier 2** · Branch `phase/p10c-ui-remediate-eval` · Depends on: P5, P6, P10a DONE (P10b recommended first)
> **Read in plan.md (only these):** §19 (tabs 5–6), §15 (15.2 for labels), §18 (remediation, `eval/summary`), §20.4–§20.7 (what to display), §22-P10

## 1. Objective
The **Remediate** and **Evaluation** tabs, plus the end-to-end click-through of the whole demo (plan §22-P10 acceptance).

## 2. Requirements covered
F9 and F14 in the browser (tabs 5 and 6 of F15) and the complete F15 acceptance.
**Out of scope:** live-mode behaviour (P8) — the toggle stays disabled with a reason until P8.

## 3. Prerequisites
P5 (`/eval/summary`, generated results), P6 (remediation endpoints), P10a (shell). Remove every "arrives in P10b/c" placeholder tab.

## 4. Files expected to change
Create: `web/src/tabs/{Remediate.tsx,Evaluation.tsx}` · `web/src/components/CapabilityGraph.tsx`. Modify: `web/src/api/{client.ts,types.ts}`, `web/src/App.tsx`, `docs/PROGRESS.md`.

## 5. Tasks
- [x] **P10c-T1 Types and client** for the remediation and eval endpoints.
- [x] **P10c-T2 Remediate tab:** topology selector (`enterprise12`, `tinyqueue3`); capability graph with toxic agents highlighted (Cytoscape, built-in layout); per-agent witness (`r7`) on click; candidate table C1–C4 (cost, cap ids, verified); **Apply** with confirmation (human action) → before/after toxic agents; **Reset**.
- [x] **P10c-T3 Evaluation tab:** results table, Wilson intervals, falsification criteria, link to `eval/results/` — all from `GET /api/eval/summary`; **nothing typed by hand** (rule 11). Show `not_run` for B1/B3 until P8 fills them.
- [x] **P10c-T4 Full-demo walkthrough** (below), recorded as Evidence; fix blocking defects found (log non-blocking ones in Known issues).
- [x] **P10c-T5 Production build** check: `npm run build`, serve the build and repeat the first three walkthrough steps.

## 6. Tests and validation
`npm run build` exit 0 · CI `web` green · manual **full-demo checklist** (plan §22-P10):
1. Guard **off** → leak visible on the public release page. 2. Guard **on** → HOLD with both witnesses. 3. Investigate → forensics report. 4. Heal → approve healed release → clean release. 5. Time travel: sleeper replay. 6. Memory: quarantined entry, release it. 7. Remediate: pick `enterprise12`, view candidates, apply the cheapest verified one → toxic agents → zero; reset. 8. Evaluation: table and criteria render from the API.

## 7. Acceptance criteria
1. The full-demo checklist passes end-to-end with recorded evidence.
2. Every number shown in the Evaluation tab comes from the API response (verified by changing the generated file and seeing the UI change, or by inspection of the code).
3. Build and CI green.

## 8. Risks and failure scenarios
- The 30-edge `enterprise12` graph is unreadable with default layout → legend, highlighting, optional filtering.
- Apply mutates the demo topology; always offer Reset and document it.
- Evaluation tab drifting from the generated results (stale or hard-coded numbers).
- Wide tables on narrow screens.

## 9. Definition of Done
Tasks ticked with evidence · G1, G3, G5, G6, G8, G10 · placeholder tabs gone · tracking updated · PR merged · tag `phase-p10c-done`.

## 10. Git checkpoints
`P10c: feat(web): remediate tab` · `P10c: feat(web): evaluation tab` · `P10c: docs: full-demo walkthrough evidence` → PR → merge → tag.

## 11. Outcome (2026-10-16)
All five tasks done; evidence in `docs/PROGRESS.md` (P10c rows), decisions D-020 and D-021 in `docs/DECISIONS.md` Part B11. The full-demo checklist (8 steps) was driven in the real UI through headless Edge (DevTools protocol), on the dev server and again on the production build for steps 1-4; there was no human click-through.
