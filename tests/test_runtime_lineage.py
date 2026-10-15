"""Runtime lineage behaviour (plan §22-P1). Real FalkorDB; the graph is inspected directly."""

from __future__ import annotations

import hashlib

import pytest

from api.graph.client import NamedGraph
from api.runtime.errors import (
    ArtifactNotFoundError,
    KeyNotFoundError,
    NotFoundError,
    QuarantinedError,
    ToolClassError,
    UnknownAgentError,
    UnknownToolError,
)
from api.runtime.runtime import Runtime

EDGES = "MATCH (a)-[r:DERIVED_FROM|ORIGINATES_FROM]->(b) RETURN a.id, b.id, type(r)"


def edge_set(cypher, graph: NamedGraph) -> set[tuple]:
    return {tuple(row) for row in cypher(graph)(EDGES)}


def derived_from(cypher, graph: NamedGraph, artifact_id: str) -> set[str]:
    rows = cypher(graph)(
        "MATCH (:Artifact {id: $id})-[:DERIVED_FROM]->(b) RETURN b.id", id=artifact_id
    )
    return {r[0] for r in rows}


def quarantine(cypher, graph: NamedGraph, artifact_id: str) -> None:
    cypher(graph)("MATCH (a:Artifact {id: $id}) SET a.quarantined = true", id=artifact_id)


# ----------------------------------------------------------------------------- reads
def test_raw_read_creates_originates_from_with_the_registry_trust(runtime, graph, cypher):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    issue = runtime.read_source(sid, "fetch_issue", "src:issue:42", "issue text")
    secret = runtime.read_source(sid, "read_env", "src:env:PAYMENT_API_KEY", "PWDEMO-x")

    run = cypher(graph)
    rows = run(
        "MATCH (a:Artifact {id: $id})-[:ORIGINATES_FROM]->(s:Source) "
        "RETURN s.id, s.trust, a.kind, a.sanitized, a.quarantined, a.approved",
        id=issue,
    )
    assert rows == [["src:issue:42", "untrusted", "raw", False, False, False]]
    rows = run(
        "MATCH (a:Artifact {id: $id})-[:ORIGINATES_FROM]->(s:Source) RETURN s.trust", id=secret
    )
    assert rows == [["secret"]]
    produced = run("MATCH (:Session {id: $s})-[:PRODUCED]->(a) RETURN a.id", s=sid)
    assert {r[0] for r in produced} == {issue, secret}


def test_agent_session_link_and_session_properties(runtime, graph, cypher):
    sid = runtime.start_session("fixer", "Wed", "issue:44")
    rows = cypher(graph)(
        "MATCH (:Agent {id: 'fixer'})-[:RAN]->(s:Session {id: $id}) "
        "RETURN s.agent_id, s.day_label, s.task_ref, s.started_at",
        id=sid,
    )
    assert rows == [["fixer", "Wed", "issue:44", 1]]


# ----------------------------------------------------------------------------- writes
def test_write_derives_from_exactly_the_session_context(runtime, graph, cypher):
    triage = runtime.start_session("triage", "Mon", "issue:42")
    raw = runtime.read_source(triage, "fetch_issue", "src:issue:42", "text")
    task = runtime.sanitize(triage, raw, {"issue_id": 42}, "task:42")
    memory = runtime.write(triage, "memory_write", "memory", "team_convention:42", "convention")
    second = runtime.write(triage, "memory_write", "memory", "issue_summary:42", "summary")

    assert derived_from(cypher, graph, memory) == {raw, task}
    assert derived_from(cypher, graph, second) == {raw, task, memory}

    # another session never leaks into this one's context
    other = runtime.start_session("fixer", "Mon", "issue:42")
    own = runtime.read_source(other, "read_env", "src:env:PORT", "8080")
    draft = runtime.write(other, "workspace_write", "draft", "changelog:42", "notes")
    assert derived_from(cypher, graph, draft) == {own}


def test_loaded_artifacts_join_the_context(runtime, graph, cypher):
    triage = runtime.start_session("triage", "Mon", "issue:42")
    memory = runtime.write(triage, "memory_write", "memory", "k", "v")
    fixer = runtime.start_session("fixer", "Mon", "issue:42")
    runtime.load(fixer, "memory_read", memory)
    draft = runtime.write(fixer, "workspace_write", "draft", "changelog:42", "notes")
    assert derived_from(cypher, graph, draft) == {memory}


