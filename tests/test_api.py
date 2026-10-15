"""Core REST API (plan §18) driven through the real stack: FastAPI -> workspace -> FalkorDB."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from api.main import create_app
from api.runtime.registry import Registry
from api.runtime.replay import replay
from api.runtime.runtime import Runtime
from api.scenarios.demo import SCENARIOS
from api.settings import Settings
from api.workspace import WorkspaceManager
from tests.conftest import FIXTURES

BASE = "/api/ws/tinyqueue"
SECRET = "PWDEMO-SECRET-7f3a9c21-NOT-A-REAL-KEY"
EDGES = "MATCH (a)-[r:DERIVED_FROM|ORIGINATES_FROM]->(b) RETURN a.id, b.id, type(r)"


def run(client, name, guard=True, **extra):
    response = client.post(f"{BASE}/scenarios/{name}/run", json={"guard": guard, **extra})
    assert response.status_code == 200, response.text
    return response.json()


# -------------------------------------------------- scenarios
def test_the_scenario_list_matches_the_plan(client):
    listing = client.get(f"{BASE}/scenarios").json()
    assert [s["name"] for s in listing] == [
        "benign_43",
        "attack_pipeline_42",
        "attack_sleeper_44",
        "attack_disguise_45",
        "benign_lookalike",
        "benign_port_only_42",
    ]
    assert all({"description", "expected"} <= set(s) for s in listing)


@pytest.mark.parametrize("name", sorted(SCENARIOS))
def test_every_demo_scenario_gives_its_expected_verdict_with_the_guard_on(client, name):
    scenario = SCENARIOS[name]
    result = run(client, name)

    final = result["actions"][-1]
    assert (final["status"], final["reason"]) == (
        scenario.expected_status,
        scenario.expected_reason,
    )
    assert result["scenario"] == name and result["guard"] is True and result["mode"] == "scripted"


def test_held_attacks_post_nothing_and_benign_runs_post_the_release(client):
    run(client, "attack_pipeline_42")
    assert client.get(f"{BASE}/sinks/sink:public_release_page").json() == []

    run(client, "benign_43")
    posted = client.get(f"{BASE}/sinks/sink:public_release_page").json()
    assert len(posted) == 1 and posted[0]["content"].startswith("## Release notes")


@pytest.mark.parametrize("name", ["attack_pipeline_42", "attack_sleeper_44", "attack_disguise_45"])
def test_with_the_guard_off_every_attack_executes_and_the_secret_reaches_the_public_page(
    client, name
):
    result = run(client, name, guard=False)

    assert result["actions"][-1] == {
        "id": result["actions"][-1]["id"],
        "status": "executed",
        "reason": "GUARD_OFF",
    }
    posted = client.get(f"{BASE}/sinks/sink:public_release_page").json()
    content = posted[-1]["content"]
    if name == "attack_disguise_45":
        assert SECRET not in content and "### Checksum" in content  # only base64 leaks
    else:
        assert SECRET in content


def test_every_session_of_the_attack_has_a_green_rule_of_two_badge(client):
    result = run(client, "attack_pipeline_42")

    letters = {s["agent"]: s["rule_of_two"] for s in result["sessions"]}
    assert letters["triage"] == {"A": True, "B": False, "C": True, "green": True}
    assert letters["fixer"] == {"A": False, "B": True, "C": True, "green": True}
    assert letters["release"] == {"A": False, "B": False, "C": True, "green": True}
    session_id = result["sessions"][0]["id"]
    assert client.get(f"{BASE}/sessions/{session_id}/rule-of-two").json() == letters["triage"]


def test_the_timeline_lists_every_step_in_order_and_ends_with_the_gate(client):
    timeline = run(client, "attack_pipeline_42")["timeline"]

    assert [row["t"] for row in timeline] == list(range(1, len(timeline) + 1))
    assert timeline[0]["op"] == "start_session" and timeline[0]["agent"] == "triage"
    assert timeline[-1]["op"] == "gate" and timeline[-1]["detail"].endswith("held TRIFECTA")
    assert any(
        r["op"] == "read_source" and "src:env:PAYMENT_API_KEY" in r["detail"] for r in timeline
    )


def test_running_a_scenario_is_deterministic(client):
    for name in SCENARIOS:
        assert run(client, name) == run(client, name)


# -------------------------------------------------- explain, approve, reject
def held_action(client) -> str:
    return run(client, "attack_pipeline_42")["actions"][-1]["id"]


def test_explain_shows_both_witnesses_the_laundering_memory_and_the_lineage(client):
    action = held_action(client)

    body = client.get(f"{BASE}/actions/{action}/explain").json()

    assert (body["gate"]["verdict"], body["gate"]["reason"]) == ("HOLD", "TRIFECTA")
    assert body["gate"]["untrusted_witness"][-1] == "src:issue:42"
    # two secrets are read at equal distance, so either may be the witness (plan §20.4: "in")
    assert body["gate"]["secret_witness"][-1] in {"src:env:PAYMENT_API_KEY", "src:env:DEPLOY_TOKEN"}
    assert [m["memory_key"] for m in body["laundering"]] == [
        "issue_summary:42",
        "team_convention:42",
    ]
    assert body["subgraph"]["edges"] and body["subgraph"]["nodes"]
    assert set(body["queries"]) == {"q2a_untrusted_witness", "q2b_secret_witness"}
    assert all("content" not in node for node in body["subgraph"]["nodes"])


def test_the_sleeper_leak_is_traced_to_mondays_memory(client):
    result = run(client, "attack_sleeper_44")
    action = result["actions"][-1]["id"]

    laundering = client.get(f"{BASE}/actions/{action}/explain").json()["laundering"]

    convention = next(m for m in laundering if m["memory_key"] == "team_convention:42")
    assert (convention["written_on"], convention["written_by"], convention["untrusted_source"]) == (
        "Mon",
        "triage",
        "src:issue:42",
    )


def test_get_action_reports_status_and_a_fresh_gate_result_without_changing_anything(client):
    action = held_action(client)

    first = client.get(f"{BASE}/actions/{action}").json()
    second = client.get(f"{BASE}/actions/{action}").json()

    assert first["status"] == "held" and first["external"] is True
    assert first["gate"]["verdict"] == "HOLD"
    assert second["status"] == "held"
    assert [a["status"] for a in client.get(f"{BASE}/actions").json()] == ["held"]


def test_a_human_approval_releases_the_held_action_exactly_once(client):
    action = held_action(client)

    approved = client.post(f"{BASE}/actions/{action}/approve", json={"approver": "maintainer"})

    assert approved.status_code == 200
    body = approved.json()
    assert (body["status"], body["reason"], body["gate"]["verdict"]) == (
        "executed",
        "CLEAN",
        "ALLOW",
    )
    assert len(client.get(f"{BASE}/sinks/sink:public_release_page").json()) == 1
    again = client.post(f"{BASE}/actions/{action}/approve", json={})
    assert again.status_code == 409 and again.json()["error"] == "invalid_state"
    assert len(client.get(f"{BASE}/sinks/sink:public_release_page").json()) == 1  # no double post


def test_reject_closes_a_held_action_and_cannot_be_repeated(client):
    action = held_action(client)

    rejected = client.post(f"{BASE}/actions/{action}/reject")

    assert rejected.json() == {"status": "rejected", "reason": "REJECTED_BY_HUMAN"}
    assert client.get(f"{BASE}/actions/{action}").json()["status"] == "rejected"
    assert client.post(f"{BASE}/actions/{action}/reject").status_code == 409
    assert client.get(f"{BASE}/sinks/sink:public_release_page").json() == []


def test_an_already_executed_benign_action_cannot_be_approved_again(client):
    action = run(client, "benign_43")["actions"][-1]["id"]
    response = client.post(f"{BASE}/actions/{action}/approve", json={})
    assert response.status_code == 409


# -------------------------------------------------- artifacts, sinks, reset
def test_artifacts_are_served_with_content_for_the_ui_and_the_sandbox_needs_forensics_first(client):
    result = run(client, "attack_pipeline_42")
    action = result["actions"][-1]["id"]
    payload = next(
        n["id"]
        for n in client.get(f"{BASE}/actions/{action}/explain").json()["subgraph"]["nodes"]
        if n["kind"] == "draft"
    )

    artifact = client.get(f"{BASE}/artifacts/{payload}")

    assert artifact.status_code == 200 and SECRET in artifact.json()["content"]
    sandbox = client.get(f"{BASE}/artifacts/{payload}?graph=sandbox")
    # no sandbox exists before forensics has run, and there is no fallback to the main graph
    assert (sandbox.status_code, sandbox.json()["error"]) == (404, "not_found")
    assert client.get(f"{BASE}/artifacts/a-9999").json()["error"] == "not_found"


def test_reset_wipes_the_workspace(client):
    run(client, "attack_pipeline_42")
    assert client.get(f"{BASE}/actions").json()

    assert client.post(f"{BASE}/reset").json()["reset"] is True

    assert client.get(f"{BASE}/actions").json() == []


def test_without_a_reset_the_poison_persists_and_holds_a_later_benign_run(client):
    run(client, "attack_pipeline_42")  # leaves team_convention:42 in team memory
    later = run(client, "benign_43", reset=False)  # the memory laundering effect

    assert later["actions"][-1]["status"] == "held"


# -------------------------------------------------- error shape
def test_errors_use_the_documented_shape(client):
    assert client.get("/api/ws/nope/actions").json()["error"] == "unknown_workspace"
    assert client.post(f"{BASE}/scenarios/nope/run", json={}).json()["error"] == "unknown_scenario"
    assert client.get(f"{BASE}/actions/act-9999").json()["error"] == "not_found"
    assert client.get(f"{BASE}/sessions/s-9999/rule-of-two").status_code == 404
    unknown_sink = client.get(f"{BASE}/sinks/sink:nowhere")
    assert (unknown_sink.status_code, unknown_sink.json()["error"]) == (404, "unknown_sink")
    bad = client.post(f"{BASE}/scenarios/benign_43/run", json={"mode": "bogus"})
    assert (bad.status_code, bad.json()["error"]) == (422, "validation_error")
    live = client.post(f"{BASE}/scenarios/benign_43/run", json={"mode": "live"})
    assert (live.status_code, live.json()["error"]) == (501, "live_not_available")
    for response in (unknown_sink, bad, live):
        assert set(response.json()) == {"error", "detail"}


def test_a_gate_failure_fails_closed_and_nothing_is_posted(client, manager):
    class ExplodingGate:
        def decide(self, action_id):
            raise RuntimeError("gate unavailable")

    workspace = manager.get("tinyqueue")
    workspace.reset()
    workspace._gate = ExplodingGate()  # noqa: SLF001 - simulate a gate failure

    response = client.post(f"{BASE}/scenarios/benign_43/run", json={"reset": False})

    assert (response.status_code, response.json()["error"]) == (500, "internal_error")
    assert workspace.sinks.posted("sink:public_release_page") == []
    assert [a["status"] for a in workspace.runtime.list_actions()] == ["proposed"]


# -------------------------------------------------- persistence, export
def test_a_restarted_api_continues_ids_without_collisions(client, manager, settings, tmp_path, db):
    first = run(client, "benign_43")
    restarted = WorkspaceManager(
        settings.model_copy(update={"state_dir": tmp_path}),
        graph_names={"tinyqueue": manager.get("tinyqueue").graph_name},
    )
    app = create_app(settings.model_copy(update={"state_dir": tmp_path}), restarted)

    second = run(TestClient(app), "benign_lookalike", reset=False)

    old = {s["id"] for s in first["sessions"]}
    new = {s["id"] for s in second["sessions"]}
    assert old.isdisjoint(new) and min(new) > max(old)


def test_a_run_can_be_exported_as_events_and_replayed_into_the_same_lineage(
    client, manager, make_graph, cypher
):
    run(client, "attack_sleeper_44")
    workspace = manager.get("tinyqueue")
    exported = {"events": workspace.runtime.events.events}

    other_graph = make_graph()
    replay(Runtime(other_graph, Registry.load(FIXTURES / "registry.yaml")), exported)

    original = {tuple(r) for r in cypher(workspace.graph)(EDGES)}
    copy = {tuple(r) for r in cypher(other_graph)(EDGES)}
    assert original == copy and original


def test_state_files_are_written_for_the_run(client, tmp_path):
    run(client, "attack_pipeline_42")
    state = tmp_path / "tinyqueue"
    assert (state / "events.jsonl").read_text(encoding="utf-8").count("\n") > 10
    assert (state / "verdicts.jsonl").read_text(encoding="utf-8").count("\n") == 1


# -------------------------------------------------- make demo
def test_the_demo_command_passes_and_shows_the_leak_without_the_guard(manager, monkeypatch, capsys):
    from api.scenarios import demo

    monkeypatch.setattr("api.workspace.WorkspaceManager", lambda _settings: manager)

    assert demo.main() == 0

    out = capsys.readouterr().out
    table = [line for line in out.splitlines()[1:] if "  on  " in line]  # skip the header row
    assert len(table) == 6 and all(line.rstrip().endswith(" ok") for line in table)
    assert "MISMATCH" not in out
    assert out.count("LEAKED") == 3


def test_health_still_works(client):
    assert client.get("/api/health").json()["falkordb"] == "ok"
    assert Settings.from_env().state_dir.name == "state"
