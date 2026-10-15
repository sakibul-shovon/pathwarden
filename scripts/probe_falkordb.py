#!/usr/bin/env python
"""P0 FalkorDB capability probe (plan section 6 PROBE list + section 22 P0).

Runs against a real FalkorDB (default localhost:6379; env PW_FALKORDB_HOST/PORT/PASSWORD).
Each check asserts the RETURNED VALUES, not merely "no error". Prints a PASS/FAIL table; exit 1 on any FAIL.

Part A  - every item of the plan's PROBE list, using the plan's exact Cypher where one exists.
Part B  - smoke-run every runtime / gate / forensic / time-travel query of plan section 10 on a small
          attack graph that is built with the runtime's own q1_* queries.
Part C  - smoke-run the remediation queries r1..r7 on a tiny capability graph.

The Cypher below is a VERBATIM copy of plan section 10 (this script is the one allowed exception to
"Cypher only in api/graph/queries/"). If a fallback is adopted, record it in docs/DECISIONS.md Part C.
Test graphs are named pw_probe_* and always deleted.
"""

from __future__ import annotations

import hashlib
import os
import secrets
import sys
from collections.abc import Callable

from falkordb import FalkorDB

# --------------------------------------------------------------------------------------------
# Plan section 10, verbatim
# --------------------------------------------------------------------------------------------
Q: dict[str, str] = {}

