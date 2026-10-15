# P0 — Probe and skeleton

> **Tier 1** · Branch `phase/p0-skeleton` (bootstrap commit goes on `main`) · Depends on: human environment actions (D-006, D-007, D-008)
> **Read in plan.md (only these):** §4, §6 (incl. ⚠️ PROBE list), §10 (the ⚠️ PROBE notes only), §21, §22-P0, §23 (Windows note)

## 1. Objective
A reproducible repo skeleton, proof that FalkorDB behaves as the plan assumes (or a recorded, tested fallback for every difference), and the workflow enforcement (hooks, CI, branch protection) working in the real clone.

## 2. Requirements covered
Foundation for everything: §6 stack, §21 layout (skeleton only), §22-P0, health endpoint from §18, workflow safeguards from this blueprint.
**Out of scope:** fixtures (P1), any runtime/gate logic, UI, `api`/`mock-upstreams` compose services (added in P3/P9).

## 3. Prerequisites
Python 3.11 installed (D-007) · GNU Make installed (D-008) · Docker Desktop **started** (its daemon was down on 2026-10-15) · D-006 accepted (ruff) · GitHub repo `https://github.com/sakibul-shovon/pathwarden.git` exists (private, D-014; confirm it is empty) · blueprint approved.

## 4. Files expected to change
Create: `pyproject.toml`, `constraints.txt` (from `pip freeze`, optional), `Makefile`, `docker-compose.yml`, `api/__init__.py`, `api/main.py`, `api/settings.py`, `api/graph/__init__.py`, `api/graph/client.py`, `scripts/probe_falkordb.py`, `tests/conftest.py`, `tests/test_invariants.py`, `tests/test_health.py`.
Modify: `.github/workflows/ci.yml` (remove `hashFiles` guards, pin image), `docs/DECISIONS.md` (Part C), `docs/PROGRESS.md`, `docs/HANDOFF.md`.

## 5. Tasks
- [ ] **P0-T1 Bootstrap git and hooks.** In a clone of the remote (or `git init -b main` + `git remote add origin …`): check `git ls-remote origin` (empty? existing commits? — if it has commits, fetch and stop to ask). `git config core.hooksPath .githooks`. **Verify the hooks without making throwaway commits**: stage a file and run `sh .githooks/pre-commit` on `main` after the root commit (must refuse); `sh .githooks/commit-msg <file>` with a good and a bad message; build a credential-shaped string at runtime (`printf 'ghp_%s' "$(printf 'a%.0s' $(seq 36))"`) into an untracked file, stage it, run `sh scripts/scan_secrets.sh` (must fail), unstage and delete it; feed `.githooks/pre-push` crafted ref lines on stdin (push to main, non-fast-forward, delete). Record results in Evidence. Root commit: `P0: chore: bootstrap agent workflow and plan` on `main`; human pushes once with `PW_ALLOW_MAIN=1 git push -u origin main`.
- [ ] **P0-T2 Python environment.** `py -3.11 -m venv .venv`; confirm `python --version` inside it is 3.11.x.
- [ ] **P0-T3 `pyproject.toml`.** `requires-python >=3.11`. Base deps = §6 core only: fastapi, uvicorn, pydantic (v2), pyyaml, falkordb, httpx; extra `dev` = pytest (+ ruff if D-006 accepted). No litellm/mcp yet (D-011). Resolve versions by installing, then record them (constraints file or exact pins).
- [ ] **P0-T4 `Makefile`.** `SHELL := bash`. Targets from §21 (`up down probe test demo eval eval-live api web mcp-server gateway fmt`) plus `lint` and `hooks`. Targets for later phases are **fail-loud stubs** (`echo "not implemented until P<n>"; exit 1`). Must run in Git Bash and on Ubuntu CI.
- [ ] **P0-T5 `docker-compose.yml`.** Service `falkordb` only (ports 6379 and 3000). `make up` / `make down`. Verify with `docker compose ps` and a client connection.
- [ ] **P0-T6 API and graph client skeleton.** `api/settings.py` (Pydantic settings from env; names per `.env.example`, resolve A-13), `api/graph/client.py` (connect, `select_graph`, thin `query`/`ro_query` wrappers — only calls shown in plan §6), `api/main.py` with `GET /api/health` → `{"falkordb":"ok","graphs":[...]}`.
- [ ] **P0-T7 `scripts/probe_falkordb.py`.** One check per item below; prints a PASS/FAIL table; exit ≠ 0 on any FAIL; graphs named `pw_probe_*` and always cleaned up; every probe uses the *exact* Cypher from the plan where one exists (q1_lookup_key, q4, q2b…); a PASS means the **returned value** matched, not merely "no error". Checks: connect + params · `ro_query` · graph delete method name · index DDL · multi-type variable-length `[:A|B*1..16]` · `none()` + `coalesce` over `nodes(path)` · list projection / list concatenation · `algo.maxFlow` on the docs example (A→B 10, A→C 5, B→C 8 ⇒ maxFlow 13) incl. projecting edge properties · `copy` / `list` / delete (destination must not exist) · `UNWIND`+`CREATE`+`DELETE` of relationships · list-of-maps parameters · `OPTIONAL MATCH … WHERE` keeping the outer row (build a root whose only descendant is sanitized; q4 must still return it) · `STARTS WITH` · `ORDER BY` on a returned alias · property of a matched node inside `CREATE` (`agent_id: s.agent_id`) · `MERGE` on a node · empty `UNWIND` followed by `RETURN count(...)`.
- [ ] **P0-T8 Record outcomes.** `docs/DECISIONS.md` Part C: one row per probe item (PASS/FAIL, verified syntax, fallback chosen, e.g. q2b `UNION` fallback or r2 endpoint-name projection). Image tag/digest and client version. Settle A-03 (timeout) and A-13.
- [ ] **P0-T9 Invariant tests and CI.** `tests/test_invariants.py` seeded per `docs/WORKFLOW.md` §7 (P0 list); `tests/test_health.py`; remove the `hashFiles` guards from `ci.yml` so a missing scaffold is a hard failure; `api` job green on the PR.
- [ ] **P0-T10 Pin FalkorDB** (D-012) in `docker-compose.yml` and `ci.yml` to the version `make probe` passed on.
- [ ] **P0-T11 GitHub settings (human).** Branch protection on `main`, secret scanning + push protection + Dependabot alerts, merge-commit-only (`docs/WORKFLOW.md` §6.7). The repo is private (D-014): record which of these GitHub actually offers on your plan and which are waiting for the repo to become public; merge-commit-only and Dependabot are repo-level settings worth checking either way. Record the outcome.
- [ ] **P0-T12 Hosted target probe (optional, recommended).** If a hosted FalkorDB endpoint exists, run the probe against it (A-15): `GRAPH.COPY` and `algo.maxFlow` must work there.

