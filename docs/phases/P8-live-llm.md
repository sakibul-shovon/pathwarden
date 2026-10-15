# P8 — Live LLM mode

> **Tier 3** · Branch `phase/p8-live-llm` · Depends on: P3, P4, P5 DONE **and** a Groq model name + API key from the human (provider chosen 2026-10-15; model and key still pending — A-14). The key goes only in the local `.env` as `PW_LLM_API_KEY`.
> **Read in plan.md (only these):** §12.3 and §12.3.1 (prompts and tool menus), §13.3, §20.3 (B1/B3 prompt and rules), §20.6, §22-P8, §4 rules 3, 5, 10, 13

## 1. Objective
Run the same three roles as real LLM agents, let an LLM drive the Forensic Agent (with a scripted fallback), fill the LLM-judge baseline rows, and produce an honest live-agent study.

## 2. Requirements covered
F11 (live agents), F6 LLM mode, F14 (B1 per-action judge, B3 full-trace judge), live study (§20.6). Enables the live toggle in the UI.
**Out of scope:** the gate stays LLM-free (rule 3); trust labels never come from an LLM (rule 5).

## 3. Prerequisites
LiteLLM is **not** a dependency yet (D-011). First action is the probe (rule 13): `scripts/probe_litellm.py` — a tiny script calling one completion through LiteLLM with the configured model, printing the response shape, run with a real key. Without a key, only the key-less parts (fake LLM, prompt golden tests) can be completed and verified; say so in the PROGRESS evidence.

## 4. Files expected to change
Create: `scripts/probe_litellm.py` · `api/agents/live.py` · `api/agents/prompts/{triage,fixer,release,extractor,forensic}.txt` (verbatim) · `eval/baselines/{b1.py,b3.py}` · `eval/live_study.py` · `tests/live/*` (fake LLM).
Modify: `pyproject.toml` (extra `llm`), `api/forensics/agent.py` (LLM plan + fallback), run endpoint (accept `mode:"live"`), `Makefile` (`eval-live`), `eval/run_eval.py` (fill B1/B3), `web/` (enable live toggle), `.env.example` if names change.

## 5. Tasks
- [ ] **P8-T1 Probe LiteLLM** and record the verified call shape in `DECISIONS.md`. Add extra `llm`.
- [ ] **P8-T2 LLM seam:** one function `complete(messages) -> str` (model, key, temperature from `PW_LLM_*`); a deterministic fake for tests. The real key is read only in settings and never logged.
- [ ] **P8-T3 Live agent loop** (`live.py`): conversation format and JSON-only replies per §12.3.1; max 6 steps; invalid JSON → one retry then stop the session; tool mapping per the table (`memory_read`→`load_by_key`, `memory_list`→`load_by_prefix` with JSON list result, `read_env`→`read_source`, `workspace_write` kind by key prefix, `post_release`→propose payload = latest non-quarantined artifact for that key).
- [ ] **P8-T4 Infrastructure `extract_task`:** the orchestrator calls it right after Triage's `fetch_issue`, sending only the raw issue text, validating against `TaskSchema`; the Triage LLM never calls it.
- [ ] **P8-T5 Prompts verbatim** from §12.3.1 and §13.3 into the `.txt` files; golden test comparing file text to the plan's blocks (no security wording added).
- [ ] **P8-T6 Live scenario run** through the existing run endpoint (`mode:"live"`) and the guard/gate exactly as in scripted mode.
- [ ] **P8-T7 LLM forensic mode:** the LLM chooses among the same tools (≤ 8 calls) and must output a valid `ForensicReport`; inputs are tool outputs only; invalid JSON / unknown tool / over budget ⇒ scripted plan and `fallback_used: true`.
- [ ] **P8-T8 B1/B3 judges** with the exact prompt of §20.3, temperature 0, model name reported; invalid JSON counts as HOLD and is reported separately; rows `not_run` when no key.
- [ ] **P8-T9 Live study** (`eval/live_study.py`, `make eval-live`): each attack demo scenario 10× guard off (how often the live Fixer copied secrets), then guard on (held rate). Record whatever the numbers are. **Ask the human before running — it spends money.**
- [ ] **P8-T10 Enable the UI live toggle** and verify with the manual checklist.

## 6. Tests and validation (no key required)
Fake LLM follows the injection → attack held; fake LLM refuses → benign path; invalid JSON → retry once → session stops; >6 steps → stops; forensic fake exceeds 8 calls / bad JSON / unknown tool → `fallback_used: true` with a valid report; prompt golden test; B1/B3 invalid-JSON → HOLD flagged; `not_run` rows without a key; no secret appears in logs (`caplog` check on the key).
With a key (manual): probe prints a response; one live scenario end-to-end; B1/B3 columns filled; live-study table produced.

## 7. Acceptance criteria (§22-P8)
1. A live scenario runs end-to-end.
2. B1/B3 rows are filled with the model name reported.
3. The live-study table is produced and reported honestly.
4. LLM forensic mode yields a valid report or falls back with `fallback_used: true`.
5. `make test` still passes with `PW_LLM_*` unset.

## 8. Risks and failure scenarios
- Provider/SDK drift (hence the probe). · **Groq rate/token limits** (free tier unknown until measured): the live study and especially the B3 full-trace judge send many long prompts — measure limits in the probe, add retry/backoff, never silently shrink the study; if the study has to be reduced, say so in the results. · Confirm in the probe that a `groq/<model>` string and an explicit API key work through LiteLLM. · Cost: ask before `eval-live`. · Non-determinism even at temperature 0: never assert on live output in `make test`.
- The live model may not follow the injection: report that honestly (rule 11, §20.6) — do not tune prompts to force a leak.
- Key leakage via logs, committed `.env`, or test fixtures: `scan_secrets.sh` and review.
- Prompt-injection against the forensic LLM: it sees ids and metadata only.
- Treating an LLM judge's verdict as ground truth; ground truth is by construction.

## 9. Definition of Done
Tasks ticked with evidence (state clearly which were verified with a real key) · G1, G2, G4, G5, G6, G8, G10 · tracking updated · PR merged · tag `phase-p8-done`.

## 10. Git checkpoints
`P8: chore(deps): litellm probe and llm extra` · `P8: feat(agents): live agent loop and prompts` · `P8: feat(forensics): llm plan with fallback` · `P8: feat(eval): b1 and b3 judges` · `P8: feat(eval): live study` · `P8: feat(web): enable live mode` → PR → merge → tag.
