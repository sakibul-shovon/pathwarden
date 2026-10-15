# P10b — UI: Memory and Time travel

> **Tier 2** · Branch `phase/p10b-ui-memory-time` · Depends on: P4, P7, P10a DONE
> **Read in plan.md (only these):** §19 (tabs 3–4), §14, §18 (`memory`, `timeline/max`, `graph-at`, `quarantine/{qid}/release`), §22-P10

## 1. Objective
The **Time travel** tab (a slider that replays the attack step by step) and the **Memory** tab (memory hygiene: who wrote what, from which untrusted origin, quarantine state, release).

## 2. Requirements covered
F8 and F7 in the browser (tabs 3 and 4 of F15). **Out of scope:** Remediate and Evaluation tabs (P10c).

## 3. Prerequisites
P4 (memory inventory, quarantine release), P7 (timeline + graph-at + markers), P10a (shell, client, `LineageGraph`).

## 4. Files expected to change
Create: `web/src/tabs/{TimeTravel.tsx,Memory.tsx}`. Modify: `web/src/api/{client.ts,types.ts}`, `web/src/App.tsx` (enable the two tabs), `web/src/components/LineageGraph.tsx` (accept time-travel styling), `docs/PROGRESS.md`.

## 5. Tasks
- [ ] **P10b-T1 Types and client** for `timeline/max`, `graph-at`, `memory`, `quarantine release`.
- [ ] **P10b-T2 Time-travel tab:** slider over `0…max`; fetch `graph-at?t=` (debounced); render with `LineageGraph`; highlight the two markers (poisoned memory written; draft doubly tainted); show the clock value and the event at that time; label that quarantine flags are current-state.
- [ ] **P10b-T3 Memory tab:** table from `GET /memory` — entry (id, key, kind), writer, day, untrusted origins, quarantine state; "Release quarantine" button with confirmation (human action) → refresh the table.
- [ ] **P10b-T4 Manual acceptance** per checklist; record Evidence.

## 6. Tests and validation
`npm run build` exit 0 · CI `web` green · manual checklist: (1) run `attack_sleeper_44` guard on; (2) Time travel: slide to the Monday memory write → convention visible, no draft; slide to the end → doubly tainted draft with both markers; (3) Memory: `team_convention:42` listed with origin `src:issue:42`; (4) run forensics (Investigate tab) → Memory tab shows it quarantined; (5) release quarantine → state flips back.

## 7. Acceptance criteria
1. The checklist passes with recorded evidence.
2. The slider never shows data from a different time than requested (spot check three points against the API).
3. No `any` for API data; build and CI green.

## 8. Risks and failure scenarios
- Slider spamming the API → debounce and cancel stale requests.
- A marker shown by the UI that disagrees with the API data → UI must render API-provided markers, not compute its own.
- Release-quarantine button is destructive to demo state → confirm dialog, and mention in the manual checklist.
- Graph layout jumps between times → keep node positions stable where possible.

## 9. Definition of Done
Tasks ticked with evidence · G1, G3, G5, G6, G8, G10 · tracking updated · PR merged · tag `phase-p10b-done`.

## 10. Git checkpoints
`P10b: feat(web): time-travel tab` · `P10b: feat(web): memory tab` · `P10b: docs: ui acceptance evidence` → PR → merge → tag.
