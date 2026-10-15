"""Forensic Agent, quarantine, sandbox replay, healing and memory API (plan §13, §22-P4)."""

from __future__ import annotations

import pytest

from api.forensics.tools import ForensicTools

BASE = "/api/ws/tinyqueue"
SECRET = "PWDEMO-SECRET-7f3a9c21-NOT-A-REAL-KEY"


def run(client, name, guard=True, **extra):
    response = client.post(f"{BASE}/scenarios/{name}/run", json={"guard": guard, **extra})
    assert response.status_code == 200, response.text
    return response.json()


def held(client, scenario="attack_pipeline_42") -> str:
    return run(client, scenario)["actions"][-1]["id"]


def forensics(client, action_id, **body):
    response = client.post(f"{BASE}/forensics/{action_id}", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def memory(client) -> dict[str, dict]:
    return {m["key"]: m for m in client.get(f"{BASE}/memory").json()}


def contains_key(value, key: str) -> bool:
    if isinstance(value, dict):
        return key in value or any(contains_key(v, key) for v in value.values())
    if isinstance(value, list):
        return any(contains_key(v, key) for v in value)
    return False


# ----------------------------------------------------------------------------- the report
def test_the_report_for_the_pipeline_attack_names_the_poisoned_memory_and_a_clean_sandbox_run(
    client,
):
    action = held(client)

    report = forensics(client, action)

    assert report["action_id"] == action and report["untrusted_source"] == "src:issue:42"
    assert [m["memory_key"] for m in report["laundering_memories"]] == [
        "issue_summary:42",
        "team_convention:42",
    ]
    convention = report["laundering_memories"][1]
    assert (convention["written_by"], convention["written_on"]) == ("triage", "Mon")
    assert report["quarantine_id"] == "q-0001" and report["affected_actions"] == [action]
    assert report["sandbox"]["verdict"] == "ALLOW" and report["sandbox"]["reason"] == "CLEAN"
    assert report["sandbox"]["new_action_id"].startswith("act-sbx-")
    assert report["recommendation"] == "APPROVE_HEALED_RELEASE"
    assert (report["mode"], report["fallback_used"], report["llm_calls"]) == ("scripted", False, 0)
    assert report["diff"]["held_graph"] == "main" and report["diff"]["healed_graph"] == "sandbox"


def test_quarantine_reaches_everything_derived_from_the_issue_but_keeps_the_sanitized_task(client):
    action = held(client)
    before = memory(client)
    assert before["team_convention:42"]["untrusted_origins"] == ["src:issue:42"]
    assert before["task:42"]["untrusted_origins"] == [] and not before["task:42"]["quarantined"]

    forensics(client, action)

    after = memory(client)
    assert after["team_convention:42"]["quarantined"] and after["issue_summary:42"]["quarantined"]
    assert after["task:42"]["quarantined"] is False  # the sanitizer's output stays usable


def test_the_sleeper_report_traces_the_leak_back_to_issue_42(client):
    action = held(client, "attack_sleeper_44")

    report = forensics(client, action)

    assert report["untrusted_source"] == "src:issue:42"
    convention = next(
        m for m in report["laundering_memories"] if m["memory_key"] == "team_convention:42"
    )
    assert (convention["written_on"], convention["written_by"]) == ("Mon", "triage")
    assert report["sandbox"]["verdict"] == "ALLOW"
    assert report["recommendation"] == "APPROVE_HEALED_RELEASE"


def test_the_disguised_attack_is_traced_and_healed_too(client):
    report = forensics(client, held(client, "attack_disguise_45"))
    assert report["untrusted_source"] == "src:issue:45"
    assert report["sandbox"]["verdict"] == "ALLOW"


# ----------------------------------------------------------------------------- sandbox
def test_the_healed_payload_is_clean_and_lives_only_in_the_sandbox_namespace(client):
    report = forensics(client, held(client))
    healed = report["diff"]["healed_payload_id"]
    held_payload = report["diff"]["held_payload_id"]

    assert "-sbx-" in healed and "-sbx-" not in held_payload
    sandbox = client.get(f"{BASE}/artifacts/{healed}?graph=sandbox").json()
    assert "PWDEMO-" not in sandbox["content"] and "Checksum" not in sandbox["content"]
    assert "Fixed:" in sandbox["content"]
    leaked = client.get(f"{BASE}/artifacts/{held_payload}?graph=main").json()
    assert SECRET in leaked["content"]  # the held draft is the leaking one
    # no fallback between graphs: the main graph does not know the sandbox artifact
    assert client.get(f"{BASE}/artifacts/{healed}?graph=main").status_code == 404
    # the sandbox is a COPY of main taken at replay time, so it also holds the held payload
    copy = client.get(f"{BASE}/artifacts/{held_payload}?graph=sandbox").json()
    assert copy["content"] == leaked["content"]


def test_the_sandbox_replay_posts_nothing_and_changes_nothing_in_main_except_the_quarantine(
    client, manager, cypher
):
    action = held(client)
    workspace = manager.get("tinyqueue")
    counts = "MATCH (n) WHERE NOT n:Quarantine RETURN labels(n)[0], count(n) ORDER BY labels(n)[0]"
    before = cypher(workspace.graph)(counts)

    forensics(client, action)

    assert cypher(workspace.graph)(counts) == before  # sessions, artifacts, actions untouched
    assert workspace.sinks.posted("sink:public_release_page") == []
    assert cypher(workspace.graph)("MATCH (q:Quarantine) RETURN count(q)") == [[1]]


def test_forensics_is_idempotent_and_never_creates_a_second_quarantine(client, manager, cypher):
    action = held(client)

    first = forensics(client, action)
    second = forensics(client, action)

    assert second["untrusted_source"] == first["untrusted_source"]
    assert second["quarantined_artifacts"] == first["quarantined_artifacts"]
    assert second["quarantine_id"] is None  # nothing new had to be quarantined
    assert second["sandbox"]["verdict"] == "ALLOW"
    graph = manager.get("tinyqueue").graph
    assert cypher(graph)("MATCH (q:Quarantine) RETURN count(q)") == [[1]]


def test_forensics_on_a_clean_executed_action_escalates_without_quarantining(
    client, manager, cypher
):
    action = run(client, "benign_43")["actions"][-1]["id"]

    report = forensics(client, action)

    assert report["recommendation"] == "ESCALATE_TO_HUMAN" and report["untrusted_source"] == ""
    assert report["quarantine_id"] is None and report["sandbox"] is None
    assert cypher(manager.get("tinyqueue").graph)("MATCH (q:Quarantine) RETURN count(q)") == [[0]]


# ----------------------------------------------------------------------------- healing
def test_heal_approval_releases_a_clean_version_and_supersedes_the_held_action(
    client, manager, cypher
):
    action = held(client)
    forensics(client, action)

    healed = client.post(f"{BASE}/heal/{action}/approve", json={"approver": "maintainer"})

    assert healed.status_code == 200
    body = healed.json()
    new = body["actions"][0]
    assert (new["status"], new["reason"]) == ("executed", "CLEAN") and body["superseded"] is True
    assert body["actions"][1] == {
        "id": action,
        "status": "superseded",
        "reason": f"SUPERSEDED_BY {new['id']}",
    }
    posted = manager.get("tinyqueue").sinks.posted("sink:public_release_page")
    assert len(posted) == 1 and "PWDEMO-" not in posted[0]["content"]
    assert cypher(manager.get("tinyqueue").graph)(
        "MATCH (:Action {id: $o})-[:SUPERSEDED_BY]->(n) RETURN n.id", o=action
    ) == [[new["id"]]]
    assert all(s["rule_of_two"]["green"] for s in body["sessions"])


def test_after_healing_new_main_ids_continue_and_never_collide_with_the_sandbox(
    client, manager, cypher, db
):
    action = held(client)
    forensics(client, action)
    workspace = manager.get("tinyqueue")
    before = {r[0] for r in cypher(workspace.graph)("MATCH (n) WHERE n.id IS NOT NULL RETURN n.id")}

    client.post(f"{BASE}/heal/{action}/approve", json={})

    after = [r[0] for r in cypher(workspace.graph)("MATCH (n) WHERE n.id IS NOT NULL RETURN n.id")]
    assert len(after) == len(set(after))  # all ids unique
    new_ids = set(after) - before
    assert new_ids and not any("-sbx-" in i for i in new_ids)
    assert "s-0004" in new_ids and "act-0002" in new_ids  # numbering continued from the graph state
    sandbox_ids = {
        r[0]
        for r in db.select_graph(workspace.sandbox_graph_name)
        .query("MATCH (n) WHERE n.id CONTAINS '-sbx-' RETURN n.id")
        .result_set
    }
    assert sandbox_ids and sandbox_ids.isdisjoint(set(after))


def test_healing_without_forensics_is_not_a_release_the_leak_is_held_again(client, manager):
    action = held(client)

    body = client.post(f"{BASE}/heal/{action}/approve", json={}).json()

    assert body["superseded"] is False
    assert body["actions"][0]["status"] == "held"  # the conventions are still in memory
    assert body["actions"][1]["status"] == "held"  # the original is not superseded
    assert manager.get("tinyqueue").sinks.posted("sink:public_release_page") == []


def test_only_held_or_blocked_actions_can_be_healed(client):
    executed = run(client, "benign_43")["actions"][-1]["id"]
    response = client.post(f"{BASE}/heal/{executed}/approve", json={})
    assert (response.status_code, response.json()["error"]) == (409, "invalid_state")
    assert client.post(f"{BASE}/heal/act-9999/approve", json={}).status_code == 404


# ----------------------------------------------------------------------------- quarantine release
def test_releasing_a_quarantine_restores_the_memory_and_the_gate_holds_again(client):
    action = held(client)
    qid = forensics(client, action)["quarantine_id"]
    assert client.get(f"{BASE}/actions/{action}").json()["gate"]["reason"] == "QUARANTINED_LINEAGE"

    released = client.post(f"{BASE}/quarantine/{qid}/release")

    assert released.json() == {"quarantine_id": qid, "released": 5}
    assert not any(m["quarantined"] for m in client.get(f"{BASE}/memory").json())
    assert client.get(f"{BASE}/actions/{action}").json()["gate"]["reason"] == "TRIFECTA"
    assert client.post(f"{BASE}/quarantine/q-9999/release").status_code == 404


def test_the_memory_inventory_names_the_quarantine_to_release_and_forgets_it_afterwards(client):
    action = held(client)
    assert all(m["quarantine_id"] is None for m in client.get(f"{BASE}/memory").json())
    qid = forensics(client, action)["quarantine_id"]

    quarantined = [m for m in client.get(f"{BASE}/memory").json() if m["quarantined"]]

    assert quarantined and {m["quarantine_id"] for m in quarantined} == {qid}
    client.post(f"{BASE}/quarantine/{qid}/release")
    assert all(m["quarantine_id"] is None for m in client.get(f"{BASE}/memory").json())


def test_a_quarantine_id_is_offered_only_for_entries_that_quarantine_covers(client, manager):
    action = held(client)
    qid = forensics(client, action)["quarantine_id"]
    # another remembered quarantine that covers an unrelated artifact must never be offered
    manager.get("tinyqueue")._quarantines["q-9999"] = ["a-9999"]

    quarantined = [m for m in client.get(f"{BASE}/memory").json() if m["quarantined"]]

    assert quarantined and {m["quarantine_id"] for m in quarantined} == {qid}
    # after an API restart the ids are forgotten: the entry stays quarantined, without a release id
    manager.get("tinyqueue")._quarantines.clear()
    forgotten = [m for m in client.get(f"{BASE}/memory").json() if m["quarantined"]]
    assert forgotten and all(m["quarantine_id"] is None for m in forgotten)


# ----------------------------------------------------------------------------- API surface
def test_llm_mode_is_not_available_yet_and_unknown_actions_are_404(client):
    action = held(client)
    llm = client.post(f"{BASE}/forensics/{action}", json={"mode": "llm"})
    assert (llm.status_code, llm.json()["error"]) == (501, "llm_not_configured")
    assert client.post(f"{BASE}/forensics/act-9999", json={}).status_code == 404


def test_the_memory_inventory_reports_writer_day_and_origins(client):
    held(client)

    inventory = memory(client)

    convention = inventory["team_convention:42"]
    assert (convention["written_by"], convention["written_on"], convention["kind"]) == (
        "triage",
        "Mon",
        "memory",
    )
    assert set(inventory) == {"task:42", "issue_summary:42", "team_convention:42"}


# ----------------------------------------------------------------------------- rule 3
def test_no_forensic_tool_output_ever_contains_a_content_key(client, manager):
    action = held(client)
    workspace = manager.get("tinyqueue")
    tools = ForensicTools(
        graph=workspace.graph,
        runtime=workspace.runtime,
        gate=workspace.gate,
        make_sandbox=workspace.make_sandbox,
    )

    outputs = []
    witnesses = tools.get_witnesses(action)
    outputs.append(witnesses)
    outputs.append(tools.trace_memory(action))
    preview = tools.preview_quarantine(witnesses["untrusted_witness"][-1])
    outputs.append(preview)
    outputs.append(tools.apply_quarantine(preview["source_id"], preview["artifact_ids"]))
    replay = tools.sandbox_replay(witnesses["task_ref"], ["fixer", "release"])
    outputs.append(replay)
    outputs.append(tools.gate_in_sandbox(replay["new_action_id"]))
    outputs.append(tools.list_memory_inventory())
    outputs.append(forensics(client, action))

    assert all(outputs)
    assert not any(contains_key(output, "content") for output in outputs)


def test_the_task_of_an_action_is_derived_from_its_payload_key(client, manager):
    action = held(client, "attack_sleeper_44")
    workspace = manager.get("tinyqueue")
    tools = ForensicTools(
        graph=workspace.graph,
        runtime=workspace.runtime,
        gate=workspace.gate,
        make_sandbox=workspace.make_sandbox,
    )
    assert tools.task_ref_of(action) == "issue:44"


@pytest.mark.parametrize("tool", ["sandbox_replay"])
def test_the_sandbox_tool_refuses_unknown_agents_and_malformed_tasks(client, manager, tool):
    from api.runtime.errors import ProvenanceError

    held(client)
    workspace = manager.get("tinyqueue")
    tools = ForensicTools(
        graph=workspace.graph,
        runtime=workspace.runtime,
        gate=workspace.gate,
        make_sandbox=workspace.make_sandbox,
    )
    with pytest.raises(ProvenanceError):
        tools.sandbox_replay("not-a-task", ["fixer", "release"])
    with pytest.raises(ProvenanceError):
        tools.sandbox_replay("issue:42", ["fixer", "wizard"])
    with pytest.raises(ProvenanceError):
        tools.sandbox_replay("issue:42", ["fixer"])  # no release => no action to gate


def test_explain_keeps_both_witness_paths_after_the_quarantine_blocks_the_action(client):
    action = held(client)
    forensics(client, action)

    gate = client.get(f"{BASE}/actions/{action}/explain").json()["gate"]

    assert (gate["verdict"], gate["reason"]) == ("BLOCK", "QUARANTINED_LINEAGE")
    assert gate["untrusted_witness"][-1] == "src:issue:42"  # still drawn on the lineage graph
    assert gate["secret_witness"][-1].startswith("src:env:")