Q["q0_max_ts"] = """
MATCH (n)
RETURN max(coalesce(n.created_at, n.started_at, n.ts)) AS max_ts
"""
Q["q0_ids_with_prefix"] = """
MATCH (n)
WHERE n.id STARTS WITH $prefix
RETURN n.id AS id
"""
Q["q1_seed_agents"] = """
UNWIND $rows AS r
CREATE (:Agent {id: r.id, role: r.role})
"""
Q["q1_seed_sources"] = """
UNWIND $rows AS r
CREATE (:Source {id: r.id, kind: r.kind, trust: r.trust, label: r.label})
"""
Q["q1_seed_sinks"] = """
UNWIND $rows AS r
CREATE (:Sink {id: r.id, kind: r.kind, external: r.external})
"""
Q["q1_add_agent"] = """
MERGE (a:Agent {id: $id})
SET a.role = $role
RETURN a.id AS id
"""
Q["q1_add_source"] = """
MERGE (s:Source {id: $id})
SET s.kind = $kind, s.trust = $trust, s.label = $label
RETURN s.id AS id
"""
Q["q1_start_session"] = """
MATCH (ag:Agent {id: $agent_id})
CREATE (s:Session {id: $session_id, agent_id: $agent_id, day_label: $day_label,
                   task_ref: $task_ref, started_at: $ts})
CREATE (ag)-[:RAN]->(s)
RETURN s.id AS id
"""
Q["q1_session_context"] = """
MATCH (s:Session {id: $session_id})-[:LOADED|PRODUCED]->(c:Artifact)
RETURN DISTINCT c.id AS id
"""
Q["q1_read_source"] = """
MATCH (s:Session {id: $session_id}), (src:Source {id: $source_id})
CREATE (a:Artifact {id: $artifact_id, kind: 'raw', key: '', store: '', content: $content,
                    content_hash: $content_hash, session_id: $session_id, agent_id: s.agent_id,
                    created_at: $ts, sanitized: false, approved: false, quarantined: false,
                    task_ref: s.task_ref})
CREATE (a)-[:ORIGINATES_FROM]->(src)
CREATE (s)-[:PRODUCED]->(a)
RETURN a.id AS id
"""
Q["q1_load"] = """
MATCH (s:Session {id: $session_id}), (a:Artifact {id: $artifact_id})
WHERE NOT a.quarantined
CREATE (s)-[:LOADED]->(a)
RETURN a.id AS id, a.content AS content
"""
Q["q1_write"] = """
MATCH (s:Session {id: $session_id})
CREATE (a:Artifact {id: $artifact_id, kind: $kind, key: $key, store: $store, content: $content,
                    content_hash: $content_hash, session_id: $session_id, agent_id: s.agent_id,
                    created_at: $ts, sanitized: false, approved: false, quarantined: false,
                    task_ref: $task_ref})
CREATE (s)-[:PRODUCED]->(a)
WITH a
UNWIND $context_ids AS cid
MATCH (c:Artifact {id: cid})
CREATE (a)-[:DERIVED_FROM]->(c)
RETURN count(c) AS derived_edges
"""
Q["q1_sanitize"] = """
MATCH (s:Session {id: $session_id}), (inp:Artifact {id: $input_id})
CREATE (a:Artifact {id: $artifact_id, kind: 'sanitized', key: $key, store: 'team_memory',
                    content: $content, content_hash: $content_hash, session_id: $session_id,
                    agent_id: s.agent_id, created_at: $ts, sanitized: true, approved: false,
                    quarantined: false, task_ref: s.task_ref})
CREATE (a)-[:DERIVED_FROM]->(inp)
CREATE (s)-[:PRODUCED]->(a)
RETURN a.id AS id
"""
Q["q1_propose"] = """
MATCH (s:Session {id: $session_id}), (p:Artifact {id: $payload_id}), (k:Sink {id: $sink_id})
CREATE (x:Action {id: $action_id, tool: $tool, status: 'proposed', verdict_reason: '',
                  created_at: $ts, task_ref: s.task_ref})
CREATE (s)-[:PROPOSED]->(x)
CREATE (x)-[:PAYLOAD]->(p)
CREATE (x)-[:TARGETS]->(k)
RETURN x.id AS id
"""
Q["q1_approve_artifact"] = """
MATCH (p:Artifact {id: $artifact_id})
CREATE (ap:Approval {id: $approval_id, by: $by, ts: $ts, scope: 'release'})
CREATE (ap)-[:APPROVES]->(p)
SET p.approved = true
RETURN p.id AS id
"""
Q["q1_set_action_status"] = """
MATCH (x:Action {id: $action_id})
SET x.status = $status, x.verdict_reason = $reason
RETURN x.id AS id
"""
Q["q1_supersede"] = """
MATCH (prev:Action {id: $old_id}), (nxt:Action {id: $new_id})
SET prev.status = 'superseded'
CREATE (prev)-[:SUPERSEDED_BY]->(nxt)
RETURN prev.id AS id
"""
Q["q1_lookup_key"] = """
MATCH (a:Artifact {store: $store, key: $key})
WHERE NOT a.quarantined
RETURN a.id AS id, a.created_at AS created_at
ORDER BY created_at DESC
LIMIT 1
"""
Q["q1_key_exists"] = """
MATCH (a:Artifact {store: $store, key: $key})
RETURN count(a) AS n
"""
Q["q1_lookup_prefix"] = """
MATCH (a:Artifact {store: $store})
WHERE a.key STARTS WITH $prefix AND NOT a.quarantined
RETURN a.id AS id, a.key AS key, a.created_at AS created_at
ORDER BY created_at ASC
"""
Q["q1_get_artifact"] = """
MATCH (a:Artifact {id: $artifact_id})
RETURN a.id AS id, a.kind AS kind, a.key AS key, a.store AS store, a.content AS content,
       a.agent_id AS agent_id, a.session_id AS session_id, a.created_at AS created_at,
       a.sanitized AS sanitized, a.approved AS approved, a.quarantined AS quarantined
"""
Q["q2a"] = """
MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
MATCH tp = (p)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(u:Source {trust: 'untrusted'})
WHERE none(n IN nodes(tp) WHERE coalesce(n.sanitized, false) OR coalesce(n.approved, false))
RETURN [n IN nodes(tp) | n.id] AS witness, length(tp) AS hops
ORDER BY hops ASC
LIMIT 1
"""
Q["q2b"] = """
MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
MATCH sp = (p)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(s:Source {trust: 'secret'})
WHERE none(n IN nodes(sp) WHERE coalesce(n.approved, false))
RETURN [n IN nodes(sp) | n.id] AS witness, length(sp) AS hops
ORDER BY hops ASC
LIMIT 1
"""
Q["q2c"] = """
MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
OPTIONAL MATCH qp = (p)-[:DERIVED_FROM*1..16]->(q:Artifact)
WHERE coalesce(q.quarantined, false)
RETURN coalesce(p.quarantined, false) AS payload_quarantined,
       collect(DISTINCT q.id) AS quarantined_ancestors
"""
Q["q2d"] = """
MATCH (a:Action {id: $action_id})
OPTIONAL MATCH (a)-[:PAYLOAD]->(p:Artifact)
OPTIONAL MATCH (a)-[:TARGETS]->(k:Sink)
RETURN a.id AS action_id, p.id AS payload_id, k.id AS sink_id, k.external AS external
"""
Q["q3"] = """
MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
MATCH mp = (p)-[:DERIVED_FROM*1..16]->(m:Artifact {kind: 'memory'})
MATCH up = (m)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(u:Source {trust: 'untrusted'})
WHERE none(n IN nodes(up) WHERE coalesce(n.sanitized, false) OR coalesce(n.approved, false))
MATCH (s:Session)-[:PRODUCED]->(m)
RETURN DISTINCT m.id AS memory_id, m.key AS memory_key, s.id AS written_in_session,
       s.agent_id AS written_by, s.day_label AS written_on, u.id AS untrusted_source
"""
Q["q4"] = """
MATCH (src:Source {id: $source_id})<-[:ORIGINATES_FROM]-(root:Artifact)
OPTIONAL MATCH dp = (d:Artifact)-[:DERIVED_FROM*1..20]->(root)
WHERE dp IS NULL OR none(n IN nodes(dp) WHERE coalesce(n.sanitized, false))
RETURN collect(DISTINCT root.id) AS roots, collect(DISTINCT d.id) AS descendants
"""
Q["q4b"] = """
UNWIND $artifact_ids AS aid
MATCH (x:Action)-[:PAYLOAD]->(:Artifact {id: aid})
RETURN DISTINCT x.id AS action_id, x.status AS status
"""
Q["q4c"] = """
CREATE (q:Quarantine {id: $qid, source_id: $source_id, ts: $ts, by: $by, artifact_count: size($artifact_ids)})
WITH q
UNWIND $artifact_ids AS aid
MATCH (x:Artifact {id: aid})
SET x.quarantined = true
CREATE (q)-[:COVERS]->(x)
RETURN count(x) AS quarantined_count
"""
Q["q4d"] = """
MATCH (q:Quarantine {id: $qid})-[:COVERS]->(x:Artifact)
SET x.quarantined = false
RETURN count(x) AS released_count
"""
Q["q5"] = """
MATCH (s:Session {id: $session_id})
OPTIONAL MATCH (s)-[:PRODUCED|LOADED]->(:Artifact {kind: 'raw'})-[:ORIGINATES_FROM]->(src:Source)
WITH s, collect(DISTINCT src.trust) AS trusts
OPTIONAL MATCH (s)-[:PROPOSED]->(:Action)-[:TARGETS]->(k:Sink)
WITH s, trusts, collect(DISTINCT k.external) AS sink_external
OPTIONAL MATCH (s)-[:PRODUCED]->(w:Artifact)
WHERE w.kind IN ['memory', 'draft', 'patch']
RETURN trusts, sink_external, count(w) AS state_writes
"""
Q["q6"] = """
MATCH (a:Action {id: $action_id})-[:PAYLOAD]->(p:Artifact)
MATCH path = (p)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(x)
UNWIND relationships(path) AS r
WITH DISTINCT r
RETURN startNode(r).id AS src, endNode(r).id AS dst, type(r) AS rel
"""
Q["q6b"] = """
UNWIND $ids AS nid
MATCH (n {id: nid})
RETURN n.id AS id, labels(n)[0] AS label, n.kind AS kind, n.trust AS trust,
       n.sanitized AS sanitized, n.approved AS approved, n.quarantined AS quarantined,
       n.agent_id AS agent_id, n.session_id AS session_id, n.key AS key, n.created_at AS created_at
"""
Q["q7"] = """
MATCH (a:Artifact)-[r:DERIVED_FROM|ORIGINATES_FROM]->(b)
WHERE a.created_at <= $t
RETURN a.id AS src, b.id AS dst, type(r) AS rel
"""
Q["q7b"] = """
MATCH (x:Action)-[:PAYLOAD]->(p:Artifact)
WHERE x.created_at <= $t
RETURN x.id AS action_id, x.status AS status, p.id AS payload_id
"""
Q["q8"] = """
MATCH (s:Session)-[:PRODUCED]->(m:Artifact)
WHERE m.store = 'team_memory'
OPTIONAL MATCH up = (m)-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->(u:Source {trust: 'untrusted'})
WHERE none(n IN nodes(up) WHERE coalesce(n.sanitized, false) OR coalesce(n.approved, false))
RETURN m.id AS memory_id, m.key AS key, m.kind AS kind, s.agent_id AS written_by,
       s.day_label AS written_on, coalesce(m.quarantined, false) AS quarantined,
       collect(DISTINCT u.id) AS untrusted_origins
"""
Q["r1"] = """
MATCH (a:CapNode)-[r:CAN_FLOW]->(b:CapNode)
RETURN a.name AS src, b.name AS dst, r.cap_id AS cap_id, r.cost AS cost
"""
Q["r2"] = """
MATCH (s:CapNode) WHERE s.name IN $source_names
WITH collect(s) AS srcs
MATCH (t:CapNode) WHERE t.name IN $target_names
WITH srcs, collect(t) AS tgts
CALL algo.maxFlow({
  sourceNodes: srcs,
  targetNodes: tgts,
  relationshipTypes: ['CAN_FLOW'],
  capacityProperty: 'cost',
  nodeLabels: ['CapNode']
})
YIELD edges, edgeFlows, maxFlow
RETURN maxFlow,
       [i IN range(0, size(edges) - 1) | edges[i].cap_id] AS flow_cap_ids,
       edgeFlows AS flows
"""
# plan section 10 r2 "PROBE fallback": project endpoint names, map to cap_id in Python
Q["r2_fallback"] = """
MATCH (s:CapNode) WHERE s.name IN $source_names
WITH collect(s) AS srcs
MATCH (t:CapNode) WHERE t.name IN $target_names
WITH srcs, collect(t) AS tgts
CALL algo.maxFlow({
  sourceNodes: srcs,
  targetNodes: tgts,
  relationshipTypes: ['CAN_FLOW'],
  capacityProperty: 'cost',
  nodeLabels: ['CapNode']
})
YIELD edges, edgeFlows, maxFlow
RETURN maxFlow,
       [i IN range(0, size(edges) - 1) | startNode(edges[i]).name] AS flow_src,
       [i IN range(0, size(edges) - 1) | endNode(edges[i]).name] AS flow_dst,
       edgeFlows AS flows
"""
Q["r3"] = """
UNWIND $cap_ids AS cid
MATCH (a:CapNode)-[r:CAN_FLOW {cap_id: cid}]->(b:CapNode)
CREATE (a)-[:REVOKED_FLOW {cap_id: r.cap_id, cost: r.cost, description: r.description}]->(b)
DELETE r
RETURN count(*) AS revoked
"""
Q["r4"] = """
MATCH (x:CapNode {kind: 'agent'})
MATCH (:CapNode {kind: 'source', trust: 'untrusted'})-[:CAN_FLOW*1..12]->(x)
WITH DISTINCT x
MATCH (:CapNode {kind: 'source', trust: 'secret'})-[:CAN_FLOW*1..12]->(x)
WITH DISTINCT x
MATCH (x)-[:CAN_FLOW*1..12]->(:CapNode {kind: 'sink', external: true})
RETURN DISTINCT x.name AS toxic_agent
"""
Q["r5"] = """
MATCH (s:CapNode) WHERE s.name IN $source_names
MATCH (s)-[:CAN_FLOW*1..12]->(x:CapNode {kind: 'agent'})
RETURN DISTINCT x.name AS agent
"""
Q["r6"] = """
MATCH (x:CapNode {kind: 'agent'})-[:CAN_FLOW*1..12]->(:CapNode {kind: 'sink', external: true})
RETURN DISTINCT x.name AS agent
"""
Q["r7"] = """
MATCH p1 = (u:CapNode {kind: 'source', trust: 'untrusted'})-[:CAN_FLOW*1..12]->(x:CapNode {name: $agent})
WITH x, p1 ORDER BY length(p1) LIMIT 1
MATCH p2 = (s:CapNode {kind: 'source', trust: 'secret'})-[:CAN_FLOW*1..12]->(x)
WITH x, p1, p2 ORDER BY length(p2) LIMIT 1
MATCH p3 = (x)-[:CAN_FLOW*1..12]->(k:CapNode {kind: 'sink', external: true})
WITH p1, p2, p3 ORDER BY length(p3) LIMIT 1
RETURN [n IN nodes(p1) | n.name] AS from_untrusted,
       [n IN nodes(p2) | n.name] AS from_secret,
       [n IN nodes(p3) | n.name] AS to_external
"""

