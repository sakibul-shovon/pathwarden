# P13–P15 — UI redesign (twelve sub-phases)

> **Source of truth for this work: [`ui-redesign.md`](../../ui-redesign.md)** (research, specification, acceptance criteria). This file only slices it into pushable phases and records evidence. `plan.md` is not edited; the deviations from plan §19 are decision D-033.
> **Base:** each sub-phase branches from the previous one (the chain starts on `phase/p8-live-llm`, because `main` does not contain the live-mode UI yet, D-034). No merge to `main`, no tag: the owner merges (P8 first, then this chain in order).
> **Backend:** untouched. No Cypher, endpoint, schema or fixture changes. `make test` and `make test-auth` must stay green.

## Phase map

| Phase | Branch | Contents | Spec sections |
|---|---|---|---|
| P13a | `phase/p13a-redesign-baseline` | Baseline, decisions, hook widened to P19, plan committed | §20 R0, §21.1, §23.4 |
| P13b | `phase/p13b-design-foundation` | Tokens, self-hosted fonts, base CSS, icons, primitives, Vitest | §16, §17.3, §19.5 |
| P13c | `phase/p13c-app-shell-entry` | `/` + `/app/` entries, legacy redirect, URL state, rail shell, unreachable state, typed errors | §10, §13.1, §13.2, §19.2–19.3 |
| P13d | `phase/p13d-access-onboarding` | Connect state, key stripping, sign out, story-guide model | §12 |
| P14a | `phase/p14a-run-view` | Run view | §13.4, §14.3–14.4 |
| P14b | `phase/p14b-case-file` | Investigate: queue, case file, witness paths, forensics, diff, decision dialog | §13.5, §13.11, §14.5–14.7 |
| P14c | `phase/p14c-graph-presentation` | Lanes layout, graph table, drawer, trace, dim-unrelated | §15, §13.10 |
| P14d | `phase/p14d-memory-time-remediate-eval` | Memory, Time travel, Remediate, Evaluation | §13.6–13.9 |
| P15a | `phase/p15a-landing` | Public landing page | §11 |
| P15b | `phase/p15b-motion` | Motion catalogue | §17 |
| P15c | `phase/p15c-responsive-a11y` | Responsive and accessibility hardening | §18, §21.6–21.7 |
| P15d | `phase/p15d-regression-docs` | Full regression, regenerated screenshots, docs | §21.2, §21.12, §22 |

## Gates for every sub-phase

G1 `make test` · G1b `make test-auth` · G3 `cd web && npm run build` (strict TS) · unit tests (`npm test`, from P13b) · G5 `sh scripts/scan_secrets.sh` · G8 diff review · G9 tracking files. UI acceptance is recorded as a manual check in headless Edge (recipe in `docs/HANDOFF.md`) with what was clicked and what was seen. Push the branch only when these are green; compare `git rev-parse HEAD` with `git ls-remote origin <branch>` afterwards; say "CI not verified" (private repo, no `gh`).

## Tasks and evidence

Tick a box only with evidence (command + result) in `docs/PROGRESS.md`.

### P13a — baseline and decisions
- [x] Decisions D-032…D-036 recorded (owner's go-ahead, hook, stacking, plan §19 override, test tooling)
- [x] `.githooks/commit-msg` accepts `P10`–`P19`
- [x] `ui-redesign.md` committed
- [x] Baseline: `make test`, `make test-auth`, `npm run build`, baseline screenshots, human-route header check

### P13b — design foundation
- [x] `tokens.css` (§16.3) incl. dark values; contrast table re-computed from the committed file
- [x] Self-hosted WOFF2 + `OFL.txt` for IBM Plex Sans, IBM Plex Mono, Newsreader; `@font-face` with `font-display: swap`
- [x] Icon set (§16.7), primitives (§16.8) with `pw-` classes
- [x] Existing six tabs restyled with no behaviour change (network log identical to P13a)
- [x] Vitest installed (dev only) and one passing test

### P13c — app shell and entry
- [x] `web/index.html` landing placeholder + `web/app/index.html`; Vite multi-page build emits both
- [x] Legacy redirect covers every parameter in §3.2; MCP gateway link reaches the same state as before
- [x] `url.ts` (read/write, `action=`); rail + top bar + menu sheet; status footer
- [x] Typed `unreachable` error; unreachable state

### P13d — access and onboarding
- [x] Probe via `GET /ws/{ws}/scenarios`; Connect form with error summary
- [x] `?key=` stored then removed from the URL; referrer policy; sign out
- [x] Story-guide data model (localStorage in try/catch)

### P14a — Run view
- [x] ScenarioList, segmented controls, reset notice, RunStatus, OutcomeStrip (7 variants), AgentLanes, ReleaseSheet, EventLog, LivePanel mapping, MCP-workspace rule (LivePanel not run against a real live run, see D notes)

### P14b — case file
- [x] ReviewQueue, VerdictPair, `whySentence` (unit-tested), WitnessPaths, laundering, ForensicsPanel/steps, PayloadDiff, DecisionPanel + ReviewDialog
- [x] `?autoforensics=1&autoheal=1` completes the flow

### P14c — graph presentation
- [x] `lanesLayout` (unit-tested, deterministic), Tree toggle, GraphTable, NodeDrawer, trace, dim-unrelated, capability `roots` (lanes are columns, see the P14c notes in DECISIONS)

### P14d — remaining views
- [x] Memory ledger + dialog · Time travel scrubber/markers/replay · Remediate inspector/cut comparison/dialogs · Evaluation report + interval chart + `llm_judges` type

### P15a — landing
- [x] Sections §11.1 with data from `summary.json`, `.cypher` and fixture files; CTA reflects the health probe; recorded story data (client-rendered, no preload: see the P15a notes)

### P15b — motion
- [x] Every row of §17.4 in both motion modes (see the P15b notes for the deviations and what was not measured)

### P15c — responsive and accessibility
- [x] Widths 320…1920 × both themes × every view; keyboard-only; reduced motion; 200 % zoom (no screen reader, touch device or real high-contrast theme: see the P15c notes)

### P15d — regression and docs
- [x] Full regression (§21.2); `docs/img/*` regenerated from the real UI; README, MCP, DEPLOY docs updated (see the P15d notes: 608 + 608 backend, 463 web, lint, deployment check)

## Definition of Done (per sub-phase)

Tasks ticked with evidence · gates above · tracking updated · HANDOFF overwritten · branch pushed and verified against the remote.