def test_sanitize_derives_from_exactly_one_input(runtime, graph, cypher):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    issue = runtime.read_source(sid, "fetch_issue", "src:issue:42", "text")
    runtime.read_source(sid, "read_env", "src:env:PORT", "8080")  # extra context artifact

    task = runtime.sanitize(sid, issue, {"issue_id": 42, "kind": "bug"}, "task:42")

    assert derived_from(cypher, graph, task) == {issue}
    art = runtime.get_artifact(task)
    assert (art["kind"], art["sanitized"], art["store"], art["key"]) == (
        "sanitized",
        True,
        "team_memory",
        "task:42",
    )
    assert art["content"] == '{"issue_id": 42, "kind": "bug"}'  # sorted keys, deterministic


def test_a_new_session_starts_with_an_empty_context(runtime, graph, cypher):
    first = runtime.start_session("triage", "Mon", "issue:42")
    runtime.read_source(first, "fetch_issue", "src:issue:42", "text")
    second = runtime.start_session("triage", "Tue", "issue:43")

    run = cypher(graph)
    assert run("MATCH (:Session {id: $s})-[:LOADED|PRODUCED]->(c) RETURN c.id", s=second) == []
    first_write = runtime.write(second, "memory_write", "memory", "k", "v")
    assert derived_from(cypher, graph, first_write) == set()


def test_optional_strings_are_empty_not_null_and_hash_is_sha256(runtime, graph, cypher):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    raw = runtime.read_source(sid, "fetch_issue", "src:issue:42", "hello")
    mem = runtime.write(sid, "memory_write", "memory", "k", "hello")

    for artifact_id in (raw, mem):
        key, store, task_ref, digest = cypher(graph)(
            "MATCH (a:Artifact {id: $id}) RETURN a.key, a.store, a.task_ref, a.content_hash",
            id=artifact_id,
        )[0]
        assert isinstance(key, str) and isinstance(store, str) and isinstance(task_ref, str)
        assert digest == hashlib.sha256(b"hello").hexdigest()
    raw_key, raw_store = cypher(graph)(
        "MATCH (a:Artifact {id: $id}) RETURN a.key, a.store", id=raw
    )[0]
    assert (raw_key, raw_store) == ("", "")


# ----------------------------------------------------------------------------- fail closed
def test_loading_a_quarantined_artifact_raises_and_creates_no_edge(runtime, graph, cypher):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    memory = runtime.write(sid, "memory_write", "memory", "k", "v")
    reader = runtime.start_session("fixer", "Mon", "issue:42")
    quarantine(cypher, graph, memory)

    with pytest.raises(QuarantinedError):
        runtime.load(reader, "memory_read", memory)
    with pytest.raises(ArtifactNotFoundError):
        runtime.load(reader, "memory_read", "a-9999")
    assert cypher(graph)("MATCH (:Session {id: $s})-[:LOADED]->() RETURN 1", s=reader) == []


def test_unknown_tool_and_class_mismatch_raise(runtime):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    with pytest.raises(UnknownToolError):
        runtime.read_source(sid, "no_such_tool", "src:issue:42", "x")
    with pytest.raises(ToolClassError):
        runtime.read_source(sid, "memory_write", "src:issue:42", "x")
    with pytest.raises(ToolClassError):
        runtime.write(sid, "fetch_issue", "memory", "k", "v")
    with pytest.raises(ToolClassError):
        runtime.write(sid, "memory_write", "raw", "k", "v")  # only memory/draft/patch
    with pytest.raises(ToolClassError):
        runtime.load(sid, "memory_write", "a-0001")
    with pytest.raises(ToolClassError):
        runtime.propose(sid, "memory_write", "a-0001")


def test_unknown_agent_session_source_and_payload_fail_closed(runtime):
    with pytest.raises(UnknownAgentError):
        runtime.start_session("ghost", "Mon", "issue:42")
    sid = runtime.start_session("triage", "Mon", "issue:42")
    with pytest.raises(ToolClassError):  # prefix does not match the tool
        runtime.read_source(sid, "fetch_issue", "src:env:PORT", "x")
    with pytest.raises(NotFoundError):  # matches the prefix but is not a known source
        runtime.read_source(sid, "fetch_issue", "src:issue:999", "x")
    with pytest.raises(NotFoundError):
        runtime.read_source("s-9999", "fetch_issue", "src:issue:42", "x")
    with pytest.raises(NotFoundError):
        runtime.write("s-9999", "memory_write", "memory", "k", "v")
    with pytest.raises(NotFoundError):
        runtime.propose(sid, "post_release", "a-9999")


