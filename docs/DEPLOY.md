# Deployment (P12-T4)

**Status: not deployed.** Creating hosting accounts and deploying is a human task. This file is the checked recipe; the local path in the README is the primary, tested one. Plan §23 names the intended hosts (FalkorDB Cloud or Railway, API on Railway or Render, UI on Vercel).

## 0. Before choosing a hosted FalkorDB (A-15)

Pathwarden needs `GRAPH.COPY` (sandbox), `algo.maxFlow` (remediation), multi-type variable-length paths and `ro_query`. Prove the host supports them **before** deploying:

```
PW_FALKORDB_HOST=<host> PW_FALKORDB_PORT=<port> PW_FALKORDB_PASSWORD=<password> make probe
```

`make probe` exits non-zero on any failing check. If `GRAPH.COPY` or `algo.maxFlow` fail, forensics and remediation will break only in production: pick a host where the probe passes, or run the database yourself (the pinned Docker image in `docker-compose.yml` is the one the probe passed on).

## 1. API

The `Dockerfile` builds the API (`uvicorn api.main:create_app --factory`, port 8000). Environment (set in the platform's secret store, never in the repository):

| Variable | Value |
|---|---|
| `PW_AUTH` | `on` (hosted mode: workspace keys required; the API refuses to start without usable keys) |
| `PW_API_KEYS` | `key=workspace,key2=workspace2`, long random keys; the committed `fixtures/api_keys.yaml` holds demo keys and **must not** be used (or set `PW_API_KEYS_FILE` to a file outside the repository) |
| `PW_FALKORDB_HOST`, `PW_FALKORDB_PORT`, `PW_FALKORDB_PASSWORD` | the database from step 0 |
| `PW_STATE_DIR` | a writable folder (event and verdict logs, mock sinks); a persistent volume if the logs matter |

Notes: the evaluation summary (`GET /api/eval/summary`) is read from `eval/results/` next to the code; the image does not contain it, so either mount that folder (as `docker-compose.yml` does) or copy `eval/results/` into the image for the hosted build. Tenants are the workspaces named by the keys: each gets its own graphs and appears when first used; nothing needs seeding, because *Run* rebuilds the tenant's demo graph from the registry (`POST /api/ws/<ws>/scenarios/<name>/run`).

## 2. UI

`cd web && npm run build`, then serve `web/dist` (Vercel or any static host). The API is called through a **relative** `/api` path; with the UI and the API on different origins either put a reverse proxy in front (same origin) or set `VITE_API_BASE` to the API's URL, **and note that the API has no CORS configuration**: a cross-origin deployment needs a CORS layer or a proxy (a stated non-goal, `docs/SECURITY.md`). The key is taken from `?key=<workspace key>` (kept for the tab session) or `VITE_API_KEY`; a build-time key is visible to everyone who can load the UI, so prefer a per-visitor `?key=` link.

## 3. TLS, limits

Terminate TLS in front of the API. There is no rate limiting. The MCP tool server and the gateway are local stdio processes and are not part of the hosted deployment.

## 4. What to rehearse

Open the UI with a demo workspace key, *Run* `attack_pipeline_42` with the guard off (leak) and on (hold), run forensics and approve the healed release, open the Evaluation tab. If hosting misbehaves during judging, the local run (`make setup && make up && make demo`) and the recorded video are the fallbacks.
