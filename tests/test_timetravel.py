"""Time travel (plan §14, §22-P7): the lineage graph at logical time t, with two taint markers."""

from __future__ import annotations

from tests.conftest import unknown_workspace_error

BASE = "/api/ws/tinyqueue"


def run(client, name, **extra):
    response = client.post(f"{BASE}/scenarios/{name}/run", json={"guard": True, **extra})
    assert response.status_code == 200, response.text
    return response.json()


def at(client, t: int) -> dict:
    response = client.get(f"{BASE}/graph-at", params={"t": t})
    assert response.status_code == 200, response.text
    return response.json()


def max_t(client) -> int:
    return client.get(f"{BASE}/timeline/max").json()["t"]


def node_by_key(graph: dict, key: str) -> dict:
    return next(n for n in graph["nodes"] if n["key"] == key)


def kinds(graph: dict) -> set[str]:
    return {n["kind"] for n in graph["nodes"] if n["kind"]}


# -------------------------------------------------- timeline
def test_the_timeline_max_is_zero_for_an_empty_workspace_and_the_latest_clock_after_a_run(client):
    assert max_t(client) == 0

    run(client, "attack_pipeline_42")

    latest = max(n["created_at"] for n in at(client, 10**6)["nodes"] if n["created_at"])
    assert max_t(client) >= latest > 0


# -------------------------------------------------- acceptance (plan §22-P7)
def test_at_the_monday_memory_write_the_convention_exists_but_no_draft_yet(client):
    run(client, "attack_sleeper_44")
    final = at(client, max_t(client))
    write_time = node_by_key(final, "team_convention:42")["created_at"]

    early = at(client, write_time)

    assert (
        node_by_key(early, "team_convention:42")["id"]
        == node_by_key(final, "team_convention:42")["id"]
    )
    assert "draft" not in kinds(early)  # the leak has not been written yet
    assert early["actions"] == [] and early["doubly_tainted"] == []
    assert {n["key"] for n in early["nodes"] if n["key"]} <= {
        "task:42",
        "issue_summary:42",
        "team_convention:42",
    }


def test_at_the_final_time_the_doubly_tainted_draft_is_there_and_marked(client):
    run(client, "attack_sleeper_44")

    final = at(client, max_t(client))

    draft = node_by_key(final, "changelog:44")
    assert draft["kind"] == "draft" and draft["id"] in final["doubly_tainted"]
    assert final["markers"]["draft_doubly_tainted"] == {
        "t": draft["created_at"],
        "artifact_id": draft["id"],
        "key": "changelog:44",
    }
    assert [a["status"] for a in final["actions"]] == ["held"]


def test_the_markers_are_derived_from_the_data_not_hard_coded(client):
    run(client, "attack_sleeper_44")
    final = at(client, max_t(client))
    memories = [n for n in final["nodes"] if n["kind"] == "memory"]
    derived = min(
        n["created_at"] for n in memories
    )  # every memory in this run descends from issue 42

    poisoned = final["markers"]["poisoned_memory_written"]
    assert poisoned["t"] == derived and poisoned["key"] in {n["key"] for n in memories}

    just_before = at(client, final["markers"]["draft_doubly_tainted"]["t"] - 1)
    assert just_before["doubly_tainted"] == [] and "draft" not in kinds(just_before)
    at_marker = at(client, final["markers"]["draft_doubly_tainted"]["t"])
    assert at_marker["doubly_tainted"] == [final["markers"]["draft_doubly_tainted"]["artifact_id"]]


# -------------------------------------------------- properties
def test_the_graph_only_grows_with_time_and_only_lists_artifacts_that_already_exist(client):
    run(client, "attack_pipeline_42")
    horizon = max_t(client)
    previous_edges: set[tuple] = set()
    previous_nodes: set[str] = set()

    for t in range(0, horizon + 2):
        graph = at(client, t)
        edges = {(e["src"], e["dst"], e["rel"]) for e in graph["edges"]}
        nodes = {n["id"] for n in graph["nodes"]}
        assert previous_edges <= edges and previous_nodes <= nodes, t  # monotonic
        assert all(n["created_at"] is None or n["created_at"] <= t for n in graph["nodes"]), t
        previous_edges, previous_nodes = edges, nodes

    assert at(client, 0)["nodes"] == [] and at(client, 0)["edges"] == []
    assert (
        at(client, horizon + 1000)["edges"] == at(client, horizon)["edges"]
    )  # t beyond max == max
    assert at(client, horizon + 1000)["t"] == horizon + 1000 and at(client, 5)["max_t"] == horizon


def test_actions_appear_only_once_they_have_been_proposed(client):
    run(client, "attack_pipeline_42")
    final = at(client, max_t(client))
    assert len(final["actions"]) == 1
    proposed_at = max_t(client)  # the propose is the last event of the run
    assert at(client, proposed_at)["actions"] and not at(client, proposed_at - 1)["actions"]