def test_failed_operations_do_not_consume_ids(runtime):
    with pytest.raises(UnknownAgentError):
        runtime.start_session("ghost", "Mon", "issue:42")
    assert runtime.start_session("triage", "Mon", "issue:42") == "s-0001"
    sid = "s-0001"
    with pytest.raises(NotFoundError):
        runtime.read_source(sid, "fetch_issue", "src:issue:999", "x")
    assert runtime.read_source(sid, "fetch_issue", "src:issue:42", "x") == "a-0001"


# ----------------------------------------------------------------------------- lookups
def test_load_by_key_returns_the_latest_non_quarantined_version(runtime, graph, cypher):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    v1 = runtime.write(sid, "memory_write", "memory", "k", "one")
    v2 = runtime.write(sid, "memory_write", "memory", "k", "two")
    v3 = runtime.write(sid, "memory_write", "memory", "k", "three")
    reader = runtime.start_session("fixer", "Mon", "issue:42")

    assert runtime.load_by_key(reader, "memory_read", "k") == (v3, "three")
    quarantine(cypher, graph, v3)
    assert runtime.load_by_key(reader, "memory_read", "k") == (v2, "two")
    quarantine(cypher, graph, v2)
    quarantine(cypher, graph, v1)
    with pytest.raises(QuarantinedError):  # exists, but every version is quarantined
        runtime.load_by_key(reader, "memory_read", "k")
    with pytest.raises(KeyNotFoundError):  # never written
        runtime.load_by_key(reader, "memory_read", "never-written")


def test_load_by_key_respects_the_tools_store(runtime):
    sid = runtime.start_session("fixer", "Mon", "issue:42")
    runtime.write(sid, "workspace_write", "draft", "changelog:42", "notes")
    reader = runtime.start_session("release", "Mon", "issue:42")
    with pytest.raises(KeyNotFoundError):  # memory_read looks in team_memory only
        runtime.load_by_key(reader, "memory_read", "changelog:42")
    assert runtime.load_by_key(reader, "workspace_read", "changelog:42")[1] == "notes"


def test_load_by_prefix_skips_quarantined_and_keeps_one_version_per_key(runtime, graph, cypher):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    runtime.write(sid, "memory_write", "memory", "team_convention:1", "c1-old")
    c1 = runtime.write(sid, "memory_write", "memory", "team_convention:1", "c1-new")
    c2 = runtime.write(sid, "memory_write", "memory", "team_convention:2", "c2")
    c3 = runtime.write(sid, "memory_write", "memory", "team_convention:3", "c3")
    runtime.write(sid, "memory_write", "memory", "issue_summary:1", "other prefix")
    quarantine(cypher, graph, c2)

    reader = runtime.start_session("fixer", "Mon", "issue:42")
    result = runtime.load_by_prefix(reader, "memory_read", "team_convention:")
    assert result == [(c1, "c1-new"), (c3, "c3")]  # created_at order, c2 skipped, one per key
    assert runtime.load_by_prefix(reader, "memory_read", "no-such-prefix:") == []


# ----------------------------------------------------------------------------- id and clock state
def test_a_reopened_runtime_continues_ids_and_clock_without_collisions(
    runtime, graph, registry, cypher
):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    runtime.write(sid, "memory_write", "memory", "k", "v")
    max_ts_before = cypher(graph)("MATCH (n) RETURN max(coalesce(n.created_at, n.started_at))")[0][
        0
    ]

    reopened = Runtime(graph, registry)
    assert reopened.start_session("fixer", "Mon", "issue:42") == "s-0002"
    assert reopened.write("s-0002", "memory_write", "memory", "k2", "v2") == "a-0002"

    ids = [r[0] for r in cypher(graph)("MATCH (n) WHERE n.id STARTS WITH 'a-' RETURN n.id")]
    assert sorted(ids) == ["a-0001", "a-0002"]
    new_ts = cypher(graph)("MATCH (a:Artifact {id: 'a-0002'}) RETURN a.created_at")[0][0]
    assert new_ts > max_ts_before


