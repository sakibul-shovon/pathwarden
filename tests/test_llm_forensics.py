"""Forensic Agent, LLM plan with a scripted fallback (plan §13.3, §22-P8). Fake model."""

from __future__ import annotations

import json
import re
from collections.abc import Sequence

import pytest

from api.forensics.agent import MAX_TOOL_CALLS, LlmModeUnavailableError
from api.llm import FakeLlm, LlmError


def _results(messages: Sequence[dict[str, str]], tool: str) -> list:
    prefix = f"TOOL RESULT {tool}: "
    return [
        json.loads(m["content"][len(prefix) :]) for m in messages if m["content"].startswith(prefix)
    ]


def _call(tool: str, **args: object) -> str:
    return json.dumps({"tool": tool, "args": args})


class GoodForensicModel:
    """Calls the tools in a sensible order and finishes with a report copied from their results."""

    model = "fake/forensic"
    calls = 0
    tokens = 0

    def __init__(
        self,
        *,
        claim_quarantine_id: str | None = "unset",
        skip_replay: bool = False,
        typo_first: bool = False,
    ):
        self.claim_quarantine_id = claim_quarantine_id
        self.skip_replay = skip_replay
        self.typo_first = typo_first
        self.seen: list[list[dict[str, str]]] = []

    def complete(self, messages):
        self.calls += 1
        self.seen.append([dict(m) for m in messages])
        action = re.search(r"Held action: (\S+)", messages[0]["content"]).group(1)  # type: ignore[union-attr]
        step = sum(1 for m in messages if m["role"] == "assistant")
        corrected = any("expected_args" in m["content"] for m in messages)
        if corrected:
            step -= 1  # the wrong call was answered with a hint, not with progress
        if self.typo_first and step == 2 and not corrected:
            return _call("preview_quarantine", action_id=action)  # the wrong argument name
        w = (_results(messages, "get_witnesses") or [{}])[0]
        pv = next((r for r in _results(messages, "preview_quarantine") if "error" not in r), {})
        if step == 0:
            return _call("get_witnesses", action_id=action)
        if step == 1:
            return _call("trace_memory", action_id=action)
        if step == 2:
            return _call("preview_quarantine", source_id=w["untrusted_witness"][-1])
        if step == 3:
            return _call(
                "apply_quarantine", source_id=pv["source_id"], artifact_ids=pv["artifact_ids"]
            )
        if step == 4 and not self.skip_replay:
            return _call("sandbox_replay", task_ref=w["task_ref"], agents=["fixer", "release"])
        replay = (_results(messages, "sandbox_replay") or [None])[0]
        if step == 5 and replay:
            return _call("gate_in_sandbox", action_id=replay["new_action_id"])
        applied = _results(messages, "apply_quarantine")[0]
        verdict = (_results(messages, "gate_in_sandbox") or [{}])[0]
        qid = (
            applied["quarantine_id"]
            if self.claim_quarantine_id == "unset"
            else self.claim_quarantine_id
        )
        report = {
            "action_id": action,
            "untrusted_source": w["untrusted_witness"][-1],
            "laundering_memories": [
                {
                    "memory_id": m["memory_id"],
                    "memory_key": m["memory_key"],
                    "written_by": m["written_by"],
                    "written_in_session": m["written_in_session"],
                    "written_on": m["written_on"],
                }
                for m in _results(messages, "trace_memory")[0]
            ],
            "quarantine_id": qid,
            "quarantined_artifacts": pv["artifact_ids"],
            "affected_actions": [a["action_id"] for a in pv["affected_actions"]],
            "sandbox": {
                "graph": replay["graph"],
                "new_action_id": replay["new_action_id"],
                "verdict": verdict["verdict"],
                "reason": verdict["reason"],
            }
            if replay
            else None,
            "diff": None,
            "recommendation": "APPROVE_HEALED_RELEASE"
            if verdict.get("verdict") == "ALLOW"
            else "ESCALATE_TO_HUMAN",
        }
        return json.dumps({"report": report})