def test_benign_runs_never_produce_a_doubly_tainted_draft_or_marker(client):
    for scenario in ("benign_43", "benign_lookalike", "benign_port_only_42"):
        run(client, scenario)
        final = at(client, max_t(client))
        assert final["doubly_tainted"] == [], scenario
        assert final["markers"]["draft_doubly_tainted"] is None, scenario


def test_a_sanitized_path_alone_does_not_count_as_untrusted_taint(client):
    run(
        client, "benign_port_only_42"
    )  # an untrusted issue is in the graph, but only via the sanitizer
    final = at(client, max_t(client))
    assert node_by_key(final, "task:42")["sanitized"] is True
    assert final["markers"]["draft_doubly_tainted"] is None
    assert (
        final["markers"]["poisoned_memory_written"] is not None
    )  # issue_summary:42 does descend from it


def test_responses_never_contain_artifact_content(client):
    run(client, "attack_pipeline_42")
    final = at(client, max_t(client))

    def has_content(value) -> bool:
        if isinstance(value, dict):
            return "content" in value or any(has_content(v) for v in value.values())
        if isinstance(value, list):
            return any(has_content(v) for v in value)
        return False

    assert not has_content(final)


def test_quarantine_flags_are_the_current_state_not_history(client):
    action = run(client, "attack_pipeline_42")["actions"][-1]["id"]
    early = at(client, 5)
    assert not any(n["quarantined"] for n in early["nodes"])

    client.post(f"{BASE}/forensics/{action}", json={})

    later_view_of_the_past = at(client, 5)
    assert any(n["quarantined"] for n in later_view_of_the_past["nodes"])  # documented limitation


# -------------------------------------------------- errors
def test_invalid_times_are_rejected_in_the_documented_shape(client, settings):
    run(client, "benign_43")
    for params in ({"t": "abc"}, {}):
        response = client.get(f"{BASE}/graph-at", params=params)
        assert (response.status_code, response.json()["error"]) == (422, "validation_error")
    negative = client.get(f"{BASE}/graph-at", params={"t": -1})
    assert (negative.status_code, negative.json()["error"]) == (400, "bad_request")
    unknown = client.get("/api/ws/nope/timeline/max").json()["error"]
    assert unknown == unknown_workspace_error(settings)


# --------------------------------------------------
# rule 7 on the taint markers: sanitized cuts untrusted paths only (sabotage-driven coverage)
def test_a_draft_reaching_untrusted_only_through_the_sanitizer_is_not_doubly_tainted(
    runtime, graph
):
    from api.runtime import timetravel
    from api.runtime.replay import replay
    from tests.test_gate import pipeline

    # a secret IS read, the issue is untrusted, but the issue reaches the draft only via task:42
    replay(runtime, pipeline(convention=False))

    assert timetravel.doubly_tainted_artifacts(graph) == []


def test_a_draft_reaching_a_secret_only_through_a_sanitized_artifact_is_still_doubly_tainted(
    runtime, graph
):
    from api.runtime import timetravel
    from api.runtime.replay import replay
    from tests.test_gate import SECRET

    scenario = {
        "events": [
            {
                "op": "start_session",
                "agent": "triage",
                "day": "Mon",
                "task_ref": "issue:42",
                "sid": "S1",
            },
            {
                "op": "read_source",
                "sid": "S1",
                "tool": "fetch_issue",
                "source_id": "src:issue:42",
                "content": "issue",
                "ref": "R1",
            },
            {
                "op": "write",
                "sid": "S1",
                "tool": "memory_write",
                "kind": "memory",
                "key": "team_convention:42",
                "content": "convention",
                "ref": "R3",
            },
            {
                "op": "start_session",
                "agent": "fixer",
                "day": "Mon",
                "task_ref": "issue:42",
                "sid": "S2",
            },
            {
                "op": "read_source",
                "sid": "S2",
                "tool": "read_env",
                "source_id": "src:env:PAYMENT_API_KEY",
                "content": SECRET,
                "ref": "R4",
            },
            {
                "op": "sanitize",
                "sid": "S2",
                "input": "R4",
                "key": "secret_digest",
                "extracted": {"issue_id": 42},
                "ref": "R6",
            },
            {
                "op": "start_session",
                "agent": "fixer",
                "day": "Mon",
                "task_ref": "issue:42",
                "sid": "S3",
            },
            {"op": "load", "sid": "S3", "tool": "memory_read", "ref_in": "R6"},
            {"op": "load", "sid": "S3", "tool": "memory_read", "ref_in": "R3"},
            {
                "op": "write",
                "sid": "S3",
                "tool": "workspace_write",
                "kind": "draft",
                "key": "changelog:42",
                "content": "notes",
                "ref": "R5",
            },
        ]
    }
    ids = replay(runtime, scenario)

    assert [n["id"] for n in timetravel.doubly_tainted_artifacts(graph)] == [ids["R5"]]
