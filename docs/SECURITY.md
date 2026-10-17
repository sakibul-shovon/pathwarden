# Security model (P11)

What Pathwarden protects, what it does not, and how the API enforces it. The threat-model notes below are written to be copied into the README (P12).

## Modes

| | `PW_AUTH=off` (default, local) | `PW_AUTH=on` (hosted) |
|---|---|---|
| Workspace routes `/api/ws/{ws}/...` | open | need `Authorization: Bearer <key>`; the key must belong to `{ws}` |
| Human-only routes | need `X-PW-Human: true` | need `X-PW-Human: true` **and** a valid key |
| `/api/health` | `{"falkordb": "ok", "graphs": [...]}` | `{"falkordb": "ok"}` (graph = tenant names are never listed) |
| Startup | no keys needed | refuses to start without usable keys (fail closed) |

Run the whole test suite in both modes: `make test` and `make test-auth` (`PW_AUTH=on`). Every test client sends what the UI sends (`tests/conftest.py::human_headers`).

## Keys (A-12)

* One key belongs to one workspace = one tenant. A tenant has its own graphs: `pw_<ws>`, `pw_<ws>__sbx` (sandbox) and `pw_mcp_<ws>` (the MCP gateway's lineage, served as the workspace `<ws>-mcp`; the key of `<ws>` covers it). No endpoint accepts a raw graph name.
* Missing, malformed or unknown key: **401** `unauthorized`. A key used on another tenant's workspace, or on a workspace that does not exist: the **same 403** `forbidden`, so an answer never reveals which workspaces exist.
* Sources of keys: `PW_API_KEYS="key=workspace,key2=workspace2"` (wins), else the YAML file named by `PW_API_KEYS_FILE`, else the committed `fixtures/api_keys.yaml`. **The committed file holds DEMO keys only** (`pwdemo-key-...`, not a provider format) so `PW_AUTH=on` can be tried locally and in tests. A hosted deployment must not use it: keep its own file outside the repository or use the environment variable. A tenant exists only if a key names it.
* Keys are compared in constant time and never logged or echoed (a test asserts it).

## Human-only endpoints (A-07)

The list is fixed and checked by `tests/test_invariants.py` (a new mutating route that is not classified fails the suite):

| Route | Rule |
|---|---|
| `POST /api/ws/{ws}/actions/{id}/approve`, `/reject` | key for `{ws}` + `X-PW-Human: true` |
| `POST /api/ws/{ws}/heal/{id}/approve` | same |
| `POST /api/ws/{ws}/quarantine/{qid}/release` | same |
| `POST /api/remediation/{topology}/apply`, `/reset` | any valid key (the topology is global demo data) + `X-PW-Human: true` |

Not human-only (workspace key only): `forensics` (it only reduces risk: quarantine and sandbox replay), `reset`, `scenarios/{name}/run` and `scenarios/custom/run` of a workspace (they rebuild the tenant's own demo graph; the last one hands a visitor's text to the live LLM agents), `remediation/.../suggest` (a computation on a temporary copy). Read endpoints of `remediation` and `eval` are global, public demo data.

**`X-PW-Human` is a deliberate-action guard, not authentication.** It is a header any client can set; it stops accidental or scripted calls (a script that "approves" must say so explicitly) and it makes the UI's human actions visible in the code. In hosted mode the real approval authority rests on the workspace key.

## Threat model and non-goals (for the README)

Pathwarden is a deterministic lineage gate. It does **not** claim to stop:

* side channels outside the runtime and the gateway (an agent with a network tool that bypasses both);
* wrong registry labels (a source declared `internal` that is really untrusted is trusted by the gate);
* the LLM's internal state: the MCP gateway sees only what the session loaded or produced, so its context is conservative;
* secret egress with no untrusted influence: that is a warning at most, not a hold;
* real attackers against the demo data: scripted agents *simulate* a compromised agent; the live-LLM study is the evidence for real models.

Out of scope on purpose: user accounts, OAuth, rate limiting, cryptographic memory integrity, CORS (the UI is served through the same origin or a proxy), TLS (terminate it in front of the API). The MCP tool server and the gateway run as local stdio processes with the database credentials of their user; they are not authenticated.

## Other P11 properties

* Content-hash dedupe never merges artifacts with different origins (the runtime does not dedupe at all; a test pins that identical content read from two sources is two artifacts with their own origin).
* Every gate decision is appended to `state/<ws>/verdicts.jsonl` with `action_id, verdict, reason, witnesses, latency_ms, policy_version` (tested).
* Quarantine is reversible and audited (a `Quarantine` node stays after a release).
