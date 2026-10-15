"""The LLM forensic plan (plan §13.3, §22-P8) with a FAKE model: valid plans, and every way a model
can go wrong. Whatever it does, the outcome is a valid report: its own, or the scripted plan's with
``fallback_used: true``."""

from __future__ import annotations

import json
import re

import pytest

from api.llm import FakeLlm, LlmError
from tests.test_live import BASE, following_model, run_live

REPORT_FIELDS = ("memory_id", "memory_key", "written_by", "written_in_session", "written_on")


def call(tool: str, **args) -> str:
    return json.dumps({"tool": tool, "args": args})


def tool_results(messages: list[dict]) -> list:
    return [
        json.loads(m["content"].split(": ", 1)[1])
        for m in messages
        if m["role"] == "user" and m["content"].startswith("TOOL RESULT")
    ]


def forensic_model(tamper=None):
    """A model that investigates correctly; ``tamper(step, planned) -> str`` can sabotage it."""

    def reply(messages: list[dict]) -> str:
        action = re.search(r"Held action: (\S+)", messages[0]["content"]).group(1)
        results = tool_results(messages)
        step = len(results)
        witnesses = results[0] if results else None
        source = witnesses["untrusted_witness"][-1] if witnesses else None
        replay = results[4] if len(results) > 4 else None
        calls = [
            {"tool": "get_witnesses", "args": {"action_id": action}},
            {"tool": "trace_memory", "args": {"action_id": action}},
            {"tool": "preview_quarantine", "args": {"source_id": source}},
            {
                "tool": "apply_quarantine",
                "args": {"source_id": source, "artifact_ids": results[2]["artifact_ids"]}
                if step > 2
                else {},
            },
            {
                "tool": "sandbox_replay",
                "args": {"task_ref": witnesses["task_ref"], "agents": ["fixer", "release"]}
                if witnesses
                else {},
            },
            {
                "tool": "gate_in_sandbox",
                "args": {"action_id": replay["new_action_id"]} if replay else {},
            },
        ]
        if step < len(calls):
            planned = json.dumps(calls[step])
        else:
            gated = results[5]
            report = {
                "action_id": action,
                "untrusted_source": source,
                "laundering_memories": [{k: m[k] for k in REPORT_FIELDS} for m in results[1]],
                "quarantine_id": results[3]["quarantine_id"],
                "quarantined_artifacts": results[2]["artifact_ids"],
                "affected_actions": [a["action_id"] for a in results[2]["affected_actions"]],
                "sandbox": {
                    "graph": replay["graph"],
                    "new_action_id": replay["new_action_id"],
                    "verdict": gated["verdict"],
                    "reason": gated["reason"],
                },
                "diff": None,
                "recommendation": "APPROVE_HEALED_RELEASE"
                if gated["verdict"] == "ALLOW"
                else "ESCALATE_TO_HUMAN",
            }
            planned = json.dumps({"report": report})
        return tamper(step, planned) if tamper else planned

    return reply


def held_live_action(client) -> str:
    return run_live(client, "attack_pipeline_42")["actions"][-1]["id"]


def forensics_llm(client, action):
    response = client.post(f"{BASE}/forensics/{action}", json={"mode": "llm"})
    assert response.status_code == 200, response.text
    return response.json()


def setup(live_client):
    """A client whose model first plays the agents (the placeholder), then the investigator."""
    llm = FakeLlm(following_model)
    client, manager = live_client(llm)
    action = held_live_action(client)
    llm.calls.clear()
    return llm, client, action


def assert_scripted_fallback(client, report):
    assert report["mode"] == "llm" and report["fallback_used"] is True
    assert report["recommendation"] == "APPROVE_HEALED_RELEASE"
    assert report["untrusted_source"] == "src:issue:42" and report["sandbox"]["verdict"] == "ALLOW"
    assert any(m["quarantined"] for m in client.get(f"{BASE}/memory").json())


# -------------------------------------------------- a correct investigation
def test_a_model_that_investigates_correctly_produces_a_valid_llm_report(live_client):
    llm, client, action = setup(live_client)
    llm.replies = forensic_model()

    report = forensics_llm(client, action)

    assert report["mode"] == "llm" and report["fallback_used"] is False
    assert report["llm_calls"] == 7  # six tool calls and the report
    assert report["recommendation"] == "APPROVE_HEALED_RELEASE"
    assert report["untrusted_source"] == "src:issue:42"
    assert (
        report["diff"]["held_payload_id"] and report["diff"]["healed_payload_id"]
    )  # from the graph
    assert report["sandbox"]["verdict"] == "ALLOW"
    assert any(m["quarantined"] for m in client.get(f"{BASE}/memory").json())  # really applied


def test_the_tool_outputs_shown_to_the_model_never_contain_content(live_client):
    llm, client, action = setup(live_client)
    llm.replies = forensic_model()
    llm.calls.clear()

    forensics_llm(client, action)

    def has_content(value) -> bool:
        if isinstance(value, dict):
            return "content" in value or any(has_content(v) for v in value.values())
        if isinstance(value, list):
            return any(has_content(v) for v in value)
        return False

    final = llm.calls[-1]
    assert tool_results(final) and not any(has_content(r) for r in tool_results(final))
    assert action in final[0]["content"]  # the held action id is in the prompt


# -------------------------------------------------- everything that goes wrong
def test_invalid_json_falls_back_to_the_scripted_plan(live_client):
    llm, client, action = setup(live_client)
    llm.replies = lambda m: "I will look into it"

    report = forensics_llm(client, action)

    assert_scripted_fallback(client, report)
    assert report["llm_calls"] == 1