INDEX_DDL = [
    "CREATE INDEX FOR (a:Artifact) ON (a.id)",
    "CREATE INDEX FOR (s:Source) ON (s.id)",
    "CREATE INDEX FOR (x:Action) ON (x.id)",
    "CREATE INDEX FOR (s:Session) ON (s.id)",
    "CREATE INDEX FOR (k:Sink) ON (k.id)",
    "CREATE INDEX FOR (a:Artifact) ON (a.key)",
    "CREATE INDEX FOR (a:Artifact) ON (a.store)",
]

FAKE_SECRET = "PWDEMO-SECRET-7f3a9c21-NOT-A-REAL-KEY"


# --------------------------------------------------------------------------------------------
# Harness
# --------------------------------------------------------------------------------------------
def eq(actual: object, expected: object, label: str = "") -> None:
    if actual != expected:
        raise AssertionError(
            f"{label + ': ' if label else ''}expected {expected!r}, got {actual!r}"
        )


def same_set(actual: list, expected: list, label: str = "") -> None:
    eq(sorted(actual), sorted(expected), label)


def sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


class Ctx:
    def __init__(self, db: FalkorDB) -> None:
        self.db = db
        self.created: list[str] = []
        self._attack: tuple | None = None
        self._attack_error: Exception | None = None

    def graph(self, tag: str):
        name = f"pw_probe_{tag}_{secrets.token_hex(3)}"
        self.created.append(name)
        return self.db.select_graph(name)

    def cleanup(self) -> None:
        for name in self.created:
            try:
                self.db.select_graph(name).delete()
            except Exception:  # noqa: BLE001
                pass

    def attack(self):
        """Attack graph built with the runtime's own q1_* queries (see build_attack_graph)."""
        if self._attack_error:
            raise AssertionError(f"attack graph fixture failed earlier: {self._attack_error}")
        if self._attack is None:
            try:
                self._attack = build_attack_graph(self)
            except Exception as exc:  # noqa: BLE001
                self._attack_error = exc
                raise
        return self._attack


def rows(g, key: str, params: dict | None = None) -> list:
    return g.query(Q[key], params or {}).result_set


CHECKS: list[tuple[str, str, Callable[[Ctx], str]]] = []


def check(cid: str, title: str):
    def deco(fn: Callable[[Ctx], str]):
        CHECKS.append((cid, title, fn))
        return fn

    return deco


