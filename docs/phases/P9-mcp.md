# P9 — MCP tool server and gateway

> **Tier 3** · Branch `phase/p9-mcp` · Depends on: P3, P4 DONE (P8 needed only for the live-agent demo shot)
> **Read in plan.md (only these):** §16 (all), §8.8, §5, §22-P9, §4 rules 6, 13

## 1. Objective
Expose Pathwarden as MCP tools, and provide a transparent MCP gateway so any MCP client gets lineage tracking and the gate with no code changes — demonstrated by holding the same attack with an MCP tool error.

## 2. Requirements covered
F12: MCP tool server (5 tools), MCP gateway (identity, tool filtering, read/write/load/external handling, quarantine filtering, unmanaged reads), mock upstream MCP servers, lineage in `pw_mcp_<workspace>`.
**Out of scope:** changing the gate or runtime semantics; the gateway uses them as-is.

## 3. Prerequisites
**Probe first (rule 13):** `scripts/probe_mcp.py` starts a minimal SDK server with one tool and calls it from an SDK client, using the SDK's documented server and client APIs *as they exist now*. The MCP package is added only as extra `mcp` (D-011). Resolve A-11 (compose `mock-upstreams` vs stdio spawning) from what the probe shows.

## 4. Files expected to change
Create: `scripts/probe_mcp.py` · `api/mcp/{tool_server.py,gateway.py}` · `mock_upstreams/{__init__,github,env,memory,workspace,release}.py` · `fixtures/gateway.yaml` (verbatim §8.8) · `tests/mcp/*`.
Modify: `pyproject.toml` (extra `mcp`), `docker-compose.yml` (`mock-upstreams`, per A-11), `Makefile` (`mcp-server`, `gateway`), `tests/test_invariants.py`, `docs/DECISIONS.md`.

## 5. Tasks
- [x] **P9-T1 Probe the MCP SDK** and record the verified API and transport in `DECISIONS.md`. Add extra `mcp`.
- [x] **P9-T2 Mock upstream servers** (`mock_github.get_issue`, `mock_env.get_env`, `mock_memory.{memory_write,memory_read,memory_list}` where list returns JSON text `[{"key","content"}]`, `mock_workspace.{workspace_write,workspace_read}`, `mock_release.post_release` appending to a file) — implemented with the SDK, fixture-backed.
- [x] **P9-T3 Gateway configuration** loader for `gateway.yaml`: `{number}`/`{key}` templating from call args; the filled `source_id` must exist in the registry else the call is **refused**; unlisted upstream tools are hidden; exposed names are `<server>__<tool>`.
- [x] **P9-T4 Identity and session:** one gateway process per agent connection; env `PW_WORKSPACE`, `PW_AGENT_ID`, `PW_DAY_LABEL`, `PW_TASK_REF` (never MCP client metadata); one process lifetime = one `Session`; graph `pw_mcp_<workspace>` seeded from the registry if empty.
- [x] **P9-T5 Tool-class handling** per §16.2: `read` → forward + `read_source`; `write` → forward + `write(kind,key,content)` in the configured store; `load` with `key_arg` → `q1_lookup_key` (found → forward + `load`; `q1_key_exists`>0 but none non-quarantined → tool error `Quarantined by Pathwarden: <key>` without forwarding; never written through the gateway → forward and record via `read_source` on `src:unmanaged:<store>`, trust `untrusted`, created with `q1_add_source` on first use); `load` with `prefix_arg` → forward, parse the JSON text, **remove quarantined entries from the response**, load the rest; `external` → `write` a `draft` from `args[content_arg]`, `propose`, gate — ALLOW forwards, HOLD/BLOCK returns tool error `Held by Pathwarden: <action_id> (<reason>). Review at <ui_url>`.
- [x] **P9-T6 MCP tool server:** `pathwarden_gate`, `pathwarden_explain`, `pathwarden_quarantine_preview`, `pathwarden_forensics`, `pathwarden_toxic_agents` backed by the existing services.
- [x] **P9-T7 Tests via an SDK client** (below). **P9-T8 Demo script/doc:** three live LLM agents as three separate MCP client sessions through the gateway (requires P8; if P8 is cut, demo with a scripted MCP client and say so).

## 6. Tests and validation (§22-P9)
`probe_mcp.py` passes · an SDK client lists and calls `pathwarden_gate` · the three-agent attack through the gateway is held with an MCP tool error and the same witnesses appear in the UI · lineage is visible in `pw_mcp_<ws>` · `memory_read` of a quarantined key returns a tool error · `memory_list` omits quarantined entries · a read of a key never written through the gateway is recorded under `src:unmanaged:<store>`.
Also: an unlisted upstream tool is not exposed · a `source_id` outside the registry is refused · two gateway processes with different `PW_AGENT_ID` yield separate sessions · fail closed on malformed upstream JSON.

## 7. Acceptance criteria
All §22-P9 items demonstrated with recorded evidence (commands, outputs, and a graph query result for `pw_mcp_<ws>`).

## 8. Risks and failure scenarios
- SDK API differs from memory → the probe prevents writing against a guessed API.
- stdio subprocess spawning and signal handling on Windows; zombie processes; deadlocked pipes.
- Gateway cannot see the LLM's internal state (documented non-goal) — context is conservative by design.
- Compose/stdio contradiction (A-11).
- Filtering `memory_list` incorrectly could leak or hide entries; test both.
- Registry/gateway config mismatch → legitimate calls refused; error messages must say why.

## 9. Definition of Done
Tasks ticked with evidence · G1, G2, G4, G5, G6, G8, G10 · A-11 Resolved · tracking updated · PR merged · tag `phase-p9-done`.

## 10. Git checkpoints
`P9: chore(mcp): sdk probe and mcp extra` · `P9: feat(mcp): mock upstream servers` · `P9: feat(mcp): gateway core and identity` · `P9: feat(mcp): tool-class handling and quarantine filtering` · `P9: feat(mcp): pathwarden tool server` · `P9: docs: gateway demo` → PR → merge → tag.

## 11. Outcome (2026-10-16)
All eight tasks done (the demo of T8 uses scripted MCP clients because P8 is not done, and says so). Evidence in `docs/PROGRESS.md` (P9 rows), decisions D-022 to D-027 in `docs/DECISIONS.md` Part B12, usage in `docs/MCP.md`. Tests live in `tests/test_mcp_gateway.py` and `tests/test_mcp_tool_server.py` (flat layout like the other phases) instead of `tests/mcp/*`.
