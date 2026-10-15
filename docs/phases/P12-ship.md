# P12 — Ship

> **Tier 1** · Branch `phase/p12-ship` · Depends on: every phase that will ship (cuts per D-010 recorded) · **Start no later than the feature freeze in `PROGRESS.md`**
> **Read in plan.md (only these):** §23, §24 (all), §25, §26, §3 (feature list, for the traceability audit), §20.7, §17 (threat model text), §22-P12

## 1. Objective
A public, reproducible, honestly documented submission: deployed demo, README, demo video, blog post, AI-assistance disclosure, and every item of the final checklist verified.

## 2. Requirements covered
Plan §23 deployment, §24 README / video / walkthrough / blog / disclosure / final checklist, §25 judge answers, §26 decisions log (as README limitations). Items needing the human are tagged **[human]**.

## 3. Prerequisites
Shipping phases DONE; `make test` green; `make eval` reproducible; A-14 settled (license; hosting accounts); hosted FalkorDB capability known (A-15).

## 4. Files expected to change
Create: `README.md` (17 sections, §24.1 order) · `docs/{graph-model.md,threat-model.md,AI_ASSISTANCE.md,blog.md}` · `LICENSE` [human choice] · Dockerfiles / deployment config as needed · demo GIF/video links.
Modify: `docker-compose.yml`, `Makefile` (if `make up && make demo` needs final polish), `.github/workflows/ci.yml`, `docs/PROGRESS.md`.

## 5. Tasks
- [x] **P12-T1 README** per §24.1 (pitch + GIF, problem and sources, quickstart `make up && make demo` with no key, architecture, data model with diagram, queries/algorithms with links to `api/graph/queries/`, forensics, time travel and memory hygiene, remediation incl. proof sketch and optimality gap, MCP, evaluation with dataset/baselines/results/live study/limitations/falsification criteria, threat model and non-goals, related work table (§2), tracks entered, AI disclosure, deployment, license). **All numbers copied from generated files**, never typed (rule 11). Cut or partial features (D-010) listed honestly under limitations.
- [x] **P12-T2 Docs:** `graph-model.md` (tables + mermaid from §7), `threat-model.md` (from §17), `AI_ASSISTANCE.md` (the §24.5 draft corrected to what actually happened; use the PROGRESS session log for tool/model facts), `blog.md` (§24.4 title and story).
- [x] **P12-T3 Clean-machine test:** fresh clone into a new folder (or a dedicated CI job): `make up && make demo` with **no API key** succeeds; record evidence.
- [ ] **P12-T4 Deployment** (§23): hosted FalkorDB (probe it first — A-15), API host, web on Vercel with `VITE_API_BASE`, `PW_AUTH=on`, keys from the platform environment, hosted demo workspace seeded on startup so a judge can click **Run** immediately. Keep the local path (and the demo video) as the fallback if hosting misbehaves.
- [ ] **P12-T5 [human] Demo video** (~3 min, shot list §24.2, include where Pathwarden is *not* better) and GIF; public link in the README.
- [ ] **P12-T6 [human] Repository:** choose the license; make the repo **public**; confirm secret scanning/push protection state; confirm no secrets in history (`sh scripts/scan_secrets.sh` plus a scan of `git log -p` for provider-shaped strings).
- [x] **P12-T7 Traceability audit:** table F1–F15 → test names / evidence in `PROGRESS.md`; every gap stated in the README.
- [x] **P12-T8 Final checklist** (§24.6) — each item ticked with evidence, plus `npm audit --omit=dev` result and `make test`/`make eval` re-run on `main`.
- [ ] **P12-T9 [human] Submit** before **18 Oct 2026 23:59 IST (19 Oct 00:29 Bangladesh time)**; save the confirmation; verify the repo is public from a logged-out browser.

## 6. Tests and validation
`make test` and `make eval` (twice, identical) on `main` · clean-clone run (T3) · `sh scripts/scan_secrets.sh` · link check of the README (manual) · logged-out view of the repo, the live URL and the video.

## 7. Acceptance criteria
Every box of §24.6 ticked with evidence: public repo with incremental commits after 15 Oct 2026 12:01 AM IST · README with setup and data model, queries linked · `make up && make demo` works on a clean machine with no key · `make test` green, `make eval` reproducible · demo video public · live URL and local instructions · tracks named (Track 01, Track 02) · AI assistance disclosed · only synthetic data and no real-provider-shaped keys · submitted before the deadline.

## 8. Risks and failure scenarios
- Time: video and hosting always take longer than planned → start by the freeze; keep the local fallback.
- Docker/Windows issues on the demo machine → rehearse the clean-clone path (T3) early.
- Hosted FalkorDB without `GRAPH.COPY` / `algo.maxFlow` → forensics and remediation break only in production (A-15).
- README claiming more than the code does, or numbers not matching `results.csv`/`summary.md` → credibility loss; generate, don't type.
- Secrets in git history or push protection blocking the push.
- The disclosure (§24.5) overstating the author's manual review — write only what is true.
- The live demo failing during judging → video + local run are the fallbacks.

## 9. Definition of Done
Tasks ticked with evidence (human tasks marked done by the human in PROGRESS) · G1, G2, G4, G5, G6, G10 · final checklist complete · submission confirmation recorded · PR merged · tag `phase-p12-done` · `PROGRESS.md` shows every phase DONE or consciously cut (D-010).

## 10. Git checkpoints
`P12: docs: readme` · `P12: docs: graph model, threat model, ai assistance` · `P12: docs: blog draft` · `P12: chore(deploy): hosted configuration and seeding` · `P12: test: clean-clone and final checklist evidence` → PR → merge → tag. Commit early and often; the hackathon wants incremental history.

## 11. Outcome (2026-10-16)
**Done by the agent:** T1 README, T2 docs, T3 clean-clone test, T7 traceability audit (`docs/TRACEABILITY.md`), T8 final checklist (`docs/FINAL_CHECKLIST.md`). **T4 (deployment): prepared, not done** - `docs/DEPLOY.md` is the checked recipe; accounts and the FalkorDB capability probe on a hosted host (A-15) need the owner. **Human tasks, still open:** T5 video, T6 license + making the repository public + secret-scanning settings, T9 submission. P12 therefore stays VERIFYING, not DONE (D-010: the definition of done includes the human items).
