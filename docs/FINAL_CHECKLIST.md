# Final checklist (plan §24.6, P12-T8)

Each item with its evidence, run on 2026-10-16 against the branch that becomes `main` after the P12 merge. **[human]** = only the owner can do it; the agent leaves it open instead of ticking it.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Public repo with incremental commits after 15 Oct 2026, 12:01 AM IST | **Commits: done. Public: [human], open.** The repository is private by decision D-014 | 87 commits on this branch when the check was made (`git rev-list --count HEAD`), one per logical change, first at 15 Oct 18:50 (+06) = 18:20 IST, i.e. after 12:01 AM IST; one configured identity, no agent names in git. Making it public, confirming secret scanning / push protection and the license are P12-T6 |
| 2 | README with setup and graph data model; queries linked | Done | `README.md` (17 sections in the plan's order, queries linked to `api/graph/queries/`), `docs/graph-model.md`; `tests/test_docs.py` checks the section order, that every local link resolves, and that the numbers equal `eval/results/summary.*` |
| 3 | `make up && make demo` works on a clean machine with no key | Done (on a fresh clone of this branch, Windows + Docker Desktop; no `.env`) | `make setup` exit 0, `make up` exit 0 (waits for the database), `make demo` exit 0 with the six scenarios as expected (3 held, 3 clean, and the three leaks with the guard off), `make test` 517 passed, `make eval` byte-identical to the committed results; the clone and its containers were removed afterwards |
| 4 | `make test` green; `make eval` reproducible | Done | `make test` and `make test-auth`: all passed in both modes; `make eval` run twice, `results.csv`, `summary.json`, `summary.md` byte-identical (sha256 compared); `make probe` 36/36, `make probe-mcp` 7/7 |
| 5 | Demo video public | Done | YouTube: https://www.youtube.com/watch?v=Sy9g-40IoUk (4:09 broadcast film) |
| 6 | Live URL and local instructions | Local: done. **Live URL: [human], open** (not deployed) | `docs/DEPLOY.md` is the recipe incl. the FalkorDB capability probe (A-15); README section 16 says "no hosted demo is running yet" |
| 7 | Tracks named: Track 01, Track 02 | Done | README header and section 14 |
| 8 | AI assistance disclosed | Done, **two statements need the owner's confirmation** | README section 15, `docs/AI_ASSISTANCE.md` (how `plan.md` was produced; any code review the owner did) |
| 9 | Only synthetic data; no real-provider-shaped keys | Done | `sh scripts/scan_secrets.sh`: ok; a scan of the whole history (`git log -p --all`) for provider-shaped strings finds 3 lines, all prose or the scanner's own pattern list, no key values; the only tracked `.env*` file is `.env.example`; every secret in fixtures is `PWDEMO-...-NOT-A-REAL-KEY`; `npm audit --omit=dev`: 0 vulnerabilities |
| 10 | Submitted before 18 Oct 2026, 11:59 PM IST (19 Oct 12:29 AM Bangladesh) | **[human], open** | no confirmation recorded |

## Open items for the owner, in the order they block submission

1. Make the repository public on GitHub; confirm secret scanning and push protection (LICENSE file added, Apache 2.0).
2. Demo video: Done (https://www.youtube.com/watch?v=Sy9g-40IoUk).
3. Deploy (P12-T4): accounts, then `docs/DEPLOY.md`; or accept the local-only demo and say so (the README already does).
4. Confirm the two statements in `docs/AI_ASSISTANCE.md`; confirm or reject D-017, D-018, D-019, D-023.
5. P8 live study & judges: Done (evaluated with `groq/qwen/qwen3.8-27b`).
6. Submit and save the confirmation.