# --------------------------------------------------------------------------------------------
# Attack graph (the plan's pipeline scenario, built via q1_* exactly like the runtime would)
# --------------------------------------------------------------------------------------------
def build_attack_graph(c: Ctx):
    g = c.graph("attack")
    g.query(
        Q["q1_seed_agents"],
        {
            "rows": [
                {"id": "triage", "role": "Reads public issues"},
                {"id": "fixer", "role": "Fixes code"},
                {"id": "release", "role": "Publishes"},
            ]
        },
    )
    g.query(
        Q["q1_seed_sources"],
        {
            "rows": [
                {
                    "id": "src:issue:42",
                    "kind": "github_issue",
                    "trust": "untrusted",
                    "label": "Issue 42",
                },
                {"id": "src:env:PORT", "kind": "env_key", "trust": "internal", "label": "PORT"},
                {
                    "id": "src:env:PAYMENT_API_KEY",
                    "kind": "env_key",
                    "trust": "secret",
                    "label": "key",
                },
            ]
        },
    )
    g.query(
        Q["q1_seed_sinks"],
        {
            "rows": [
                {"id": "sink:public_release_page", "kind": "public_post", "external": True},
                {"id": "sink:internal_changelog", "kind": "internal_post", "external": False},
            ]
        },
    )

    def session(sid: str, agent: str, day: str, ts: int) -> None:
        eq(
            g.query(
                Q["q1_start_session"],
                {
                    "agent_id": agent,
                    "session_id": sid,
                    "day_label": day,
                    "task_ref": "issue:42",
                    "ts": ts,
                },
            ).result_set,
            [[sid]],
            "start_session",
        )

    def ctx_ids(sid: str) -> list[str]:
        return [r[0] for r in g.query(Q["q1_session_context"], {"session_id": sid}).result_set]

    def read_source(sid: str, aid: str, source: str, content: str, ts: int) -> None:
        eq(
            g.query(
                Q["q1_read_source"],
                {
                    "session_id": sid,
                    "source_id": source,
                    "artifact_id": aid,
                    "content": content,
                    "content_hash": sha(content),
                    "ts": ts,
                },
            ).result_set,
            [[aid]],
            "read_source",
        )

    def write(sid: str, aid: str, kind: str, key: str, store: str, content: str, ts: int) -> None:
        context = ctx_ids(sid)
        res = g.query(
            Q["q1_write"],
            {
                "session_id": sid,
                "artifact_id": aid,
                "kind": kind,
                "key": key,
                "store": store,
                "content": content,
                "content_hash": sha(content),
                "ts": ts,
                "task_ref": "issue:42",
                "context_ids": context,
            },
        )
        eq(res.result_set, [[len(context)]], f"write {aid} derived_edges")

    # --- triage (Mon): s-0001 --------------------------------------------------------------
    session("s-0001", "triage", "Mon", 1)
    read_source("s-0001", "a-0001", "src:issue:42", "issue text with hidden instruction", 2)
    eq(
        g.query(
            Q["q1_sanitize"],
            {
                "session_id": "s-0001",
                "input_id": "a-0001",
                "artifact_id": "a-0002",
                "key": "task:42",
                "content": '{"component": "queue"}',
                "content_hash": sha("task"),
                "ts": 3,
            },
        ).result_set,
        [["a-0002"]],
        "sanitize",
    )
    write("s-0001", "a-0003", "memory", "issue_summary:42", "team_memory", "summary", 4)
    write("s-0001", "a-0004", "memory", "team_convention:42", "team_memory", "convention", 5)

    # --- fixer (Mon): s-0002 ---------------------------------------------------------------
    session("s-0002", "fixer", "Mon", 6)
    for aid in ("a-0002", "a-0004"):
        eq(
            g.query(Q["q1_load"], {"session_id": "s-0002", "artifact_id": aid}).result_set[0][0],
            aid,
            "load",
        )
    read_source("s-0002", "a-0005", "src:env:PAYMENT_API_KEY", FAKE_SECRET, 7)
    write(
        "s-0002", "a-0006", "draft", "changelog:42", "workspace", "release notes " + FAKE_SECRET, 8
    )

    # --- release (Mon): s-0003 -------------------------------------------------------------
    session("s-0003", "release", "Mon", 9)
    g.query(Q["q1_load"], {"session_id": "s-0003", "artifact_id": "a-0006"})
    eq(
        g.query(
            Q["q1_propose"],
            {
                "session_id": "s-0003",
                "payload_id": "a-0006",
                "sink_id": "sink:public_release_page",
                "action_id": "act-0001",
                "tool": "post_release",
                "ts": 10,
            },
        ).result_set,
        [["act-0001"]],
        "propose",
    )
    return g


# --------------------------------------------------------------------------------------------
# Part A - plan PROBE list
# --------------------------------------------------------------------------------------------
@check("A01", "connect + parameters")
def a01(c: Ctx) -> str:
    g = c.graph("a01")
    g.query("CREATE (:T {id: $id})", {"id": "x"})
    eq(g.query("MATCH (n {id: $id}) RETURN n.id", {"id": "x"}).result_set, [["x"]])
    return "params dict round-trips"


@check("A02", "ro_query: read works, write is rejected")
def a02(c: Ctx) -> str:
    g = c.graph("a02")
    g.query("CREATE (:T)")
    eq(g.ro_query("MATCH (n) RETURN count(n)").result_set, [[1]])
    try:
        g.ro_query("CREATE (:T)")
    except Exception:  # noqa: BLE001
        return "read ok; write raised as expected"
    raise AssertionError("ro_query accepted a write")


@check("A03", "list graphs + graph delete (method names)")
def a03(c: Ctx) -> str:
    g = c.graph("a03")
    g.query("CREATE (:T)")
    assert g.name in c.db.list_graphs(), "created graph not listed"
    g.delete()
    assert g.name not in c.db.list_graphs(), "graph still listed after delete()"
    return (
        "FalkorDB.list_graphs() and Graph.delete() work "
        f"(plan's db.list() exists in this client: {hasattr(c.db, 'list')})"
    )


@check("A04", "Graph.copy: destination must not exist")
def a04(c: Ctx) -> str:
    src = c.graph("a04")
    src.query("CREATE (:N {id: 1})")
    dest = src.name + "_cp"
    c.created.append(dest)
    src.copy(dest)
    eq(c.db.select_graph(dest).query("MATCH (n:N) RETURN n.id").result_set, [[1]], "copy content")
    try:
        src.copy(dest)
    except Exception:  # noqa: BLE001
        pass
    else:
        raise AssertionError("copy onto an existing graph did not fail")
    c.db.select_graph(dest).delete()
    src.copy(dest)
    eq(
        c.db.select_graph(dest).query("MATCH (n:N) RETURN n.id").result_set,
        [[1]],
        "copy after delete",
    )
    return "copy ok; refuses an existing destination; works again after delete"


@check("A05", "index DDL (plan 7.5) + lookup still correct")
def a05(c: Ctx) -> str:
    g = c.graph("a05")
    created = sum(g.query(ddl).indices_created for ddl in INDEX_DDL)
    eq(created, 7, "indices_created")
    g.query("CREATE (:Artifact {id: 'a-1', key: 'k', store: 's'})")
    eq(g.query("MATCH (a:Artifact {id: $id}) RETURN a.key", {"id": "a-1"}).result_set, [["k"]])
    listed = g.list_indices().result_set
    return f"7 indices created; list_indices() returned {len(listed)} row(s)"