## 6. Tests and validation
`make probe` · `make up` then `curl http://localhost:8000/api/health` (port per A-13) · `make test` (health + invariants) · hooks checks from T1 · CI green on the PR · `sh scripts/scan_secrets.sh`.

## 7. Acceptance criteria
1. `make probe` prints one line per item and exits 0 — **or** every FAIL has a recorded fallback in `docs/DECISIONS.md` that the probe itself demonstrates working (plan §22).
2. From a fresh clone on this Windows machine: venv → `make up` → `make probe` → `make test` all succeed under Git Bash.
3. CI jobs `repo-hygiene` and `api` pass on the P0 PR with the guards removed.
4. Hook behaviour verified (T1 evidence); `main` protected (T11).
5. FalkorDB image pinned to the probed version.

## 8. Risks and failure scenarios
- Python 3.11 / `make` not installed → nothing runs; resolve first (D-007/D-008).
- Docker Desktop not running or port 6379/3000 in use → `make up` fails; document the check.
- A probe that "passes" vacuously (no error but wrong value) → hides a later Cypher bug; assert returned values.
- Probe FAILs on `algo.maxFlow` or multi-type paths → P2/P6 need the fallbacks; record them before moving on.
- `latest` image drift between local and CI → pin (T10).
- CRLF line endings breaking shell scripts/Makefile on Windows → `.gitattributes` forces LF; verify with `file`/`git ls-files --eol`.
- Hooks not executable on Linux → `git update-index --chmod=+x .githooks/* scripts/scan_secrets.sh`.
- Hosted FalkorDB lacking `GRAPH.COPY`/`maxFlow` → the forensic sandbox and remediation would fail only in production (A-15).

## 9. Definition of Done
All tasks ticked with evidence · gates G1, G2 (if D-006 accepted), G4, G5, G6, G10 pass · Part C of `DECISIONS.md` complete · PROGRESS/HANDOFF updated · PR merged (merge commit) · tag `phase-p0-done`.

## 10. Git checkpoints
1. `P0: chore: bootstrap agent workflow and plan` (root commit on `main`) · 2. `P0: chore(env): python project, makefile, compose` · 3. `P0: feat(api): health endpoint and graph client` · 4. `P0: test(probe): falkordb capability probe` · 5. `P0: docs: record probe results and decisions` · 6. `P0: ci: pin falkordb image and enforce scaffold` → PR → merge → tag.
