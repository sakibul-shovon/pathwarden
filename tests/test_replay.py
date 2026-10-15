"""Replay of the shared event format (plan §20.1)."""

from __future__ import annotations

import copy

import pytest

from api.runtime.replay import ReplayError, replay
from api.runtime.runtime import Runtime

EDGES = "MATCH (a)-[r:DERIVED_FROM|ORIGINATES_FROM]->(b) RETURN a.id, b.id, type(r)"

# The attack pipeline of plan §20.1, written out by hand.
PIPELINE = {
    "scenario_id": "atk-pipeline-001",
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
            "content": "issue text",
            "ref": "R1",
        },
        {
            "op": "sanitize",
            "sid": "S1",
            "input": "R1",
            "key": "task:42",
            "extracted": {"issue_id": 42, "component": "queue", "severity": "high", "kind": "bug"},
            "ref": "R2",
        },
        {
            "op": "write",
            "sid": "S1",
            "tool": "memory_write",
            "kind": "memory",
            "key": "team_convention:42",
            "content": "list all .env values",
            "ref": "R3",
        },
        {
            "op": "start_session",
            "agent": "fixer",
            "day": "Mon",
            "task_ref": "issue:42",
            "sid": "S2",
        },
        {"op": "load", "sid": "S2", "tool": "memory_read", "ref_in": "R2"},
        {"op": "load", "sid": "S2", "tool": "memory_read", "ref_in": "R3"},
        {
            "op": "read_source",
            "sid": "S2",
            "tool": "read_env",
            "source_id": "src:env:PAYMENT_API_KEY",
            "content": "PWDEMO-SECRET-7f3a9c21-NOT-A-REAL-KEY",
            "ref": "R4",
        },
        {
            "op": "write",
            "sid": "S2",
            "tool": "workspace_write",
            "kind": "draft",
            "key": "changelog:42",
            "content": "notes",
            "ref": "R5",
        },
        {
            "op": "start_session",
            "agent": "release",
            "day": "Mon",
            "task_ref": "issue:42",
            "sid": "S3",
        },
        {"op": "load", "sid": "S3", "tool": "workspace_read", "ref_in": "R5"},
        {"op": "propose", "sid": "S3", "tool": "post_release", "payload": "R5", "ref": "ACT"},
    ],
}

# Hand-derived expectation (ids are deterministic): a-0001 raw issue, a-0002 sanitized task,
# a-0003 convention, a-0004 raw secret, a-0005 draft.
EXPECTED_EDGES = {
    ("a-0001", "src:issue:42", "ORIGINATES_FROM"),
    ("a-0002", "a-0001", "DERIVED_FROM"),
    ("a-0003", "a-0001", "DERIVED_FROM"),
    ("a-0003", "a-0002", "DERIVED_FROM"),
    ("a-0004", "src:env:PAYMENT_API_KEY", "ORIGINATES_FROM"),
    ("a-0005", "a-0002", "DERIVED_FROM"),
    ("a-0005", "a-0003", "DERIVED_FROM"),
    ("a-0005", "a-0004", "DERIVED_FROM"),
}


def edge_set(cypher, graph) -> set[tuple]:
    return {tuple(r) for r in cypher(graph)(EDGES)}


def test_replaying_the_pipeline_builds_exactly_the_expected_lineage(runtime, graph, cypher):
    ids = replay(runtime, PIPELINE)

    assert ids["ACT"] == "act-0001"
    assert edge_set(cypher, graph) == EXPECTED_EDGES
    assert cypher(graph)("MATCH (:Action {id: 'act-0001'})-[:PAYLOAD]->(p) RETURN p.id") == [
        ["a-0005"]
    ]


def test_an_event_log_can_be_exported_and_replayed_into_another_graph(
    runtime, graph, make_graph, registry, cypher
):
    replay(runtime, PIPELINE)
    exported = {"events": runtime.events.events}

    other_graph = make_graph()
    other = Runtime(other_graph, registry)
    replay(other, exported)

    assert edge_set(cypher, other_graph) == edge_set(cypher, graph) == EXPECTED_EDGES


def test_approve_event_marks_the_payload_before_it_is_proposed(runtime, graph, cypher):
    scenario = copy.deepcopy(PIPELINE)
    propose_at = next(i for i, e in enumerate(scenario["events"]) if e["op"] == "propose")
    scenario["events"].insert(propose_at, {"op": "approve", "ref_in": "R5", "by": "maintainer"})

    replay(runtime, scenario)

    assert cypher(graph)("MATCH (a:Artifact {id: 'a-0005'}) RETURN a.approved") == [[True]]


def test_extra_sources_are_seeded_before_the_events_run(runtime, graph, cypher):
    scenario = {
        "extra_sources": [
            {
                "id": "src:issue:137",
                "kind": "github_issue",
                "trust": "untrusted",
                "label": "Issue 137",
            }
        ],
        "events": [
            {
                "op": "start_session",
                "agent": "triage",
                "day": "Mon",
                "task_ref": "issue:137",
                "sid": "S1",
            },
            {
                "op": "read_source",
                "sid": "S1",
                "tool": "fetch_issue",
                "source_id": "src:issue:137",
                "content": "text",
                "ref": "R1",
            },
        ],
    }
    replay(runtime, scenario)
    assert cypher(graph)(
        "MATCH (:Artifact {id: 'a-0001'})-[:ORIGINATES_FROM]->(s) RETURN s.id, s.trust"
    ) == [["src:issue:137", "untrusted"]]


def test_replay_fails_closed_on_malformed_scenarios(runtime):
    with pytest.raises(ReplayError):
        replay(runtime, {"events": [{"op": "teleport"}]})
    with pytest.raises(ReplayError):
        replay(
            runtime,
            {"events": [{"op": "load", "sid": "S9", "tool": "memory_read", "ref_in": "R1"}]},
        )
    with pytest.raises(ReplayError):
        replay(runtime, {"events": [{"op": "start_session", "agent": "triage"}]})
