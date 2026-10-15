# P10a — UI: scaffold, Run, Investigate

> **Tier 1** · Branch `phase/p10a-ui-run-investigate` · Depends on: P3, P4 DONE
> **Read in plan.md (only these):** §19 (intro + tabs 1–2), §18 (types: `RunResult`, GateResult, ForensicReport), §12.4, §13.4, §23 (web), §22-P10, §4 rule 8

## 1. Objective
A usable browser UI for the core story: run a scenario with the guard on/off, see the three Rule-of-Two badges stay green while the system leaks, then investigate the held action, run forensics and approve the healed release.

## 2. Requirements covered
F15 (tabs **Run** and **Investigate**), F10 (badges), F4/F6 in the browser.
**Out of scope:** Time-travel, Memory (P10b), Remediate, Evaluation (P10c), live-mode behaviour (P8 — the toggle exists but is disabled with a reason).

## 3. Prerequisites
P3 and P4 DONE: the API endpoints listed in §18 for scenarios, actions, explain, forensics, heal and artifacts are working. A decision on UI tooling (A-16): no new test dependencies without approval.

## 4. Files expected to change
Create: `web/{package.json,package-lock.json,tsconfig.json,vite.config.ts,index.html}` · `web/src/{main.tsx,App.tsx,styles.css}` · `web/src/api/{client.ts,types.ts}` · `web/src/tabs/{Run.tsx,Investigate.tsx}` · `web/src/components/LineageGraph.tsx`.
Modify: `Makefile` (`web`), `.github/workflows/ci.yml` (enable the `web` job, then add `web` to required checks), `api/main.py` (CORS for the Vite dev origin — record the decision), `docs/DECISIONS.md` (A-16), `docs/PROGRESS.md` (manual UI checklist evidence).

## 5. Tasks
- [x] **P10a-T1 Scaffold** Vite + React 18 + TypeScript (`strict: true`) + `cytoscape` (built-in `breadthfirst` layout only). Dependencies are the standard template plus cytoscape and its types — anything else needs approval. `VITE_API_BASE`. Enable the CI `web` job (`npm ci`, `npm run build` where `build` includes `tsc`).
- [x] **P10a-T2 Typed API client** mirroring §18 (no `any`), the `{"error","detail"}` error shape, and a small polling hook (polling only — no websockets).
- [x] **P10a-T3 Tab shell** with the six tab labels; tabs not built yet are visibly disabled with "arrives in P10b/P10c" (no fake content).
- [x] **P10a-T4 Run tab:** scenario dropdown, guard toggle, mode toggle (live disabled until P8), Run; three agent cards with A/B/C letters and the Rule-of-Two badge from `/sessions/{id}/rule-of-two`; timeline from `RunResult`; "Public release page" panel from `/sinks/{id}` showing what was posted.
- [x] **P10a-T5 Investigate tab:** action list; verdict card (verdict, reason, latency, **LLM calls 0**); Cytoscape lineage graph from `explain` (untrusted witness and secret witness in different colours *and* line styles, sanitized nodes dashed, quarantined greyed, sources as diamonds); read-only `q2a`/`q2b` query text; "Run forensics" (scripted); report view; side-by-side payload diff via `artifacts/{id}?graph=main|sandbox`; "Approve healed release".
- [x] **P10a-T6 Styling:** plain CSS, light/dark via `prefers-color-scheme`; information never conveyed by colour alone.
- [x] **P10a-T7 Manual acceptance run** per the checklist below, results recorded as Evidence (what you clicked, what you saw).

## 6. Tests and validation
`npm run build` (strict TypeScript) exit 0 · CI `web` job green · manual checklist (A-16 — there is no UI test tooling in the plan's stack; adding Vitest/Playwright needs human approval).

Manual checklist (run from a clean `make up`, `make api`, `make web`):
1. Run `benign_43` guard on → posted, three green badges.
2. Run `attack_pipeline_42` **guard off** → the fake secret appears on the release panel; badges are green.
3. Reset, run it **guard on** → action HELD, reason TRIFECTA, both witness paths highlighted, q2a/q2b text visible, 0 LLM calls.
4. Run forensics → report names `team_convention:42`; sandbox verdict ALLOW.
5. Diff shows the secret on the left and a clean draft on the right; "Approve healed release" → the sink gets the clean release; old action shows `superseded`.
6. Toggle dark mode; resize to a narrow window; no horizontal scroll, text readable.

## 7. Acceptance criteria
1. The six-step checklist passes with recorded evidence.
2. `npm run build` exit 0 and CI `web` green.
3. No `any` for API data; types match the real responses (spot-checked against live responses).

## 8. Risks and failure scenarios
- Type drift between `types.ts` and the API → silent UI breakage; check against real responses.
- Cytoscape graphs unreadable at depth; keep `breadthfirst` and use legend + highlighting.
- CORS between Vite (5173) and API (8000) blocks every call → T-config early.
- Rendering artifact `content` (contains fake secrets) — fine for the demo, but never render real env values.
- Scope creep (component libraries, state managers) → forbidden by rule 12.
- UI hides a failure (e.g. swallows an API error) and looks "working".

## 9. Definition of Done
Tasks ticked with evidence · G1, G3, G5, G6, G8, G10 · A-16 settled · tracking updated · PR merged · tag `phase-p10a-done`.

## 10. Git checkpoints
`P10a: chore(web): vite react ts scaffold and ci job` · `P10a: feat(web): typed api client` · `P10a: feat(web): run tab` · `P10a: feat(web): investigate tab and lineage graph` · `P10a: docs: ui acceptance evidence` → PR → merge → tag.
