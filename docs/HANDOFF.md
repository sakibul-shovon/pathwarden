# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. The next agent must **verify** this against the real repository (git state, `make test`) before trusting it. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-17 (UI redesign, P13a) · **Agent / tool / model:** Claude Code / Opus 5.5 (plan) and Sonnet 5.5 (implementation)
- **Takeover notes** (filled by the next agent: what differed from this file):
  -

## Git state at stop
- Branch: `phase/p13a-homepage` (from `main` = `34f1d85`). Commits are local; **nothing was pushed or merged**, no tag. Verify with `git log --oneline -8`, `git status -sb`.
- `main` still has the old UI. Merging this branch changes the whole frontend: that is the owner's decision (see below).

## Where the project stands
- P0–P7, P9, P10a–c, P11 and P12 (agent part) are as in the previous handoff (backend untouched, 517 tests last recorded on 2026-10-16). **P13a (UI redesign) is implemented and committed on the branch.**
- What P13a is: Home page; console shell (top bar, nav rail, workspace switcher, health pill, theme menu, auth chip, inbox badge); sign-in screen for `PW_AUTH=on`; all six views restyled with the same ids, labels, deep links, API calls and human-action guards; GSAP (hero route, agent pipeline packets, witness trace) and Motion (presence, springs, layout). Decisions: **D-032, D-033**. Plan and rationale: `ui-redesign.md` (its §2 decisions U-1..U-12 were answered in chat as "ignore plan.md, use an animation library, do it all").
- **Needs the owner:** (1) confirm D-032 and decide whether to edit `plan.md` §6/§19 so it matches the UI (it does not now); (2) review the redesign in a real browser; (3) decide timing vs the 18 Oct 23:59 IST submission (merging a full redesign before submission is a risk; the previous UI is intact on `main`); (4) merge/tag is allowed by D-016 only when every gate is green, and G10/real-API verification is **not** done (see below), so it was not merged.
- Environment: Docker Desktop's engine did **not** start on this machine in this session (service stopped, started from the GUI but never answered), so `make up`, `make test` and the real API were not run. `.venv` does not exist here; Python is 3.12 (the project uses 3.11). The UI was verified in headless Edge against a plan-§18 mock API kept in the agent's scratch folder (not in the repo).

## Verification so far (real results, 2026-10-17)
- `npm run build` ok (strict tsc), no `any`, `npm audit --omit=dev` 0, `scan_secrets` ok.
- Headless Edge vs the mock: local mode 49/49 checks, hosted mode 15/15, DOM accessibility audit clean after one fix. Details in `docs/PROGRESS.md`.
- **Not verified:** the real API, `make test`, CI, NVDA/axe, Safari/Firefox, a human click-through, light/dark screenshots in `docs/img/` (stale).

## Traps and findings a newcomer must know
- Everything in the previous handoff still applies (plan queries can be inconsistent, aggregate-return trap, time travel shows current flags, `make` not on PATH in Git Bash, etc.).
- The commit-msg hook accepted only `P0..P12`; D-033 extends it to `P13`.
- Heredocs with quotes broke Bash twice more: write files with the Write tool.
- `?autorun`, `?autoforensics`, `?autoheal` are one-shot now (removed from the URL after they fire). `?key=` is removed from the address bar after it is stored.
- The UI shows the "agent activity" as a replay of the finished run; the API does not stream.
- A hosted build needs the UI and API on one origin (no CORS), unchanged.

## Blocked / questions for the human
1. Confirm D-032 (UI redesign, new dependencies: `motion`, `gsap`, `@gsap/react`, two `@fontsource` fonts) and whether to amend `plan.md` §6/§19.
2. Approve merging `phase/p13a-homepage` into `main`, before or after the 18 Oct submission.
3. Still open: Groq model + key + license (A-14, P8/P12); making the repo public (D-014); D-017/D-018/D-019/D-023 from before.

## Next action (exactly one)
Start Docker Desktop (check `docker info` answers), run `make up`, then load `http://localhost:5173/` (`make web`) and repeat the P13a walkthrough (`ui-redesign.md` §8 journeys J1–J7) against the **real** API; fix any contract mismatch; then ask the owner to review and approve the merge.