def test_a_sandbox_runtime_creates_only_namespaced_ids(db, runtime, graph, registry, cypher):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    runtime.write(sid, "memory_write", "memory", "k", "v")  # main: s-0001, a-0001

    sandbox_name = graph.name + "__sbx"
    try:
        graph_copy = db.select_graph(graph.name).copy(sandbox_name)
        assert graph_copy is not None
        sandbox = Runtime(NamedGraph(db, sandbox_name), registry, namespace="sbx")
        s = sandbox.start_session("fixer", "Mon", "issue:42")
        a = sandbox.write(s, "workspace_write", "draft", "changelog:42", "clean")
        assert (s, a) == ("s-sbx-0001", "a-sbx-0001")

        # reopened sandbox continues in its own namespace
        again = Runtime(NamedGraph(db, sandbox_name), registry, namespace="sbx")
        assert again.start_session("release", "Mon", "issue:42") == "s-sbx-0002"

        # a main-namespace runtime opened on the copy ignores the sbx ids when counting
        main_on_copy = Runtime(NamedGraph(db, sandbox_name), registry)
        assert main_on_copy.start_session("fixer", "Tue", "issue:43") == "s-0002"

        # the original main graph never saw any sbx id
        assert cypher(graph)("MATCH (n) WHERE n.id CONTAINS '-sbx-' RETURN n.id") == []
    finally:
        try:
            db.select_graph(sandbox_name).delete()
        except Exception:  # noqa: BLE001
            pass


# ----------------------------------------------------------------------------- actions
def test_propose_does_not_execute_and_approve_records_the_declassification(runtime, graph, cypher):
    sid = runtime.start_session("fixer", "Mon", "issue:42")
    draft = runtime.write(sid, "workspace_write", "draft", "changelog:42", "notes")
    release = runtime.start_session("release", "Mon", "issue:42")
    runtime.load(release, "workspace_read", draft)
    action = runtime.propose(release, "post_release", draft)

    run = cypher(graph)
    assert run(
        "MATCH (s:Session {id: $s})-[:PROPOSED]->(x:Action)-[:PAYLOAD]->(p:Artifact), "
        "(x)-[:TARGETS]->(k:Sink) RETURN x.id, x.status, x.tool, p.id, k.id, k.external",
        s=release,
    ) == [[action, "proposed", "post_release", draft, "sink:public_release_page", True]]

    runtime.approve(action, "maintainer")
    assert run("MATCH (a:Artifact {id: $id}) RETURN a.approved", id=draft) == [[True]]
    assert run(
        "MATCH (ap:Approval)-[:APPROVES]->(a:Artifact {id: $id}) RETURN ap.id, ap.by, ap.scope",
        id=draft,
    ) == [["apr-0001", "maintainer", "release"]]

    with pytest.raises(NotFoundError):
        runtime.approve("act-9999", "maintainer")
    with pytest.raises(ArtifactNotFoundError):
        runtime.approve_artifact("a-9999", "maintainer")


def test_action_status_and_supersede_helpers(runtime, graph, cypher):
    sid = runtime.start_session("release", "Mon", "issue:42")
    draft = runtime.write(sid, "workspace_write", "draft", "changelog:42", "notes")
    old = runtime.propose(sid, "post_release", draft)
    new = runtime.propose(sid, "post_internal", draft)

    runtime.set_action_status(old, "held", "TRIFECTA")
    runtime.supersede(old, new)

    rows = cypher(graph)("MATCH (x:Action {id: $id}) RETURN x.status, x.verdict_reason", id=old)
    assert rows == [["superseded", "TRIFECTA"]]
    assert cypher(graph)("MATCH (:Action {id: $o})-[:SUPERSEDED_BY]->(n) RETURN n.id", o=old) == [
        [new]
    ]
    with pytest.raises(NotFoundError):
        runtime.set_action_status("act-9999", "held")


def test_the_event_log_records_each_call_with_real_ids(runtime):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    raw = runtime.read_source(sid, "fetch_issue", "src:issue:42", "text")
    runtime.write(sid, "memory_write", "memory", "k", "v")
    ops = [(e["op"], e.get("sid") or e.get("ref")) for e in runtime.events.events]
    assert ops == [("start_session", sid), ("read_source", sid), ("write", sid)]
    assert runtime.events.events[1]["ref"] == raw