@pytest.mark.parametrize(
    ("step", "reply"),
    [
        (2, '{"tool": "delete_everything", "args": {}}'),  # unknown tool
        (
            3,
            call("apply_quarantine", source_id="src:issue:42", artifact_ids=["a-9999"]),
        ),
        (
            2,
            call("apply_quarantine", source_id="src:issue:42", artifact_ids=["a-0001"]),
        ),
        (
            4,
            call("sandbox_replay", task_ref="issue:43", agents=["fixer", "release"]),
        ),
        (4, call("sandbox_replay", task_ref="issue:42", agents=["triage"])),
        (0, '{"tool": "get_witnesses", "args": {"action_id": "act-9999"}}'),
        (0, '{"tool": "get_witnesses", "args": "not an object"}'),
        (5, '{"tool": "gate_in_sandbox", "args": {"action_id": "act-sbx-9999"}}'),
    ],
)
def test_a_disallowed_tool_call_falls_back(live_client, step, reply):
    llm, client, action = setup(live_client)
    llm.replies = forensic_model(lambda s, planned: reply if s == step else planned)

    report = forensics_llm(client, action)

    assert_scripted_fallback(client, report)


def test_more_than_eight_tool_calls_fall_back(live_client):
    llm, client, action = setup(live_client)
    llm.replies = lambda m: '{"tool": "list_memory_inventory", "args": {}}'

    report = forensics_llm(client, action)

    assert_scripted_fallback(client, report)
    assert report["llm_calls"] == 9  # the ninth call is refused: over budget


def tamper_report(change):
    def tamper(step, planned):
        if step == 6:
            body = json.loads(planned)
            change(body["report"])
            return json.dumps(body)
        return planned

    return tamper


@pytest.mark.parametrize(
    "change",
    [
        lambda r: r.update(sandbox={**r["sandbox"], "verdict": "HOLD"}),  # contradicts the tool
        lambda r: r.update(sandbox=None),  # APPROVE without a sandbox
        lambda r: r.update(quarantine_id="q-9999"),  # a quarantine that never happened
        lambda r: r.update(untrusted_source="src:issue:43"),
        lambda r: r.update(action_id="act-9999"),
        lambda r: r.update(quarantined_artifacts=["a-9999"]),
        lambda r: r.update(
            laundering_memories=[{**r["laundering_memories"][0], "memory_id": "a-9999"}]
        ),
        lambda r: r.update(recommendation="MAYBE"),  # not a valid ForensicReport
        lambda r: r.pop("recommendation"),
    ],
)
def test_a_report_that_contradicts_the_tools_or_the_schema_falls_back(live_client, change):
    llm, client, action = setup(live_client)
    llm.replies = forensic_model(tamper_report(change))

    report = forensics_llm(client, action)

    assert_scripted_fallback(client, report)
    assert report["llm_calls"] == 7


def test_the_report_may_not_be_issued_before_investigating(live_client):
    llm, client, action = setup(live_client)
    llm.replies = lambda m: json.dumps(
        {
            "report": {
                "action_id": action,
                "untrusted_source": "src:issue:42",
                "laundering_memories": [],
                "quarantine_id": None,
                "quarantined_artifacts": [],
                "affected_actions": [],
                "sandbox": None,
                "diff": None,
                "recommendation": "ESCALATE_TO_HUMAN",
            }
        }
    )

    assert_scripted_fallback(client, forensics_llm(client, action))


def test_an_llm_error_during_the_investigation_falls_back(live_client):
    llm, client, action = setup(live_client)
    good = forensic_model()

    def broken(messages):
        if len(tool_results(messages)) >= 2:
            raise LlmError("provider down")
        return good(messages)

    llm.replies = broken

    assert_scripted_fallback(client, forensics_llm(client, action))


def test_a_model_that_skips_the_quarantine_gets_an_escalation_not_an_approval(live_client):
    llm, client, action = setup(live_client)

    def reply(messages):
        results = tool_results(messages)
        step = len(results)
        if step == 0:
            return json.dumps({"tool": "get_witnesses", "args": {"action_id": action}})
        task_ref = results[0]["task_ref"]
        if step == 1:
            args = {"task_ref": task_ref, "agents": ["fixer", "release"]}
            return json.dumps({"tool": "sandbox_replay", "args": args})
        if step == 2:
            return json.dumps(
                {"tool": "gate_in_sandbox", "args": {"action_id": results[1]["new_action_id"]}}
            )
        replay, gated = results[1], results[2]
        return json.dumps(
            {
                "report": {
                    "action_id": action,
                    "untrusted_source": results[0]["untrusted_witness"][-1],
                    "laundering_memories": [],
                    "quarantine_id": None,
                    "quarantined_artifacts": [],
                    "affected_actions": [],
                    "sandbox": {
                        "graph": replay["graph"],
                        "new_action_id": replay["new_action_id"],
                        "verdict": gated["verdict"],
                        "reason": gated["reason"],
                    },
                    "diff": None,
                    "recommendation": "ESCALATE_TO_HUMAN",
                }
            }
        )

    llm.replies = reply

    report = forensics_llm(client, action)

    assert gated_verdict_is_not_allow(report)
    assert report["fallback_used"] is False and report["quarantine_id"] is None
    assert not any(m["quarantined"] for m in client.get(f"{BASE}/memory").json())


def gated_verdict_is_not_allow(report) -> bool:
    """Without the quarantine the sandbox replay still contains the poisoned memory: not clean."""
    return (
        report["sandbox"]["verdict"] != "ALLOW" and report["recommendation"] == "ESCALATE_TO_HUMAN"
    )
