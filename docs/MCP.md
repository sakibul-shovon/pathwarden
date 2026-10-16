# Pathwarden over MCP (P9)

Two things, both optional (install with `pip install -e ".[mcp]"`; scripted mode and the tests of the other phases do not need the SDK):

1. **Tool server** (`make mcp-server`): ask Pathwarden questions from any MCP client.
2. **Gateway** (`make gateway`): a transparent proxy in front of other MCP servers. Any MCP client gets lineage tracking and the gate with no code change. **One gateway process per agent.**

The SDK is `mcp` 2.x (the 1.x names such as `FastMCP` no longer exist); `scripts/probe_mcp.py` (`make probe-mcp`) shows the exact calls that were verified.

## Tool server

| Tool | Result |
|---|---|
| `pathwarden_gate(workspace, action_id)` | verdict, reason, witnesses (computed now, not recorded) |
| `pathwarden_explain(workspace, action_id)` | both witness paths and the memories that laundered the text |
| `pathwarden_quarantine_preview(workspace, source_id)` | what a quarantine would cover (read-only) |
| `pathwarden_forensics(workspace, action_id)` | runs the scripted Forensic Agent (it quarantines automatically, which is risk-reducing; releasing stays a human action in the UI) |
| `pathwarden_toxic_agents(topology)` | toxic agents of a capability graph (`r4`) |

Client configuration (stdio):

```json
{ "mcpServers": { "pathwarden": { "command": "python", "args": ["-m", "api.mcp.tool_server"],
  "cwd": "<repo>", "env": { "PW_FALKORDB_HOST": "localhost" } } } }
```

## Gateway

Configuration: `fixtures/gateway.yaml` (plan §8.8, verbatim). It lists the upstream servers (spawned over stdio by the gateway) and, per tool, a class: `read`, `write`, `load` (by key or by prefix) or `external`. Only listed tools are exposed, named `<server>__<tool>`; everything else is hidden.

Identity comes from the environment, never from MCP client metadata. One process lifetime is one Pathwarden session:

```json
{ "mcpServers": { "pathwarden-gateway": { "command": "python", "args": ["-m", "api.mcp.gateway"],
  "cwd": "<repo>",
  "env": { "PW_WORKSPACE": "tinyqueue", "PW_AGENT_ID": "fixer", "PW_DAY_LABEL": "Mon",
           "PW_TASK_REF": "issue:42", "PW_FALKORDB_HOST": "localhost" } } } }
```

The agent must be declared in `fixtures/registry.yaml`. Lineage goes to the graph `pw_mcp_<workspace>` (created from the registry if it does not exist). Optional: `PW_GATEWAY_CONFIG` points at another config file (the tests use it for a throw-away graph), `PW_STATE_DIR` is the state folder (default `state`).

What each class does:

| Class | Behaviour |
|---|---|
| `read` | the `source_id` template is filled from the call arguments; it must exist in the registry, otherwise the call is **refused** and not forwarded; forwarded, then recorded as a raw artifact originating from that source |
| `write` | forwarded, then recorded as an artifact derived from **everything the session read or loaded** |
| `load` by key | quarantined (every version) -> tool error `Quarantined by Pathwarden: <key>`, **not forwarded**; recorded in the lineage -> forwarded and linked to the session; never written through the gateway -> forwarded and recorded as a read of `src:unmanaged:<store>` (trust `untrusted`) |
| `load` by prefix | forwarded; quarantined entries are **removed from the response**; the rest are loaded; malformed upstream JSON is a tool error (fail closed) |
| `external` | the payload becomes a draft artifact, an action is proposed and gated; ALLOW forwards, HOLD/BLOCK returns the tool error `Held by Pathwarden: <action_id> (<reason>). Review at <ui>` |

## See it

```
make up                 # FalkorDB and the API (rebuilds the image)
make demo-mcp           # three scripted MCP clients, three gateway processes; the release is held
make web                # then open  http://localhost:5173/?tab=investigate&ws=tinyqueue-mcp
```

`?ws=tinyqueue-mcp` makes every view show the graph the gateway wrote (`pw_mcp_tinyqueue`): the held action with both witnesses, the memory inventory, the time-travel scrubber. The link in the tool error (`/?tab=investigate&ws=...`) opens the workspace: the project page forwards it to `/app/` with the same query. `make demo-mcp` resets that workspace first. With P8 (live LLM mode) the same three roles can be real LLM agents; until then the demo clients are scripted, and the demo says so.

## Limits (stated, not hidden)

- The gateway cannot see the LLM's internal state, so the session context is everything the session loaded or produced (conservative: it can over-taint, never under-taint).
- There is no `sanitize` class in `gateway.yaml`, so artifacts that pass through the gateway are never marked sanitized; only a human approval cuts a secret path.
- The upstream's *content* is compared with the recorded lineage; a value that differs (for example a newer, quarantined version) is refused for a key load and dropped from a prefix list.
- Several gateway processes share one graph: every graph operation takes a file lock under `state/<ws>-mcp/` and re-reads the id counters first.
