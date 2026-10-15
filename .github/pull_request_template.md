## Phase / tasks
Phase: P__ · Tasks: P__-T__, P__-T__
Plan sections implemented: §__

## What changed and why
<!-- 3–6 lines. Behaviour, not a file list. -->

## Evidence (real output, not claims)
| Gate | Command | Result |
|---|---|---|
| Tests | `make test` | <!-- e.g. 142 passed, 0 failed --> |
| Lint | `make lint` | |
| Invariants | `pytest tests/test_invariants.py` | |
| Secret scan | `sh scripts/scan_secrets.sh` | |
| Phase acceptance | <!-- command / steps from the phase file --> | |

## Acceptance criteria (copy from the phase file; tick only with evidence above)
- [ ] 
- [ ] 

## Review checklist
- [ ] Diff contains only this phase's scope (no drive-by refactors or formatting sweeps)
- [ ] No Cypher outside `api/graph/queries/`; no `.content` in `q2*`–`q8*`; no LLM call in the gate
- [ ] No secrets or provider-shaped keys; only `PWDEMO-…-NOT-A-REAL-KEY` fakes
- [ ] Scripted mode and tests pass with no API key
- [ ] No stub presented as done (stubs fail loudly and are listed in PROGRESS → Known gaps)
- [ ] `docs/PROGRESS.md`, `docs/HANDOFF.md`, phase checkboxes and `docs/DECISIONS.md` updated
- [ ] Merge method will be **merge commit** (not squash) to keep incremental history

## Risks / rollback
<!-- What could break; how to revert (tag phase-p<n-1>-done is the last known good). -->
