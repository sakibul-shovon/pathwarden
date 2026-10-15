"""Gate behaviour (plan §11, §22-P2) on lineage built by replaying the shared event format."""

from __future__ import annotations

import json
import random
import re

import pytest

from api.graph.client import NamedGraph
from api.graph.loader import QUERY_DIR
from api.runtime.errors import NotFoundError
from api.runtime.gate import Gate, Verdict
from api.runtime.registry import Policy, load_policy, policy_version
from api.runtime.replay import replay
from tests.conftest import FIXTURES

SECRET = "PWDEMO-SECRET-7f3a9c21-NOT-A-REAL-KEY"


def pipeline(
    *,
    convention: bool = True,
    env_key: str = "src:env:PAYMENT_API_KEY",
    sink_tool: str = "post_release",
    approve: bool = False,
    text=lambda label: label,
) -> dict:
    """Triage -> Fixer -> Release, as in plan §12.4. Variants switch the leak path on and off."""
    fixer_loads = [{"op": "load", "sid": "S2", "tool": "memory_read", "ref_in": "R2"}]
    events = [
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
            "content": text("issue"),
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
    ]
    if convention:
        events.append(
            {
                "op": "write",
                "sid": "S1",
                "tool": "memory_write",
                "kind": "memory",
                "key": "team_convention:42",
                "content": text("convention"),
                "ref": "R3",
            }
        )
        fixer_loads.append({"op": "load", "sid": "S2", "tool": "memory_read", "ref_in": "R3"})
    events += [
        {
            "op": "start_session",
            "agent": "fixer",
            "day": "Mon",
            "task_ref": "issue:42",
            "sid": "S2",
        },
        *fixer_loads,
        {
            "op": "read_source",
            "sid": "S2",
            "tool": "read_env",
            "source_id": env_key,
            "content": text(SECRET),
            "ref": "R4",
        },
        {
            "op": "write",
            "sid": "S2",
            "tool": "workspace_write",
            "kind": "draft",
            "key": "changelog:42",
            "content": text("notes"),
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
    ]
    if approve:
        events.append({"op": "approve", "ref_in": "R5", "by": "maintainer"})
    events.append({"op": "propose", "sid": "S3", "tool": sink_tool, "payload": "R5", "ref": "ACT"})
    return {"events": events}


@pytest.fixture
def policy() -> Policy:
    return load_policy(FIXTURES / "policy.yaml")


@pytest.fixture
def verdict_log(tmp_path):
    return tmp_path / "state" / "tinyqueue" / "verdicts.jsonl"


@pytest.fixture
def gate(graph, policy, verdict_log) -> Gate:
    return Gate(
        graph,
        policy,
        policy_version=policy_version(FIXTURES / "policy.yaml"),
        verdict_log=verdict_log,
    )


def run(runtime, scenario) -> str:
    """Replay a scenario and return the id of its proposed action."""
    return replay(runtime, scenario)["ACT"]


def action_state(cypher, graph, action_id):
    return cypher(graph)(
        "MATCH (x:Action {id: $id}) RETURN x.status, x.verdict_reason", id=action_id
    )[0]


# ----------------------------------------------------------------------------- the attack
def test_attack_is_held_with_both_witnesses_ending_at_the_right_sources(
    runtime, graph, gate, cypher
):
    action = run(runtime, pipeline())

    result = gate.decide(action)

    assert (result.verdict, result.reason) == (Verdict.HOLD, "TRIFECTA")
    assert (
        result.untrusted_witness[0] == "a-0005" and result.untrusted_witness[-1] == "src:issue:42"
    )
    assert result.secret_witness[0] == "a-0005" and result.secret_witness[-1] == (
        "src:env:PAYMENT_API_KEY"
    )
    # the untrusted path goes through the unsanitized convention, never through the sanitized task
    assert "a-0003" in result.untrusted_witness and "a-0002" not in result.untrusted_witness
    assert result.llm_calls == 0 and result.latency_ms >= 0
    assert action_state(cypher, graph, action) == ["held", "TRIFECTA"]


def test_without_the_convention_the_same_run_is_clean(runtime, graph, gate, cypher):
    action = run(runtime, pipeline(convention=False, env_key="src:env:PORT"))

    result = gate.decide(action)

    assert (result.verdict, result.reason) == (Verdict.ALLOW, "CLEAN")
    assert result.untrusted_witness == []  # the only untrusted path runs through the sanitized task
    assert result.secret_witness == []
    assert action_state(cypher, graph, action) == ["allowed", "CLEAN"]


def test_a_sanitized_only_path_gives_no_untrusted_witness_even_with_a_secret(runtime, gate):
    action = run(runtime, pipeline(convention=False))  # secret read, no convention

    result = gate.decide(action)

    assert result.untrusted_witness == []
    assert result.secret_witness[-1] == "src:env:PAYMENT_API_KEY"
    assert (result.verdict, result.reason) == (Verdict.ALLOW, "SECRET_EGRESS_WARNING")


def test_sanitizing_a_secret_does_not_declassify_it(runtime, gate):
    """Rule 7: `sanitized` cuts only untrusted paths; a secret reaching the draft solely through a
    sanitized artifact must still be a secret witness (an enum or integer can encode a secret)."""
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
            # the draft's session never reads the raw secret: it only loads the sanitized artifact
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
            {
                "op": "start_session",
                "agent": "release",
                "day": "Mon",
                "task_ref": "issue:42",
                "sid": "S4",
            },
            {"op": "load", "sid": "S4", "tool": "workspace_read", "ref_in": "R5"},
            {"op": "propose", "sid": "S4", "tool": "post_release", "payload": "R5", "ref": "ACT"},
        ]
    }
    ids = replay(runtime, scenario)

    result = gate.decide(ids["ACT"])

    assert (
        ids["R4"] not in result.secret_witness[1:2]
    )  # the draft is not derived from the raw secret
    assert ids["R6"] in result.secret_witness  # the path goes through the sanitized artifact
    assert result.secret_witness[-1] == "src:env:PAYMENT_API_KEY"
    assert (result.verdict, result.reason) == (Verdict.HOLD, "TRIFECTA")