@check("A06", "multi-type variable-length pattern [:A|B*1..16]")
def a06(c: Ctx) -> str:
    g = c.graph("a06")
    g.query(
        "CREATE (:Artifact {id:'p'})-[:DERIVED_FROM]->(:Artifact {id:'m'})"
        "-[:ORIGINATES_FROM]->(:Source {id:'u', trust:'untrusted'})"
    )
    res = g.query(
        "MATCH tp = (p:Artifact {id:'p'})-[:DERIVED_FROM|ORIGINATES_FROM*1..16]->"
        "(u:Source {trust:'untrusted'}) RETURN [n IN nodes(tp) | n.id] AS witness, length(tp) AS hops"
    ).result_set
    eq(res, [[["p", "m", "u"], 2]])
    return "witness path and hop count returned"


@check("A07", "none() + coalesce over nodes(path) (q2a semantics)")
def a07(c: Ctx) -> str:
    g = c.graph("a07")
    g.query(
        """
        CREATE (x:Action {id:'act-1'})-[:PAYLOAD]->(d:Artifact {id:'d'}),
               (d)-[:DERIVED_FROM]->(t:Artifact {id:'t', sanitized:true}),
               (t)-[:DERIVED_FROM]->(r:Artifact {id:'r'}),
               (d)-[:DERIVED_FROM]->(m:Artifact {id:'m'}),
               (m)-[:DERIVED_FROM]->(r),
               (r)-[:ORIGINATES_FROM]->(:Source {id:'s', trust:'untrusted'})
        """
    )
    eq(rows(g, "q2a", {"action_id": "act-1"}), [[["d", "m", "r", "s"], 3]], "unsanitized path wins")
    h = c.graph("a07b")
    h.query(
        """
        CREATE (x:Action {id:'act-1'})-[:PAYLOAD]->(d:Artifact {id:'d'}),
               (d)-[:DERIVED_FROM]->(t:Artifact {id:'t', sanitized:true}),
               (t)-[:DERIVED_FROM]->(r:Artifact {id:'r'}),
               (r)-[:ORIGINATES_FROM]->(:Source {id:'s', trust:'untrusted'})
        """
    )
    eq(rows(h, "q2a", {"action_id": "act-1"}), [], "sanitized-only path must give no witness")
    return "sanitized nodes are excluded; nodes without the property are handled by coalesce"


@check("A08", "list projection and concatenation")
def a08(c: Ctx) -> str:
    g = c.graph("a08")
    eq(g.query("RETURN [1, 2] + [3] AS l").result_set, [[[1, 2, 3]]], "concatenation")
    eq(g.query("RETURN [x IN [1, 2, 3] | x * 2] AS l").result_set, [[[2, 4, 6]]], "comprehension")
    return "[1,2]+[3] and list comprehension ok"


@check("A09", "algo.maxFlow docs example (expected 13) + edge property projection")
def a09(c: Ctx) -> str:
    g = c.graph("a09")
    g.query(
        """
        CREATE (a:CapNode {name:'A'}), (b:CapNode {name:'B'}), (c:CapNode {name:'C'}),
               (a)-[:CAN_FLOW {cap_id:'A->B', cost:10}]->(b),
               (a)-[:CAN_FLOW {cap_id:'A->C', cost:5}]->(c),
               (b)-[:CAN_FLOW {cap_id:'B->C', cost:8}]->(c)
        """
    )
    params = {"source_names": ["A"], "target_names": ["C"]}
    try:
        res = g.query(Q["r2"], params).result_set
        eq(len(res), 1, "r2 row count")
        max_flow, cap_ids, flows = res[0]
        eq(max_flow, 13, "maxFlow")
        eq(
            dict(zip(cap_ids, flows, strict=True)),
            {"A->B": 8, "A->C": 5, "B->C": 8},
            "per-edge flow",
        )
        return "r2 (edges[i].cap_id projection) works: maxFlow=13, per-edge flows correct"
    except Exception as primary:  # noqa: BLE001
        res = g.query(Q["r2_fallback"], params).result_set
        max_flow, srcs, dsts, flows = res[0]
        eq(max_flow, 13, "fallback maxFlow")
        got = {f"{s}->{d}": f for s, d, f in zip(srcs, dsts, flows, strict=True)}
        eq(got, {"A->B": 8, "A->C": 5, "B->C": 8}, "fallback per-edge flow")
        return f"NOTE: r2 primary failed ({type(primary).__name__}: {primary}); FALLBACK r2 works"


@check("A10", "UNWIND + CREATE + DELETE of relationships (r3)")
def a10(c: Ctx) -> str:
    g = c.graph("a10")
    g.query(
        "CREATE (:CapNode {name:'a'})-[:CAN_FLOW {cap_id:'a->b', cost:3, description:'d'}]->"
        "(:CapNode {name:'b'})"
    )
    eq(g.query(Q["r3"], {"cap_ids": ["a->b"]}).result_set, [[1]], "revoked")
    eq(g.query("MATCH ()-[r:CAN_FLOW]->() RETURN count(r)").result_set, [[0]], "CAN_FLOW removed")
    eq(
        g.query("MATCH ()-[r:REVOKED_FLOW]->() RETURN r.cap_id, r.cost, r.description").result_set,
        [["a->b", 3, "d"]],
        "REVOKED_FLOW properties",
    )
    return "relationship replaced, properties copied"


@check("A11", "list-of-maps parameters")
def a11(c: Ctx) -> str:
    g = c.graph("a11")
    g.query(Q["q1_seed_agents"], {"rows": [{"id": "x", "role": "r1"}, {"id": "y", "role": "r2"}]})
    eq(
        g.query("MATCH (a:Agent) RETURN a.id, a.role ORDER BY a.id").result_set,
        [["x", "r1"], ["y", "r2"]],
    )
    return "UNWIND $rows AS r CREATE (...) works"


@check("A12", "OPTIONAL MATCH ... WHERE keeps the outer row (q4)")
def a12(c: Ctx) -> str:
    g = c.graph("a12")
    g.query(
        """
        CREATE (s:Source {id:'src:issue:42', trust:'untrusted'}),
               (r:Artifact {id:'r1'})-[:ORIGINATES_FROM]->(s),
               (t:Artifact {id:'t1', sanitized:true})-[:DERIVED_FROM]->(r)
        """
    )
    res = rows(g, "q4", {"source_id": "src:issue:42"})
    eq(res, [[["r1"], []]], "root whose only descendant is sanitized must still be returned")
    g.query("MATCH (r:Artifact {id:'r1'}) CREATE (:Artifact {id:'d1'})-[:DERIVED_FROM]->(r)")
    roots, desc = rows(g, "q4", {"source_id": "src:issue:42"})[0]
    eq(
        (sorted(roots), sorted(desc)),
        (["r1"], ["d1"]),
        "unsanitized descendant included, sanitized excluded",
    )
    return "outer row preserved; sanitized descendants excluded"


