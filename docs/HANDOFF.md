# Handoff — OVERWRITE this file at every stop

Rules: `docs/WORKFLOW.md` §5. Keep it factual; no history — that belongs in `PROGRESS.md`.

## Header
- **Written:** 2026-10-17 22:55 (+06) · **Agent / tool / model:** Antigravity / Gemini 3.8 Flash (High)
- **Active phase:** P8 (DONE on local `main`) · P12 (VERIFYING: awaiting human items T4-T6, T9)

## Git state at stop
- Branch: `main`
- Working tree: clean. Verify with `git status -sb`, `git log --oneline -5`.

## Where the project stands
- **All technical phases are COMPLETE and verified:**
  - P0–P7: Core schema, graph, runtime, gate, scripted scenarios, forensics, evaluation harness, remediation min-cut, time-travel.
  - P9: MCP tool server and security gateway (3-agent attack held over stdio).
  - P10a–c: Frontend UI (Run, Investigate, Memory, Time travel, Remediation, Evaluation).
  - P11: Multi-tenancy, workspace API keys, human-only guards (`PW_AUTH=on`).
  - P13a: Modernized UI aesthetics (dark mode, glassmorphism, responsive navigation).
  - P8: Live LLM mode:
    1. Multi-key rotation in `api/llm.py` (`LiteLlm`) and `api/settings.py` (`llm_api_keys`): auto-rotates across comma-separated keys on rate limit (429) or auth errors, with adaptive token reset backoff.
    2. B1 and B3 LLM judges (`eval/baselines/{b1.py, b3.py, llm_judge.py}`): exact prompts from plan §20.3, invalid JSON treated as HOLD.
    3. Live-agent empirical study (Plan §20.6) completed: 60 live runs across 3 attack scenarios (`attack_pipeline_42`, `attack_sleeper_44`, `attack_disguise_45`) with `groq/qwen/qwen3.8-27b`:
       - Guard OFF: 30/30 (100.0%) leaked.
       - Guard ON: 30/30 (100.0%) held (`TRIFECTA`).
       - Artifacts saved in `eval/results/live_study.json` and `eval/results/live_study.md`.
    4. README.md updated with 60-run empirical study results.

## Verification
- Local `.venv` (Python 3.11.9, pinned constraints, `.[dev,mcp,llm]`).
- Full pytest suite: **578 passed in 52.63s** (local mode).
- Full pytest suite in hosted mode (`PW_AUTH=on`): **578 passed in 70.11s**.
- Static invariants (`tests/test_invariants.py`): 12/12 passed.
- Documentation drift & link test (`tests/test_docs.py`): 5/5 passed.
- Lint and format (`ruff check` and `ruff format --check`): clean (0 errors, 93 files clean).
- Secret scanner (`bash scripts/scan_secrets.sh`): clean (exit 0).

## Blocked / open items for the owner (Human-only submission items)
1. **LICENSE (P12-T6):** Done (Apache License 2.0 created and referenced in README.md).
2. **Demo Video (P12-T5):** Done (https://www.youtube.com/watch?v=Sy9g-40IoUk added to README.md).
3. **Public Repo (P12-T6):** Switch GitHub repo visibility from private to public.
4. **Portal Submission (P12-T9):** Submit repository URL and video link before deadline (18 Oct 23:59 IST).