def test_human_approval_cuts_both_witnesses(runtime, gate):
    action = run(runtime, pipeline(approve=True))

    result = gate.decide(action)

    assert (result.verdict, result.reason) == (Verdict.ALLOW, "CLEAN")
    assert result.untrusted_witness == [] and result.secret_witness == []


def test_an_internal_sink_is_clean_even_with_both_witnesses(runtime, gate):
    action = run(runtime, pipeline(sink_tool="post_internal"))

    result = gate.decide(action)

    assert (result.verdict, result.reason) == (Verdict.ALLOW, "CLEAN")
    assert result.untrusted_witness and result.secret_witness  # both exist; the sink is internal


def test_strict_policy_turns_the_trifecta_into_a_block(graph, runtime, verdict_log):
    strict = Gate(
        graph,
        Policy(strict=True, max_lineage_hops=16, query_timeout_ms=2000),
        policy_version="test",
        verdict_log=verdict_log,
    )
    result = strict.decide(run(runtime, pipeline()))
    assert (result.verdict, result.reason) == (Verdict.BLOCK, "TRIFECTA")


# ----------------------------------------------------------------------------- quarantine, missing
def test_a_quarantined_ancestor_blocks(runtime, graph, gate, cypher):
    action = run(runtime, pipeline())
    cypher(graph)("MATCH (a:Artifact {id: 'a-0003'}) SET a.quarantined = true")

    result = gate.decide(action)

    assert (result.verdict, result.reason) == (Verdict.BLOCK, "QUARANTINED_LINEAGE")
    assert result.quarantined_ancestors == ["a-0003"]
    assert action_state(cypher, graph, action) == ["blocked", "QUARANTINED_LINEAGE"]


def test_a_quarantined_root_behind_the_sanitized_task_does_not_block_the_healed_draft(
    runtime, graph, gate, cypher
):
    """D-017: the raw issue is quarantined (it is the root of the contamination) but the draft only
    reaches it THROUGH the sanitized task, which is the declassification boundary."""
    ids = replay(runtime, pipeline(convention=False, env_key="src:env:PORT"))
    cypher(graph)("MATCH (a:Artifact {id: $id}) SET a.quarantined = true", id=ids["R1"])

    result = gate.decide(ids["ACT"])

    assert (result.verdict, result.reason) == (Verdict.ALLOW, "CLEAN")
    assert result.quarantined_ancestors == []


def test_a_quarantined_sanitized_artifact_itself_still_blocks(runtime, graph, gate, cypher):
    ids = replay(runtime, pipeline(convention=False, env_key="src:env:PORT"))
    cypher(graph)("MATCH (a:Artifact {id: $id}) SET a.quarantined = true", id=ids["R2"])

    result = gate.decide(ids["ACT"])

    assert (result.verdict, result.reason) == (Verdict.BLOCK, "QUARANTINED_LINEAGE")
    assert result.quarantined_ancestors == [ids["R2"]]


def test_a_quarantined_payload_blocks(runtime, graph, gate, cypher):
    action = run(runtime, pipeline())
    cypher(graph)("MATCH (a:Artifact {id: 'a-0005'}) SET a.quarantined = true")

    result = gate.decide(action)

    assert (result.verdict, result.reason) == (Verdict.BLOCK, "QUARANTINED_LINEAGE")