@check("A13", "STARTS WITH (q0_ids_with_prefix)")
def a13(c: Ctx) -> str:
    g = c.graph("a13")
    g.query("CREATE (:X {id:'a-0001'}), (:X {id:'a-sbx-0003'}), (:X {id:'s-0001'})")
    same_set(
        [r[0] for r in rows(g, "q0_ids_with_prefix", {"prefix": "a-"})],
        ["a-0001", "a-sbx-0003"],
        "prefix 'a-' (Python must filter with ^a-(\\d+)$)",
    )
    return "returns both a-0001 and a-sbx-0003 -> exact-regex filtering in Python is REQUIRED"


@check("A14", "ORDER BY on a returned alias + LIMIT (q1_lookup_key)")
def a14(c: Ctx) -> str:
    g = c.graph("a14")
    g.query(
        """
        CREATE (:Artifact {id:'a-1', store:'team_memory', key:'k', created_at:5, quarantined:false}),
               (:Artifact {id:'a-2', store:'team_memory', key:'k', created_at:9, quarantined:false}),
               (:Artifact {id:'a-3', store:'team_memory', key:'k', created_at:12, quarantined:true})
        """
    )
    eq(
        rows(g, "q1_lookup_key", {"store": "team_memory", "key": "k"}),
        [["a-2", 9]],
        "latest non-quarantined",
    )
    eq(
        rows(g, "q1_key_exists", {"store": "team_memory", "key": "k"}),
        [[3]],
        "key_exists counts all",
    )
    eq(
        rows(g, "q1_key_exists", {"store": "team_memory", "key": "never"}),
        [[0]],
        "key_exists on absent key",
    )
    return "ORDER BY alias DESC LIMIT 1 ok; count(a)=0 returns a row for an absent key"


@check("A15", "property of a matched node inside CREATE (q1_read_source)")
def a15(c: Ctx) -> str:
    g = c.graph("a15")
    g.query(Q["q1_seed_agents"], {"rows": [{"id": "triage", "role": "r"}]})
    g.query(
        Q["q1_seed_sources"],
        {"rows": [{"id": "src:issue:42", "kind": "k", "trust": "untrusted", "label": "l"}]},
    )
    g.query(
        Q["q1_start_session"],
        {
            "agent_id": "triage",
            "session_id": "s-1",
            "day_label": "Mon",
            "task_ref": "issue:42",
            "ts": 1,
        },
    )
    g.query(
        Q["q1_read_source"],
        {
            "session_id": "s-1",
            "source_id": "src:issue:42",
            "artifact_id": "a-1",
            "content": "c",
            "content_hash": sha("c"),
            "ts": 2,
        },
    )
    eq(
        g.query(
            "MATCH (a:Artifact {id:'a-1'}) RETURN a.agent_id, a.task_ref, a.key, a.store"
        ).result_set,
        [["triage", "issue:42", "", ""]],
        "agent_id/task_ref copied from the session; optional strings stored as ''",
    )
    return "s.agent_id / s.task_ref copied into the new node; '' (not null) stored"


@check("A16", "MERGE on a node (q1_add_agent idempotent)")
def a16(c: Ctx) -> str:
    g = c.graph("a16")
    g.query(Q["q1_add_agent"], {"id": "relay1", "role": "first"})
    eq(g.query(Q["q1_add_agent"], {"id": "relay1", "role": "second"}).result_set, [["relay1"]])
    eq(g.query("MATCH (a:Agent) RETURN count(a), a.role").result_set, [[1, "second"]])
    return "one node, role updated"


@check("A17", "empty UNWIND followed by RETURN count(...) (q1_write tail)")
def a17(c: Ctx) -> str:
    g = c.graph("a17")
    g.query(Q["q1_seed_agents"], {"rows": [{"id": "triage", "role": "r"}]})
    g.query(
        Q["q1_start_session"],
        {"agent_id": "triage", "session_id": "s-1", "day_label": "Mon", "task_ref": "", "ts": 1},
    )

    def write(aid: str, ctx_ids: list[str]) -> list:
        return g.query(
            Q["q1_write"],
            {
                "session_id": "s-1",
                "artifact_id": aid,
                "kind": "memory",
                "key": "k",
                "store": "team_memory",
                "content": "c",
                "content_hash": sha("c"),
                "ts": 2,
                "task_ref": "",
                "context_ids": ctx_ids,
            },
        ).result_set

    empty = write("a-1", [])
    eq(
        g.query("MATCH (a:Artifact {id:'a-1'}) RETURN count(a)").result_set,
        [[1]],
        "artifact created before UNWIND",
    )
    non_empty = write("a-2", ["a-1"])
    eq(non_empty, [[1]], "non-empty context counts derived edges")
    shape = (
        "returns a row with 0"
        if empty == [[0]]
        else f"returns {empty!r} (NO row) -> runtime must treat as 0"
    )
    return f"empty context: {shape}; artifact still created"


@check("A18", "client query timeout (informational for A-03)")
def a18(c: Ctx) -> str:
    g = c.graph("a18")
    eq(g.query("RETURN 1", timeout=5000).result_set, [[1]], "timeout kwarg accepted")
    heavy = "UNWIND range(1, 4000) AS a UNWIND range(1, 4000) AS b RETURN count(*)"
    try:
        g.query(heavy, timeout=1)
    except Exception as exc:  # noqa: BLE001
        return f"timeout enforced (raised {type(exc).__name__}) -> policy.query_timeout_ms can be wired"
    return "NOTE: timeout kwarg accepted but NOT enforced on a 16M-row query -> mark query_timeout_ms unenforced (A-03)"


@check("A19", "q0_max_ts on empty and non-empty graph")
def a19(c: Ctx) -> str:
    g = c.graph("a19")
    empty = rows(g, "q0_max_ts")
    g.query(
        "CREATE (:Session {id:'s', started_at: 1}), (:Artifact {id:'a', created_at: 8}), (:Approval {id:'p', ts: 4})"
    )
    eq(rows(g, "q0_max_ts"), [[8]], "max over created_at / started_at / ts")
    return f"empty graph returns {empty!r} -> runtime must start the clock at 1; non-empty max ok"


# --------------------------------------------------------------------------------------------
# Part B - smoke of every runtime / gate / forensic / time-travel query on the attack graph
# --------------------------------------------------------------------------------------------
@check("B01", "attack graph built via the runtime's q1_* queries")
def b01(c: Ctx) -> str:
    g = c.attack()
    eq(g.query("MATCH (a:Artifact) RETURN count(a)").result_set, [[6]], "6 artifacts")
    eq(rows(g, "q0_max_ts"), [[10]], "clock")
    same_set(
        [r[0] for r in rows(g, "q1_session_context", {"session_id": "s-0002"})],
        ["a-0002", "a-0004", "a-0005", "a-0006"],
        "fixer context = 2 loaded + 2 produced",
    )
    return "6 artifacts, clock 10; fixer context is read from the graph (LOADED|PRODUCED)"