class SkipsQuarantineFirst(GoodForensicModel):
    """Replays and gates before quarantining (like the real model did), then follows the hint."""

    def complete(self, messages):
        refused = any(m["content"].startswith("REPORT REFUSED") for m in messages)
        sandbox = _results(messages, "sandbox_replay")
        applied = _results(messages, "apply_quarantine")
        if not refused:
            action = re.search(r"Held action: (\S+)", messages[0]["content"]).group(1)  # type: ignore[union-attr]
            w = (_results(messages, "get_witnesses") or [{}])[0]
            pv = (_results(messages, "preview_quarantine") or [{}])[0]
            script = [
                _call("get_witnesses", action_id=action),
                lambda: _call("preview_quarantine", source_id=w["untrusted_witness"][-1]),
                lambda: _call(
                    "sandbox_replay", task_ref=w["task_ref"], agents=["fixer", "release"]
                ),
                lambda: _call("gate_in_sandbox", action_id=sandbox[0]["new_action_id"]),
            ]
            step = sum(1 for m in messages if m["role"] == "assistant")
            self.calls += 1
            self.seen.append([dict(m) for m in messages])
            if step < len(script):
                item = script[step]
                return item if isinstance(item, str) else item()
            return json.dumps(
                {
                    "report": {
                        "action_id": action,
                        "untrusted_source": w["untrusted_witness"][-1],
                        "laundering_memories": [],
                        "quarantine_id": None,
                        "quarantined_artifacts": pv["artifact_ids"],
                        "affected_actions": [],
                        "sandbox": None,
                        "diff": None,
                        "recommendation": "ESCALATE_TO_HUMAN",
                    }
                }
            )
        # after the refusal: do the missing steps in order, then report like the good model
        step = sum(1 for m in messages if m["role"] == "assistant")
        pv = (_results(messages, "preview_quarantine") or [{}])[0]
        w = (_results(messages, "get_witnesses") or [{}])[0]
        action = re.search(r"Held action: (\S+)", messages[0]["content"]).group(1)  # type: ignore[union-attr]
        self.calls += 1
        self.seen.append([dict(m) for m in messages])
        if not applied:
            return _call(
                "apply_quarantine", source_id=pv["source_id"], artifact_ids=pv["artifact_ids"]
            )
        replays = _results(messages, "sandbox_replay")
        later = [m for m in messages if m["content"].startswith("TOOL RESULT apply_quarantine")]
        after_apply = messages.index(later[0]) if later else 0
        replay_after = [
            m
            for m in messages[after_apply:]
            if m["content"].startswith("TOOL RESULT sandbox_replay")
        ]
        if not replay_after:
            return _call("sandbox_replay", task_ref=w["task_ref"], agents=["fixer", "release"])
        new_action = json.loads(replay_after[-1]["content"][len("TOOL RESULT sandbox_replay: ") :])
        gate_after = [
            m
            for m in messages[after_apply:]
            if m["content"].startswith("TOOL RESULT gate_in_sandbox")
        ]
        if not gate_after:
            return _call("gate_in_sandbox", action_id=new_action["new_action_id"])
        verdict = json.loads(gate_after[-1]["content"][len("TOOL RESULT gate_in_sandbox: ") :])
        del replays, step
        return json.dumps(
            {
                "report": {
                    "action_id": action,
                    "untrusted_source": w["untrusted_witness"][-1],
                    "laundering_memories": [],
                    "quarantine_id": _results(messages, "apply_quarantine")[0]["quarantine_id"],
                    "quarantined_artifacts": pv["artifact_ids"],
                    "affected_actions": [a["action_id"] for a in pv["affected_actions"]],
                    "sandbox": {
                        "graph": new_action["graph"],
                        "new_action_id": new_action["new_action_id"],
                        "verdict": verdict["verdict"],
                        "reason": verdict["reason"],
                    },
                    "diff": None,
                    "recommendation": "APPROVE_HEALED_RELEASE"
                    if verdict["verdict"] == "ALLOW"
                    else "ESCALATE_TO_HUMAN",
                }
            }
        )


class BadShapeFirst(GoodForensicModel):
    """Answers its first report with the wrong shape (a copy of the gate result)."""

    def complete(self, messages):
        refused = any(m["content"].startswith("REPORT REFUSED") for m in messages)
        text = super().complete(messages)
        if not refused and text.startswith('{"report"'):
            return json.dumps({"report": {"verdict": "HOLD", "reason": "TRIFECTA"}})
        return text


@pytest.fixture
def held_action(live):
    def make(model):
        ws = live(model)
        action = ws.run_scenario("attack_pipeline_42", guard=True)["actions"][-1]["id"]
        return ws, action

    return make


def comparable(report) -> dict:
    data = report.model_dump(exclude={"mode", "fallback_used", "llm_calls"})
    if data["sandbox"]:
        data["sandbox"].pop("graph")  # a random per-test graph name
    return data


def test_a_sensible_model_drives_the_tools_and_gets_the_same_report_as_the_scripted_plan(
    held_action,
):
    ws, action = held_action(GoodForensicModel())
    scripted_ws, scripted_action = held_action(None)

    llm_report = ws.forensics(action, "llm")
    scripted_report = scripted_ws.forensics(scripted_action, "scripted")

    assert (llm_report.mode, llm_report.fallback_used) == ("llm", False)
    assert llm_report.llm_calls == 7  # 6 tool calls and the final report
    assert comparable(llm_report) == comparable(scripted_report)
    assert llm_report.recommendation == "APPROVE_HEALED_RELEASE"


def test_a_wrong_argument_name_gets_a_hint_and_a_second_chance_not_a_fallback(held_action):
    model = GoodForensicModel(typo_first=True)
    ws, action = held_action(model)
    report = ws.forensics(action, "llm")
    assert (report.mode, report.fallback_used) == ("llm", False)
    assert report.llm_calls == 8  # 6 tool calls, the wrong one and the final report
    hint = [m["content"] for m in model.seen[-1] if "expected_args" in m["content"]]
    assert hint and "source_id" in hint[0]


