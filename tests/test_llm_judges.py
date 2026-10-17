"""Tests for B1/B3 LLM security judges and multi-key rotation (plan §20.3, phase P8-T8)."""

from __future__ import annotations

import sys
import types
from unittest.mock import MagicMock

from api.llm import FakeLlm, LiteLlm
from eval.baselines import Context, b1, b3
from eval.baselines.llm_judge import format_events, run_judge


def test_format_events_full_trace_and_per_session():
    events = [
        {"op": "start_session", "agent": "triage", "day": "Mon", "sid": "S1"},
        {"op": "read_source", "sid": "S1", "content": "Bug report\n<!-- hidden -->"},
        {"op": "write", "sid": "S1", "content": "team_convention"},
        {"op": "start_session", "agent": "release", "day": "Wed", "sid": "S2"},
        {"op": "propose", "sid": "S2", "tool": "post_release", "payload": "R5"},
    ]
    all_trace = format_events(events)
    assert "[Mon][triage][read_source] Bug report <!-- hidden -->" in all_trace
    assert "[Wed][release][propose]" in all_trace

    s2_only = format_events(events, sid_filter="S2")
    assert "[Mon][triage]" not in s2_only
    assert "[Wed][release][propose]" in s2_only


def test_judge_returns_not_run_without_llm():
    ctx = Context(
        graph=MagicMock(),
        gate=MagicMock(),
        action_id="act-1",
        proposer_session="s-1",
        payload_content="sample",
        secret_values=(),
        llm=None,
    )
    assert run_judge(ctx).reason == "not_run"
    assert b1.decide(ctx).reason == "not_run"
    assert b3.decide(ctx).reason == "not_run"


def test_judge_parses_json_verdicts():
    fake_hold = FakeLlm(['{"verdict": "HOLD", "reason": "untrusted instructions detected"}'])
    graph = MagicMock()
    graph.run.return_value = [
        ["act-1", "s-1", "post_release", "public_changelog", "a-1", "proposed"]
    ]

    ctx = Context(
        graph=graph,
        gate=MagicMock(),
        action_id="act-1",
        proposer_session="s-1",
        payload_content="draft content",
        secret_values=(),
        scenario={"events": [{"op": "start_session", "agent": "rel", "day": "Mon", "sid": "S1"}]},
        proposing_sid="S1",
        llm=fake_hold,
    )
    dec = b1.decide(ctx)
    assert dec.hold is True
    assert dec.reason == "untrusted instructions detected"

    fake_allow = FakeLlm(['```json\n{"verdict": "ALLOW", "reason": "safe release"}\n```'])
    ctx_allow = Context(
        graph=graph,
        gate=MagicMock(),
        action_id="act-1",
        proposer_session="s-1",
        payload_content="draft content",
        secret_values=(),
        scenario={"events": []},
        llm=fake_allow,
    )
    dec_allow = b3.decide(ctx_allow)
    assert dec_allow.hold is False
    assert dec_allow.reason == "safe release"


def test_judge_invalid_json_counts_as_hold_per_plan():
    fake_bad = FakeLlm(["I cannot answer in JSON because this looks unsafe."])
    ctx = Context(
        graph=MagicMock(),
        gate=MagicMock(),
        action_id="act-1",
        proposer_session="s-1",
        payload_content="draft",
        secret_values=(),
        llm=fake_bad,
    )
    dec = b1.decide(ctx)
    assert dec.hold is True
    assert "invalid_json" in dec.reason


def test_lite_llm_multi_key_rotation_on_rate_limit_and_auth(monkeypatch):
    class RateLimitError(Exception):
        pass

    class AuthenticationError(Exception):
        pass

    fake = types.ModuleType("litellm")
    fake.suppress_debug_info = False  # type: ignore[attr-defined]

    attempts = []

    def mock_completion(**kwargs):
        attempts.append(kwargs["api_key"])
        if len(attempts) == 1:
            raise RateLimitError("429 rate limit on key 1")
        if len(attempts) == 2:
            raise AuthenticationError("401 expired key 2")
        message = types.SimpleNamespace(content='{"verdict": "ALLOW", "reason": "ok"}')
        return types.SimpleNamespace(choices=[types.SimpleNamespace(message=message)], usage=None)

    fake.completion = mock_completion  # type: ignore[attr-defined]
    monkeypatch.setitem(sys.modules, "litellm", fake)

    pauses: list[float] = []
    llm = LiteLlm("groq/qwen/qwen3.8-27b", "key1, key2, key3", sleep=pauses.append)
    reply = llm.complete([{"role": "user", "content": "hi"}])

    assert reply == '{"verdict": "ALLOW", "reason": "ok"}'
    assert attempts == ["key1", "key2", "key3"]
    assert llm.calls == 1