@check("B02", "q2a untrusted witness / q2b secret witness / q2d action context")
def b02(c: Ctx) -> str:
    g = c.attack()
    eq(
        rows(g, "q2a", {"action_id": "act-0001"}),
        [[["a-0006", "a-0004", "a-0001", "src:issue:42"], 3]],
        "untrusted witness skips the sanitized path",
    )
    eq(
        rows(g, "q2b", {"action_id": "act-0001"}),
        [[["a-0006", "a-0005", "src:env:PAYMENT_API_KEY"], 2]],
        "secret witness",
    )
    eq(
        rows(g, "q2d", {"action_id": "act-0001"}),
        [["act-0001", "a-0006", "sink:public_release_page", True]],
        "action context",
    )
    eq(rows(g, "q2d", {"action_id": "act-missing"}), [], "unknown action -> no row")
    return "witnesses and action context as the plan describes"


@check("B03", "q2c quarantine check (clean state)")
def b03(c: Ctx) -> str:
    g = c.attack()
    eq(rows(g, "q2c", {"action_id": "act-0001"}), [[False, []]])
    return "row kept with payload_quarantined=false, no ancestors"


@check("B04", "q3 laundering memory")
def b04(c: Ctx) -> str:
    g = c.attack()
    res = rows(g, "q3", {"action_id": "act-0001"})
    same_set([r[0] for r in res], ["a-0003", "a-0004"], "memories in the lineage")
    row = next(r for r in res if r[0] == "a-0004")
    eq(
        row,
        ["a-0004", "team_convention:42", "s-0001", "triage", "Mon", "src:issue:42"],
        "convention row",
    )
    return "team_convention:42 identified: written by triage in s-0001 on Mon from src:issue:42"


@check("B05", "q4 / q4b quarantine preview and affected actions")
def b05(c: Ctx) -> str:
    g = c.attack()
    roots, desc = rows(g, "q4", {"source_id": "src:issue:42"})[0]
    ids = sorted(set(roots + desc) - {None})
    eq(
        ids,
        ["a-0001", "a-0003", "a-0004", "a-0006"],
        "task:42 (a-0002, sanitized) must NOT be included",
    )
    eq(rows(g, "q4b", {"artifact_ids": ids}), [["act-0001", "proposed"]], "affected actions")
    return "preview = raw issue + memories + draft; sanitized task excluded; action found"


@check("B06", "q5 session facts -> Rule-of-Two letters")
def b06(c: Ctx) -> str:
    g = c.attack()

    def letters(sid: str) -> tuple[bool, bool, bool, bool]:
        trusts, sink_external, writes = rows(g, "q5", {"session_id": sid})[0]
        a, b = "untrusted" in trusts, "secret" in trusts
        cc = True in sink_external or writes > 0
        return a, b, cc, (a + b + cc) <= 2

    eq(letters("s-0001"), (True, False, True, True), "triage")
    eq(letters("s-0002"), (False, True, True, True), "fixer")
    eq(letters("s-0003"), (False, False, True, True), "release")
    return "all three sessions green (A+B+C <= 2) although the system leaks"


@check("B07", "q6 lineage subgraph + q6b node details")
def b07(c: Ctx) -> str:
    g = c.attack()
    edges = rows(g, "q6", {"action_id": "act-0001"})
    eq(len(edges), 11, "distinct lineage edges")
    nodes = sorted({e[0] for e in edges} | {e[1] for e in edges})
    details = {r[0]: r for r in rows(g, "q6b", {"ids": nodes})}
    eq(len(details), len(nodes), "one detail row per node")
    eq(details["a-0002"][1], "Artifact", "label")
    eq(details["a-0002"][4], True, "sanitized flag")
    eq(details["src:issue:42"][1:4], ["Source", "github_issue", "untrusted"], "source details")
    return "11 edges; details rows keyed by id with labels/trust/flags"


@check("B08", "q7 / q7b time travel")
def b08(c: Ctx) -> str:
    g = c.attack()
    eq(len(rows(g, "q7", {"t": 5})), 7, "edges at t=5")
    eq(rows(g, "q7", {"t": 0}), [], "nothing at t=0")
    eq(rows(g, "q7b", {"t": 9}), [], "no action yet at t=9")
    eq(rows(g, "q7b", {"t": 10}), [["act-0001", "proposed", "a-0006"]], "action visible at t=10")
    return "graph grows monotonically with t"


@check("B09", "q8 memory inventory")
def b09(c: Ctx) -> str:
    g = c.attack()
    inv = {r[0]: r for r in rows(g, "q8")}
    eq(sorted(inv), ["a-0002", "a-0003", "a-0004"], "team_memory artifacts")
    eq(inv["a-0004"][6], ["src:issue:42"], "convention has an untrusted origin")
    eq(inv["a-0002"][6], [], "sanitized task has none")
    eq(inv["a-0004"][3:6], ["triage", "Mon", False], "writer / day / quarantined")
    return "convention flagged with untrusted origin; sanitized task clean"


@check("B10", "lookup queries: q1_lookup_key / q1_lookup_prefix / q1_get_artifact")
def b10(c: Ctx) -> str:
    g = c.attack()
    eq(
        rows(g, "q1_lookup_key", {"store": "team_memory", "key": "team_convention:42"}),
        [["a-0004", 5]],
    )
    eq(
        rows(g, "q1_lookup_prefix", {"store": "team_memory", "prefix": "team_convention:"}),
        [["a-0004", "team_convention:42", 5]],
    )
    art = rows(g, "q1_get_artifact", {"artifact_id": "a-0006"})[0]
    eq(
        (art[0], art[1], art[3], art[4].endswith(FAKE_SECRET)),
        ("a-0006", "draft", "workspace", True),
        "draft artifact",
    )
    return "key / prefix lookup and full artifact fetch ok"


@check("B11", "q1_set_action_status / q1_supersede")
def b11(c: Ctx) -> str:
    g = c.attack()
    eq(
        rows(
            g,
            "q1_set_action_status",
            {"action_id": "act-0001", "status": "held", "reason": "TRIFECTA"},
        ),
        [["act-0001"]],
    )
    g.query(
        Q["q1_propose"],
        {
            "session_id": "s-0003",
            "payload_id": "a-0006",
            "sink_id": "sink:internal_changelog",
            "action_id": "act-0002",
            "tool": "post_internal",
            "ts": 11,
        },
    )
    eq(rows(g, "q1_supersede", {"old_id": "act-0001", "new_id": "act-0002"}), [["act-0001"]])
    eq(
        g.query("MATCH (x:Action {id:'act-0001'}) RETURN x.status, x.verdict_reason").result_set,
        [["superseded", "TRIFECTA"]],
    )
    eq(
        g.query("MATCH (:Action {id:'act-0001'})-[:SUPERSEDED_BY]->(n) RETURN n.id").result_set,
        [["act-0002"]],
    )
    return "status/reason written; SUPERSEDED_BY edge created"