def test_a_model_that_skips_the_quarantine_is_told_and_can_finish_the_job(held_action):
    model = SkipsQuarantineFirst()
    ws, action = held_action(model)
    report = ws.forensics(action, "llm")
    assert (report.mode, report.fallback_used) == ("llm", False)
    assert report.recommendation == "APPROVE_HEALED_RELEASE" and report.quarantine_id == "q-0001"
    refused = [m["content"] for m in model.seen[-1] if m["content"].startswith("REPORT REFUSED")]
    assert refused and "apply_quarantine" in refused[0]


def test_an_invalid_report_is_refused_with_the_expected_shape_not_ended(held_action):
    model = BadShapeFirst()
    ws, action = held_action(model)
    report = ws.forensics(action, "llm")
    assert report.fallback_used is False
    refused = [m["content"] for m in model.seen[-1] if m["content"].startswith("REPORT REFUSED")]
    assert refused and "quarantine_id" in refused[0]


def test_the_model_only_ever_sees_identifiers_and_metadata_never_content(held_action):
    model = GoodForensicModel()
    ws, action = held_action(model)
    ws.forensics(action, "llm")
    for messages in model.seen:
        for message in messages:
            if message["content"].startswith("TOOL RESULT"):
                assert '"content"' not in message["content"]
                assert "PWDEMO" not in message["content"]


def test_the_quarantine_is_real_and_reversible_after_an_llm_run(held_action):
    ws, action = held_action(GoodForensicModel())
    report = ws.forensics(action, "llm")
    inventory = {m["key"]: m for m in ws.memory_inventory()}
    assert inventory["team_convention:42"]["quarantined"] is True
    assert inventory["team_convention:42"]["quarantine_id"] == report.quarantine_id
    assert ws.release_quarantine(report.quarantine_id) > 0


@pytest.mark.parametrize(
    "reply",
    [
        "this is not json",
        _call("format_disk", target="c:"),  # an unknown tool
        json.dumps({"report": {"action_id": "x"}}),  # not a valid ForensicReport
    ],
)
def test_bad_replies_fall_back_to_the_scripted_plan(held_action, reply):
    ws, action = held_action(FakeLlm([reply]))
    report = ws.forensics(action, "llm")
    assert (report.mode, report.fallback_used) == ("llm", True)
    assert report.recommendation == "APPROVE_HEALED_RELEASE" and report.quarantine_id == "q-0001"


def test_more_than_eight_tool_calls_fall_back(held_action):
    model = FakeLlm(lambda messages: _call("list_memory_inventory"))
    ws, action = held_action(model)
    report = ws.forensics(action, "llm")
    assert report.fallback_used is True
    assert model.calls == MAX_TOOL_CALLS + 1  # the ninth call is refused


def test_a_provider_failure_falls_back(held_action):
    def boom(_messages):
        raise LlmError("LLM call failed: Timeout")

    ws, action = held_action(FakeLlm(boom))
    assert ws.forensics(action, "llm").fallback_used is True


def test_quarantining_artifacts_outside_the_preview_is_refused_and_falls_back(held_action):
    def script(messages):
        step = sum(1 for m in messages if m["role"] == "assistant")
        action = re.search(r"Held action: (\S+)", messages[0]["content"]).group(1)  # type: ignore[union-attr]
        if step == 0:
            return _call("get_witnesses", action_id=action)
        if step == 1:
            return _call("preview_quarantine", source_id="src:issue:42")
        return _call(
            "apply_quarantine", source_id="src:issue:42", artifact_ids=["a-0002", "a-9999"]
        )

    ws, action = held_action(FakeLlm(script))
    report = ws.forensics(action, "llm")
    assert report.fallback_used is True
    # the scripted plan quarantined exactly the previewed set; the unrelated task stays usable
    inventory = {m["key"]: m for m in ws.memory_inventory()}
    assert inventory["task:42"]["quarantined"] is False


def test_a_report_that_disagrees_with_the_tools_is_not_believed(held_action):
    ws, action = held_action(GoodForensicModel(claim_quarantine_id="q-9999"))
    report = ws.forensics(action, "llm")
    assert report.fallback_used is True
    # the model's run had already quarantined: the real id survives the fallback
    assert report.quarantine_id == "q-0001"


def test_a_model_that_skips_the_sandbox_is_not_believed(held_action):
    ws, action = held_action(GoodForensicModel(skip_replay=True))
    assert ws.forensics(action, "llm").fallback_used is True


def test_llm_mode_without_a_model_is_unavailable(held_action):
    ws, action = held_action(None)
    with pytest.raises(LlmModeUnavailableError):
        ws.forensics(action, "llm")


def test_an_llm_report_can_be_healed_by_a_human_like_a_scripted_one(held_action):
    ws, action = held_action(GoodForensicModel())
    assert ws.forensics(action, "llm").recommendation == "APPROVE_HEALED_RELEASE"
    healed = ws.heal_approve(action, "maintainer")
    assert healed["superseded"] is True