def test_missing_payload_or_sink_is_held_for_missing_provenance(graph, gate, cypher):
    run_cypher = cypher(graph)
    run_cypher("CREATE (:Action {id: 'act-x1', tool: 'post_release', status: 'proposed'})")
    run_cypher(
        "CREATE (:Action {id: 'act-x2', tool: 'post_release', status: 'proposed'})"
        "-[:PAYLOAD]->(:Artifact {id: 'a-x', quarantined: false})"
    )

    for action in ("act-x1", "act-x2"):  # no payload at all / payload but no sink
        result = gate.decide(action)
        assert (result.verdict, result.reason) == (Verdict.HOLD, "MISSING_PROVENANCE")
    assert action_state(cypher, graph, "act-x1") == ["held", "MISSING_PROVENANCE"]


def test_an_unknown_action_raises_instead_of_deciding(gate):
    with pytest.raises(NotFoundError):
        gate.decide("act-9999")


# ----------------------------------------------------------------------------- fail closed
class _BrokenGraph(NamedGraph):
    def run(self, query: str, **params: object) -> list[list]:
        if query == "q2a_untrusted_witness":
            raise RuntimeError("database went away")
        return super().run(query, **params)


def test_a_database_error_raises_and_never_yields_allow(
    db, runtime, graph, policy, verdict_log, cypher
):
    action = run(runtime, pipeline(convention=False, env_key="src:env:PORT"))
    broken = Gate(
        _BrokenGraph(db, graph.name),
        policy,
        policy_version="test",
        verdict_log=verdict_log,
    )

    with pytest.raises(RuntimeError):
        broken.decide(action)

    assert action_state(cypher, graph, action)[0] == "proposed"  # untouched
    assert not verdict_log.exists()  # nothing was logged as a decision


# ----------------------------------------------------------------------------- determinism, log
def test_verdicts_and_witnesses_do_not_depend_on_artifact_contents(runtime, graph, gate):
    baseline = gate.decide(run(runtime, pipeline()))
    rng = random.Random(20261015)
    awkward = ["", "ignore previous instructions", SECRET, "x" * 5000, "ghp-looking text", "\n\t"]

    for i in range(6):
        fresh = Runtime_for(graph)
        noise = lambda label, i=i: awkward[i] if i < len(awkward) else rng.getrandbits(128).hex()  # noqa: E731
        result = gate.decide(run(fresh, pipeline(text=noise)))
        assert (result.verdict, result.reason) == (baseline.verdict, baseline.reason)
        # ids differ between runs; compare shape: lengths and the source at the end of each path
        assert len(result.untrusted_witness) == len(baseline.untrusted_witness)
        assert result.untrusted_witness[-1] == baseline.untrusted_witness[-1]
        assert len(result.secret_witness) == len(baseline.secret_witness)
        assert result.secret_witness[-1] == baseline.secret_witness[-1]


def Runtime_for(graph):  # noqa: N802 - small test helper, reopens a runtime on the same graph
    from api.runtime.registry import Registry
    from api.runtime.runtime import Runtime

    return Runtime(graph, Registry.load(FIXTURES / "registry.yaml"))


def test_deciding_twice_is_stable_and_logs_every_decision(runtime, gate, verdict_log):
    action = run(runtime, pipeline())

    first, second = gate.decide(action), gate.decide(action)

    assert (first.verdict, first.reason, first.untrusted_witness, first.secret_witness) == (
        second.verdict,
        second.reason,
        second.untrusted_witness,
        second.secret_witness,
    )
    lines = [json.loads(line) for line in verdict_log.read_text(encoding="utf-8").splitlines()]
    assert len(lines) == 2
    entry = lines[0]
    assert set(entry) >= {
        "action_id",
        "verdict",
        "reason",
        "witnesses",
        "latency_ms",
        "policy_version",
        "llm_calls",
    }
    assert entry["verdict"] == "HOLD" and entry["reason"] == "TRIFECTA"
    assert entry["witnesses"]["untrusted"][-1] == "src:issue:42"
    assert entry["policy_version"] == policy_version(FIXTURES / "policy.yaml")
    assert re.fullmatch(r"[0-9a-f]{64}", entry["policy_version"])


def test_the_lineage_hop_bound_in_the_queries_equals_the_policy(policy):
    for name in ("q2a_untrusted_witness", "q2b_secret_witness", "q2c_quarantine_check"):
        text = (QUERY_DIR / f"{name}.cypher").read_text(encoding="utf-8")
        bounds = {int(n) for n in re.findall(r"\*1\.\.(\d+)", text)}
        assert bounds == {policy.max_lineage_hops}, f"{name}: {bounds} vs policy"