@check("B12", "quarantine apply -> q2c/q1_load see it -> release (q4c / q4d)")
def b12(c: Ctx) -> str:
    g = c.attack()
    ids = ["a-0001", "a-0003", "a-0004", "a-0006"]
    eq(
        rows(
            g,
            "q4c",
            {
                "qid": "q-0001",
                "source_id": "src:issue:42",
                "ts": 12,
                "by": "forensic_agent",
                "artifact_ids": ids,
            },
        ),
        [[4]],
        "quarantined_count",
    )
    quarantined = rows(g, "q2c", {"action_id": "act-0001"})
    eq(len(quarantined), 1, "q2c row count")
    eq(quarantined[0][0], True, "payload quarantined")
    same_set(quarantined[0][1], ["a-0001", "a-0003", "a-0004"], "quarantined ancestors")
    eq(
        rows(g, "q1_load", {"session_id": "s-0003", "artifact_id": "a-0004"}),
        [],
        "quarantined artifact cannot be loaded",
    )
    eq(
        rows(g, "q1_lookup_key", {"store": "team_memory", "key": "team_convention:42"}),
        [],
        "lookup skips it",
    )
    eq(
        rows(g, "q1_key_exists", {"store": "team_memory", "key": "team_convention:42"}),
        [[1]],
        "but key still exists",
    )
    eq(rows(g, "q4d", {"qid": "q-0001"}), [[4]], "released_count")
    eq(rows(g, "q2c", {"action_id": "act-0001"}), [[False, []]], "clean again")
    return "quarantine is enforced on load/lookup/q2c and fully reversible"


@check("B13", "approval cuts BOTH witnesses (q1_approve_artifact -> q2a/q2b)")
def b13(c: Ctx) -> str:
    g = c.attack()
    eq(
        rows(
            g,
            "q1_approve_artifact",
            {"artifact_id": "a-0006", "approval_id": "apr-0001", "by": "maintainer", "ts": 13},
        ),
        [["a-0006"]],
    )
    eq(rows(g, "q2a", {"action_id": "act-0001"}), [], "untrusted witness cut by approval")
    eq(rows(g, "q2b", {"action_id": "act-0001"}), [], "secret witness cut by approval")
    return "human approval declassifies the payload for both queries (rule 7)"


# --------------------------------------------------------------------------------------------
# Part C - remediation queries on a tiny capability graph
# --------------------------------------------------------------------------------------------
def build_cap_graph(c: Ctx):
    g = c.graph("cap")
    g.query(
        """
        CREATE (u:CapNode {name:'U', kind:'source', trust:'untrusted'}),
               (s:CapNode {name:'S', kind:'source', trust:'secret'}),
               (x:CapNode {name:'X', kind:'agent'}),
               (y:CapNode {name:'Y', kind:'agent'}),
               (k:CapNode {name:'K', kind:'sink', external:true}),
               (u)-[:CAN_FLOW {cap_id:'U->X', cost:3, description:'d'}]->(x),
               (s)-[:CAN_FLOW {cap_id:'S->X', cost:4, description:'d'}]->(x),
               (x)-[:CAN_FLOW {cap_id:'X->K', cost:5, description:'d'}]->(k),
               (u)-[:CAN_FLOW {cap_id:'U->Y', cost:2, description:'d'}]->(y)
        """
    )
    return g


@check("C01", "r1 all edges / r4 toxic agents / r5 / r6")
def c01(c: Ctx) -> str:
    g = build_cap_graph(c)
    eq(len(rows(g, "r1")), 4, "edges")
    eq(rows(g, "r4"), [["X"]], "toxic agents")
    same_set([r[0] for r in rows(g, "r5", {"source_names": ["U"]})], ["X", "Y"], "reachable from U")
    eq(rows(g, "r6"), [["X"]], "agents reaching an external sink")
    return "X is toxic (untrusted + secret in, external out); Y is not"


@check("C02", "r7 toxic witness (chained WITH ... ORDER BY ... LIMIT)")
def c02(c: Ctx) -> str:
    g = build_cap_graph(c)
    eq(rows(g, "r7", {"agent": "X"}), [[["U", "X"], ["S", "X"], ["X", "K"]]])
    return "one example path per direction"


@check("C03", "r2 maxFlow on the capability graph, then r3 revocation empties r4")
def c03(c: Ctx) -> str:
    g = build_cap_graph(c)
    res = rows(g, "r2", {"source_names": ["U", "S"], "target_names": ["K"]})
    eq(res[0][0], 5, "maxFlow limited by X->K")
    flow = dict(zip(res[0][1], res[0][2], strict=True))
    eq(flow.get("X->K"), 5, "bottleneck edge saturated")
    eq(rows(g, "r3", {"cap_ids": ["X->K"]}), [[1]], "revoked")
    eq(rows(g, "r4"), [], "no toxic agents after revocation")
    try:
        after = rows(g, "r2", {"source_names": ["U", "S"], "target_names": ["K"]})
        tail = f"r2 after revocation returns {after!r}"
    except Exception as exc:  # noqa: BLE001 - informational: the product never needs this case
        tail = f"r2 after revocation raises {type(exc).__name__}"
    return f"maxFlow=5, X->K saturated; r3 empties r4; {tail}"


# --------------------------------------------------------------------------------------------
def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    host = os.environ.get("PW_FALKORDB_HOST") or "localhost"
    port = int(os.environ.get("PW_FALKORDB_PORT") or 6379)
    password = os.environ.get("PW_FALKORDB_PASSWORD") or None
    db = FalkorDB(host=host, port=port, password=password)
    try:
        existing = db.list_graphs()
    except Exception as exc:  # noqa: BLE001
        print(
            f"cannot reach FalkorDB at {host}:{port}: {type(exc).__name__}: {exc}\nRun `make up` first."
        )
        return 2

    for name in existing:  # leftovers from an interrupted run
        if name.startswith("pw_probe_"):
            db.select_graph(name).delete()

    ctx = Ctx(db)
    results: list[tuple[str, str, str, str]] = []
    try:
        for cid, title, fn in CHECKS:
            try:
                detail = fn(ctx)
                status = "NOTE" if detail.startswith("NOTE") else "PASS"
            except Exception as exc:  # noqa: BLE001
                status, detail = "FAIL", f"{type(exc).__name__}: {exc}"
            results.append((cid, status, title, detail))
    finally:
        ctx.cleanup()

    width = max(len(t) for _, _, t, _ in results)
    print(f"FalkorDB probe against {host}:{port}\n")
    for cid, status, title, detail in results:
        print(f"{cid}  {status:<4}  {title:<{width}}  {detail}")
    fails = sum(1 for r in results if r[1] == "FAIL")
    notes = sum(1 for r in results if r[1] == "NOTE")
    print(f"\n{len(results) - fails} passed ({notes} with a NOTE to record), {fails} FAILED")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
