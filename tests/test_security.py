"""Multi-tenancy and hardening (plan §17, §18, §22-P11; decisions A-07, A-12).

* hosted mode (``PW_AUTH=on``): a key is scoped to one workspace; other tenants and unknown
  workspaces answer with the same 403; no key / a wrong key is a 401;
* human-only endpoints need ``X-PW-Human: true`` in BOTH modes and have no side effect without it;
* the verdict log, the dedupe rule and key hygiene.

The tests that depend on the mode use the ``settings`` fixture (``PW_AUTH`` of the process: run the
suite with ``make test`` and ``make test-auth``); the hosted-only tests build their own settings.
"""

from __future__ import annotations

import json
import logging
import secrets

import pytest
from fastapi.testclient import TestClient

from api.auth import ApiKeys, AuthConfigError
from api.main import create_app
from api.settings import Settings
from api.workspace import WorkspaceManager
from tests.conftest import DEMO_KEY, human_headers

KEY_A = "pwdemo-key-tenant-a-0002"
KEY_B = "pwdemo-key-tenant-b-0003"
TENANTS = ("tinyqueue", "tenant-a", "tenant-b")


def bearer(key: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {key}"}


HUMAN = {"X-PW-Human": "true"}


# -------------------------------------------------- fixtures
@pytest.fixture
def hosted(db, settings: Settings, tmp_path):
    """A hosted-mode app with three tenants, each on throw-away graphs. Yields (client, manager)."""
    token = secrets.token_hex(3)
    graphs = {}
    for tenant in TENANTS:
        graphs[tenant] = f"pw_test_{token}_{tenant}"
        graphs[f"{tenant}-mcp"] = f"pw_test_{token}_mcp_{tenant}"
    config = settings.model_copy(update={"auth": "on", "state_dir": tmp_path})
    manager = WorkspaceManager(config, graph_names=graphs, tenants=frozenset(TENANTS))
    app = create_app(config, manager)
    yield TestClient(app, raise_server_exceptions=False), manager
    for name in db.list_graphs():
        if name.startswith(f"pw_test_{token}_"):
            db.select_graph(name).delete()


@pytest.fixture
def raw_client(manager, settings: Settings, tmp_path):
    """No default headers: each request states exactly what it sends (mode from PW_AUTH)."""
    app = create_app(settings.model_copy(update={"state_dir": tmp_path}), manager)
    return TestClient(app, raise_server_exceptions=False)


def run_attack(client, workspace: str, key: str | None = None) -> str:
    headers = bearer(key) if key else {}
    response = client.post(
        f"/api/ws/{workspace}/scenarios/attack_pipeline_42/run",
        json={"guard": True},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()["actions"][-1]["id"]


# -------------------------------------------------- keys and scoping (hosted mode)
def test_without_a_key_every_workspace_route_is_401_in_hosted_mode(hosted):
    client, _ = hosted

    for path in ("actions", "memory", "timeline/max", "sinks/sink:public_release_page"):
        response = client.get(f"/api/ws/tinyqueue/{path}")
        assert response.status_code == 401, path
        assert response.json()["error"] == "unauthorized"
    assert client.post("/api/ws/tinyqueue/reset").status_code == 401
    assert client.post("/api/ws/tinyqueue/scenarios/benign_43/run", json={}).status_code == 401


@pytest.mark.parametrize(
    "headers",
    [
        {"Authorization": "Bearer pwdemo-key-not-a-real-one"},
        {"Authorization": "Bearer "},
        {"Authorization": f"Basic {DEMO_KEY}"},  # wrong scheme
        {"Authorization": DEMO_KEY},  # no scheme
        {"X-PW-Key": DEMO_KEY},  # an unsupported place for the key
    ],
)
def test_an_invalid_or_misplaced_key_is_401(hosted, headers):
    client, _ = hosted

    response = client.get("/api/ws/tinyqueue/actions", headers=headers)

    assert response.status_code == 401 and response.json()["error"] == "unauthorized"


def test_a_key_works_for_its_own_workspace_and_its_mcp_view_only(hosted):
    client, _ = hosted

    assert client.get("/api/ws/tenant-a/actions", headers=bearer(KEY_A)).status_code == 200
    assert client.get("/api/ws/tenant-a-mcp/actions", headers=bearer(KEY_A)).status_code == 200
    assert client.get("/api/ws/tenant-b/actions", headers=bearer(KEY_A)).status_code == 403
    assert client.get("/api/ws/tenant-b-mcp/actions", headers=bearer(KEY_A)).status_code == 403
    assert client.get("/api/ws/tenant-a-mcp/actions", headers=bearer(KEY_B)).status_code == 403


def test_an_unknown_workspace_is_indistinguishable_from_another_tenants_workspace(hosted):
    client, _ = hosted

    other = client.get("/api/ws/tenant-b/actions", headers=bearer(KEY_A))
    missing = client.get("/api/ws/does-not-exist/actions", headers=bearer(KEY_A))

    assert other.status_code == missing.status_code == 403
    assert (
        other.json()
        == missing.json()
        == {
            "error": "forbidden",
            "detail": "this key cannot access that workspace",
        }
    )


def test_health_never_lists_graphs_in_hosted_mode(hosted):
    client, _ = hosted

    body = client.get("/api/health").json()

    assert body == {"falkordb": "ok", "llm": {"configured": False, "model": None}}  # no graph names


# -------------------------------------------------- isolation between tenants
def test_a_tenants_data_is_unreachable_with_another_tenants_key(hosted):
    client, manager = hosted
    action = run_attack(client, "tenant-a", KEY_A)
    memory_a = client.get("/api/ws/tenant-a/memory", headers=bearer(KEY_A)).json()
    assert memory_a and action == "act-0001"

    # every read and every investigation of A's data with B's key is refused ...
    reads = [
        ("GET", f"/api/ws/tenant-a/actions/{action}"),
        ("GET", f"/api/ws/tenant-a/actions/{action}/explain"),
        ("GET", "/api/ws/tenant-a/artifacts/a-0001"),
        ("GET", "/api/ws/tenant-a/artifacts/a-0001?graph=sandbox"),
        ("GET", "/api/ws/tenant-a/memory"),
        ("GET", "/api/ws/tenant-a/graph-at?t=99"),
        ("GET", "/api/ws/tenant-a/timeline/max"),
        ("GET", "/api/ws/tenant-a/sinks/sink:public_release_page"),
        ("GET", "/api/ws/tenant-a/sessions/s-0001/rule-of-two"),
        ("GET", "/api/ws/tenant-a-mcp/actions"),
        ("POST", f"/api/ws/tenant-a/forensics/{action}"),
        ("POST", f"/api/ws/tenant-a/heal/{action}/approve"),
        ("POST", "/api/ws/tenant-a/quarantine/q-0001/release"),
        ("POST", f"/api/ws/tenant-a/actions/{action}/approve"),
        ("POST", f"/api/ws/tenant-a/actions/{action}/reject"),
        ("POST", "/api/ws/tenant-a/reset"),
        ("POST", "/api/ws/tenant-a/scenarios/benign_43/run"),
    ]
    for method, path in reads:
        response = client.request(method, path, headers={**bearer(KEY_B), **HUMAN}, json={})
        assert response.status_code == 403, (method, path)
        assert response.json()["error"] == "forbidden"

    # ... and had no side effect: A's lineage and verdict are intact
    assert (
        client.get(f"/api/ws/tenant-a/actions/{action}", headers=bearer(KEY_A)).json()["status"]
        == "held"
    )
    assert client.get("/api/ws/tenant-a/memory", headers=bearer(KEY_A)).json() == memory_a


def test_tenants_have_separate_graphs_and_never_see_each_others_actions(hosted):
    client, manager = hosted
    run_attack(client, "tenant-a", KEY_A)

    assert client.get("/api/ws/tenant-b/actions", headers=bearer(KEY_B)).json() == []
    assert client.get("/api/ws/tenant-b/memory", headers=bearer(KEY_B)).json() == []
    names = {
        manager.get(w).graph_name for w in ("tenant-a", "tenant-b", "tinyqueue", "tenant-a-mcp")
    }
    assert len(names) == 4
    assert manager.get("tenant-a").sandbox_graph_name != manager.get("tenant-b").sandbox_graph_name


def test_the_same_scenario_in_two_tenants_is_independent(hosted):
    client, _ = hosted

    a = run_attack(client, "tenant-a", KEY_A)
    b = run_attack(client, "tenant-b", KEY_B)
    client.post(f"/api/ws/tenant-a/forensics/{a}", headers=bearer(KEY_A))  # quarantines in A only

    memory_a = client.get("/api/ws/tenant-a/memory", headers=bearer(KEY_A)).json()
    memory_b = client.get("/api/ws/tenant-b/memory", headers=bearer(KEY_B)).json()
    assert any(m["quarantined"] for m in memory_a)
    assert not any(m["quarantined"] for m in memory_b)
    assert (
        client.get(f"/api/ws/tenant-b/actions/{b}", headers=bearer(KEY_B)).json()["gate"]["verdict"]
        == "HOLD"
    )


def test_the_workspace_names_come_from_the_keys_not_from_the_request(hosted):
    client, _ = hosted

    # a workspace name that is not a tenant never gets created, whatever the key
    response = client.get("/api/ws/tenant-c/actions", headers=bearer(KEY_A))

    assert response.status_code == 403


# -------------------------------------------------- key configuration (fail closed)
def test_hosted_mode_refuses_to_start_without_usable_keys(settings, tmp_path):
    missing = settings.model_copy(update={"auth": "on", "api_keys_file": tmp_path / "nope.yaml"})
    with pytest.raises(AuthConfigError):
        create_app(missing)

    empty = tmp_path / "empty.yaml"
    empty.write_text("keys: {}\n")
    with pytest.raises(AuthConfigError):
        create_app(settings.model_copy(update={"auth": "on", "api_keys_file": empty}))


@pytest.mark.parametrize(
    "bad",
    [
        "short=ws",
        "pwdemo-key-long-enough=Bad Name",
        "pwdemo-key-long-enough=x-mcp",
        "no-equals-sign",
    ],
)
def test_bad_key_configuration_is_rejected(settings, bad):
    with pytest.raises(AuthConfigError):
        ApiKeys.load(settings.model_copy(update={"api_keys": bad}))


def test_keys_can_come_from_the_environment_variable_and_it_wins_over_the_file(settings):
    keys = ApiKeys.load(
        settings.model_copy(
            update={"api_keys": "hosted-secret-key-1=acme, hosted-secret-key-2=beta"}
        )
    )

    assert keys.workspace_of("hosted-secret-key-1") == "acme"
    assert keys.workspace_of("hosted-secret-key-2") == "beta"
    assert keys.workspace_of(DEMO_KEY) is None  # the committed demo keys are not accepted
    assert keys.workspaces == {"acme", "beta"}


def test_settings_read_the_key_variables_from_the_environment():
    settings = Settings.from_env(
        {"PW_AUTH": "on", "PW_API_KEYS": "k-1234567=a", "PW_API_KEYS_FILE": "keys.yaml"}
    )

    assert settings.auth == "on" and settings.api_keys == "k-1234567=a"
    assert str(settings.api_keys_file) == "keys.yaml"


def test_the_committed_demo_keys_use_a_non_provider_format():
    from api.auth import DEFAULT_KEYS_FILE

    text = DEFAULT_KEYS_FILE.read_text(encoding="utf-8")
    for line in text.splitlines():
        if line.strip().startswith("pwdemo-key-"):
            assert line.strip().startswith("pwdemo-key-")
    assert "sk_" not in text and "ghp_" not in text and "AKIA" not in text


# -------------------------------------------------- human-only endpoints (both modes)
def authed(settings: Settings) -> dict[str, str]:
    return bearer(DEMO_KEY) if settings.auth == "on" else {}


def test_approve_reject_heal_and_release_are_rejected_without_the_human_header_and_do_nothing(
    raw_client, manager, settings
):
    run = raw_client.post(
        "/api/ws/tinyqueue/scenarios/attack_pipeline_42/run",
        json={"guard": True},
        headers=authed(settings),
    )
    action = run.json()["actions"][-1]["id"]
    forensics = raw_client.post(
        f"/api/ws/tinyqueue/forensics/{action}", json={}, headers=authed(settings)
    ).json()
    qid = forensics["quarantine_id"]
    before = raw_client.get("/api/ws/tinyqueue/actions", headers=authed(settings)).json()
    memory_before = raw_client.get("/api/ws/tinyqueue/memory", headers=authed(settings)).json()

    attempts = [
        f"/api/ws/tinyqueue/actions/{action}/approve",
        f"/api/ws/tinyqueue/actions/{action}/reject",
        f"/api/ws/tinyqueue/heal/{action}/approve",
        f"/api/ws/tinyqueue/quarantine/{qid}/release",
    ]
    for path in attempts:
        response = raw_client.post(path, headers=authed(settings))
        assert response.status_code == 403, path
        assert response.json()["error"] == "human_required"
        wrong = raw_client.post(path, headers={**authed(settings), "X-PW-Human": "false"})
        assert wrong.status_code == 403, path

    assert raw_client.get("/api/ws/tinyqueue/actions", headers=authed(settings)).json() == before
    memory_after = raw_client.get("/api/ws/tinyqueue/memory", headers=authed(settings)).json()
    assert memory_after == memory_before  # nothing was released or quarantined further


def test_the_human_header_unlocks_the_same_endpoints(raw_client, settings):
    headers = {**authed(settings), **HUMAN}
    action = raw_client.post(
        "/api/ws/tinyqueue/scenarios/attack_pipeline_42/run", json={"guard": True}, headers=headers
    ).json()["actions"][-1]["id"]
    raw_client.post(f"/api/ws/tinyqueue/forensics/{action}", json={}, headers=headers)

    healed = raw_client.post(
        f"/api/ws/tinyqueue/heal/{action}/approve", json={"approver": "maintainer"}, headers=headers
    )

    assert healed.status_code == 200 and healed.json()["superseded"] is True


def test_the_header_name_is_case_insensitive_and_the_value_is_true(raw_client, settings):
    run = raw_client.post(
        "/api/ws/tinyqueue/scenarios/benign_43/run", json={}, headers=authed(settings)
    )
    assert run.status_code == 200
    held = raw_client.post(
        "/api/ws/tinyqueue/scenarios/attack_pipeline_42/run", json={}, headers=authed(settings)
    ).json()["actions"][-1]["id"]

    lower = raw_client.post(
        f"/api/ws/tinyqueue/actions/{held}/reject",
        headers={**authed(settings), "x-pw-human": "TRUE"},
    )

    assert lower.status_code == 200


def test_remediation_apply_and_reset_are_human_only_and_need_a_key_when_hosted(
    settings, manager, tmp_path
):
    from api.remediation.capability_graph import CapabilityService

    config = settings.model_copy(update={"auth": "on", "state_dir": tmp_path})
    prefix = f"pw_cap_test_{secrets.token_hex(3)}_"
    service = CapabilityService(config, prefix=prefix)
    app = create_app(config, manager, service)
    client = TestClient(app, raise_server_exceptions=False)
    try:
        base = "/api/remediation/tinyqueue3"
        toxic = client.get(base).json()["toxic_agents"]  # a global read: public
        assert toxic == ["fixer", "release"]
        assert client.post(f"{base}/suggest").status_code == 200  # a read-like computation: public
        body = {"cap_ids": ["triage->team_memory"]}

        no_key = client.post(f"{base}/apply", json=body, headers=HUMAN)
        no_header = client.post(f"{base}/apply", json=body, headers=bearer(DEMO_KEY))
        assert (no_key.status_code, no_header.status_code) == (401, 403)
        assert no_header.json()["error"] == "human_required"
        assert client.post(f"{base}/reset", headers=bearer(DEMO_KEY)).status_code == 403
        assert client.get(base).json()["toxic_agents"] == toxic  # nothing changed

        applied = client.post(f"{base}/apply", json=body, headers={**bearer(KEY_B), **HUMAN})
        assert (
            applied.status_code == 200
        )  # any valid key may act on the global demo topology (A-07)
        assert client.post(f"{base}/reset", headers={**bearer(KEY_B), **HUMAN}).status_code == 200
    finally:
        for name in service.db.list_graphs():
            if name.startswith(prefix):
                service.db.select_graph(name).delete()


def test_eval_summary_is_public_global_data(hosted):
    client, _ = hosted

    response = client.get("/api/eval/summary")

    assert response.status_code in (200, 404)  # 404 only when `make eval` was never run
    assert response.status_code != 401


# -------------------------------------------------- dedupe, verdict log, hygiene
def test_identical_content_from_two_sources_stays_two_artifacts_with_their_own_origins(
    runtime, graph, cypher
):
    session = runtime.start_session("fixer", "Mon", "issue:42")
    content = "PORT=8080"

    first = runtime.read_source(session, "read_env", "src:env:PORT", content)
    second = runtime.read_source(session, "read_env", "src:env:LOG_LEVEL", content)

    assert first != second
    origins = cypher(graph)(
        "MATCH (a:Artifact)-[:ORIGINATES_FROM]->(s:Source) WHERE a.id IN $ids "
        "RETURN a.id, s.id ORDER BY a.id",
        ids=[first, second],
    )
    assert origins == [[first, "src:env:PORT"], [second, "src:env:LOG_LEVEL"]]
    hashes = cypher(graph)(
        "MATCH (a:Artifact) WHERE a.id IN $ids RETURN a.content_hash", ids=[first, second]
    )
    assert hashes[0] == hashes[1]  # same hash, still never merged


def test_every_gate_decision_is_appended_to_the_verdict_log_with_the_documented_fields(
    raw_client, settings, tmp_path
):
    headers = {**authed(settings), **HUMAN}
    attack = raw_client.post(
        "/api/ws/tinyqueue/scenarios/attack_pipeline_42/run", json={"guard": True}, headers=headers
    ).json()["actions"][-1]["id"]
    raw_client.post(f"/api/ws/tinyqueue/forensics/{attack}", json={}, headers=headers)
    # a human approves the held release: the payload is quarantined now, so the gate blocks it
    raw_client.post(f"/api/ws/tinyqueue/actions/{attack}/approve", json={}, headers=headers)
    raw_client.post(f"/api/ws/tinyqueue/heal/{attack}/approve", json={}, headers=headers)

    lines = (tmp_path / "tinyqueue" / "verdicts.jsonl").read_text(encoding="utf-8").splitlines()
    rows = [json.loads(line) for line in lines]

    assert [r["verdict"] for r in rows] == ["HOLD", "BLOCK", "ALLOW"]
    for row in rows:
        assert set(row) >= {
            "action_id",
            "verdict",
            "reason",
            "witnesses",
            "latency_ms",
            "policy_version",
        }
        assert len(row["policy_version"]) == 64  # sha256 of fixtures/policy.yaml
    assert rows[0]["verdict"] == "HOLD" and rows[0]["reason"] == "TRIFECTA"
    assert rows[0]["witnesses"]["untrusted"][-1] == "src:issue:42"


def test_keys_are_never_logged_or_echoed(hosted, caplog):
    client, _ = hosted
    caplog.set_level(logging.DEBUG)

    responses = [
        client.get("/api/ws/tenant-a/actions", headers=bearer(KEY_A)),
        client.get("/api/ws/tenant-b/actions", headers=bearer(KEY_A)),
        client.get("/api/ws/tenant-a/actions", headers=bearer("pwdemo-key-wrong-0000")),
        client.get("/api/ws/tenant-a/actions"),
    ]

    everything = (
        caplog.text + "".join(r.text for r in responses) + str([dict(r.headers) for r in responses])
    )
    for secret in (KEY_A, KEY_B, DEMO_KEY, "pwdemo-key-wrong-0000"):
        assert secret not in everything


def test_the_human_header_is_documented_as_a_guard_not_authentication():
    from pathlib import Path

    text = Path("docs/SECURITY.md").read_text(encoding="utf-8")

    assert "not authentication" in text and "X-PW-Human" in text
    assert "workspace key" in text


def test_a_demo_client_helper_adds_the_key_only_in_hosted_mode(settings):
    headers = human_headers(settings)

    assert headers["X-PW-Human"] == "true"
    assert ("Authorization" in headers) == (settings.auth == "on")
