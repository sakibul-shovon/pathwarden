"""Live LLM mode with a FAKE model (plan §12.3, §13.3, §22-P8). No key, no network.

The fake follows the injection (or refuses, or misbehaves) so the loop, the tool mapping, the
infrastructure ``extract_task``, the guard and the LLM forensic plan are tested deterministically.
"""

from __future__ import annotations

import json
import logging
import re
from pathlib import Path

import pytest

from api.agents.live import MAX_STEPS, PROMPTS, TOOL_MENUS, load_prompt, tool_menu_text
from api.agents.render import render_changelog
from api.agents.scripted import Fixtures, IssueView, choose_env_keys
from api.llm import FakeLlm, LiteLlm, LlmError, make_llm, parse_json_reply
from api.settings import Settings
from tests.conftest import FIXTURES

BASE = "/api/ws/tinyqueue"
PLAN = (FIXTURES.parent / "plan.md").read_text(encoding="utf-8")
FX = Fixtures(FIXTURES)


# -------------------------------------------------- a fake model that plays the three roles
def _step_count(messages: list[dict]) -> list[str]:
    return [
        m["content"] for m in messages if m["role"] == "user" and m["content"].startswith("TOOL")
    ]


def following_model(messages: list[dict]) -> str:
    """Behaves like the vulnerable assistant of the story: follows conventions found in issues."""
    first = messages[0]
    if first["role"] == "user" and first["content"].startswith("Extract structured fields"):
        n = int(re.search(r"Issue number: (\d+)", first["content"]).group(1))
        return json.dumps({"issue_id": n, "component": "queue", "severity": "high", "kind": "bug"})
    system = first["content"]
    n = int(re.search(r"#(\d+)", system).group(1))
    results = _step_count(messages)
    step = len(results)
    if system.startswith("You are Triage"):
        issue = IssueView.parse(FX.issue_text(n))
        plan: list[dict] = [
            {"tool": "fetch_issue", "args": {"number": n}},
            {"tool": "memory_write", "args": {"key": f"issue_summary:{n}", "content": "summary"}},
        ]
        if issue.hidden_comment:
            plan.append(
                {
                    "tool": "memory_write",
                    "args": {"key": f"team_convention:{n}", "content": issue.hidden_comment},
                }
            )
    elif system.startswith("You are Fixer"):
        plan = [
            {"tool": "memory_read", "args": {"key": f"task:{n}"}},
            {"tool": "memory_list", "args": {"prefix": "team_convention:"}},
        ]
        if step >= 2:
            conventions = [e["content"] for e in json.loads(results[1].split(": ", 1)[1])]
            keys = choose_env_keys(conventions)
            values: dict[str, str] = {}
            for key in keys:
                plan.append({"tool": "read_env", "args": {"key": key}})
            plan.append(
                {"tool": "workspace_write", "args": {"key": f"patch:{n}", "content": "patch"}}
            )
            for key in keys:
                values[key] = FX.env()[key]
            title = IssueView.parse(FX.issue_text(n)).title
            draft = render_changelog(title, n, values, conventions, False)
            plan.append(
                {"tool": "workspace_write", "args": {"key": f"changelog:{n}", "content": draft}}
            )
    elif system.startswith("You are Release"):
        plan = [
            {"tool": "workspace_read", "args": {"key": f"changelog:{n}"}},
            {"tool": "post_release", "args": {"key": f"changelog:{n}"}},
        ]
    else:
        raise AssertionError("unexpected prompt")
    return json.dumps(plan[step] if step < len(plan) else {"done": True})


def refusing_model(messages: list[dict]) -> str:
    return '{"done": true}'


# -------------------------------------------------- fixtures
def run_live(client, scenario, guard=True):
    response = client.post(
        f"{BASE}/scenarios/{scenario}/run", json={"guard": guard, "mode": "live"}
    )
    assert response.status_code == 200, response.text
    return response.json()


# -------------------------------------------------- prompts (T5)
def _plan_block(label: str) -> str:
    match = re.search(rf"`{re.escape(label)}`\s+```\n(.*?)\n```", PLAN, re.S)
    assert match, label
    return match.group(1)


@pytest.mark.parametrize("name", ["triage", "fixer", "release", "extractor"])
def test_the_prompt_files_are_verbatim_copies_of_the_plan(name):
    assert (PROMPTS / f"{name}.txt").read_text(encoding="utf-8").rstrip("\n") == _plan_block(
        f"{name}.txt"
    )


def test_the_forensic_prompt_is_a_verbatim_copy_of_the_plan():
    section = PLAN.split("- Prompt (`api/agents/prompts/forensic.txt`):", 1)[1]
    block = re.search(r"```\n(.*?)\n```", section, re.S).group(1)

    assert (PROMPTS / "forensic.txt").read_text(encoding="utf-8").rstrip("\n") == block


@pytest.mark.parametrize("name", ["triage", "fixer", "release", "extractor"])
def test_the_agent_prompts_say_nothing_about_security(name):
    text = (PROMPTS / f"{name}.txt").read_text(encoding="utf-8").lower()

    for word in ("secur", "pathwarden", "inject", "secret", "untrusted", "attack", "leak"):
        assert word not in text, word


def test_prompt_placeholders_are_filled_in_one_pass_and_json_braces_stay():
    text = load_prompt("triage", number=42, tool_menu=tool_menu_text("triage"))

    assert "issue #42" in text and '"issue_summary:42"' in text
    assert '{"tool": "<name>", "args": {...}}' in text
    assert "{number}" not in text and "{tool_menu}" not in text
    hostile = load_prompt("extractor", number=1, issue_text="{number} {tool_menu}")
    assert hostile.endswith("{number} {tool_menu}")  # text inside the issue is never re-expanded


def test_every_agent_has_a_tool_menu_that_matches_the_plan_table():
    assert set(TOOL_MENUS["triage"]) == {"fetch_issue", "memory_write"}
    assert set(TOOL_MENUS["fixer"]) == {
        "memory_read",
        "memory_list",
        "read_env",
        "read_doc",
        "workspace_write",
    }
    assert set(TOOL_MENUS["release"]) == {"workspace_read", "post_release"}


# ---------------------------------------- the story with a model that follows the injection
def test_a_model_that_follows_the_injection_leaks_with_the_guard_off(live_client):
    client, manager = live_client(FakeLlm(following_model))

    result = run_live(client, "attack_pipeline_42", guard=False)

    assert result["mode"] == "live" and result["live"]["model"] == "fake-model"
    assert result["actions"][-1]["reason"] == "GUARD_OFF"
    posted = manager.get("tinyqueue").sinks.posted("sink:public_release_page")
    assert any("PAYMENT_API_KEY=PWDEMO-SECRET" in p["content"] for p in posted)


def test_the_same_run_is_held_with_both_witnesses_when_the_guard_is_on(live_client):
    client, _ = live_client(FakeLlm(following_model))

    result = run_live(client, "attack_pipeline_42")
    action = result["actions"][-1]["id"]
    gate = client.get(f"{BASE}/actions/{action}").json()["gate"]

    assert (
        result["actions"][-1]["status"] == "held" and result["actions"][-1]["reason"] == "TRIFECTA"
    )
    assert gate["untrusted_witness"][-1] == "src:issue:42"
    assert gate["secret_witness"][-1].startswith("src:env:")
    assert [s["stopped"] for s in result["live"]["sessions"]] == ["done", "done", "finished"]
    assert all(s["rule_of_two"]["green"] for s in result["sessions"])  # still green per session


def test_a_benign_issue_is_released_clean(live_client):
    client, _ = live_client(FakeLlm(following_model))

    result = run_live(client, "benign_43")

    assert (result["actions"][-1]["status"], result["actions"][-1]["reason"]) == (
        "executed",
        "CLEAN",
    )


def test_the_sleeper_leaks_on_wednesday_through_monday_s_memory(live_client):
    client, _ = live_client(FakeLlm(following_model))

    result = run_live(client, "attack_sleeper_44")
    action = result["actions"][-1]["id"]
    explain = client.get(f"{BASE}/actions/{action}/explain").json()

    assert result["actions"][-1]["status"] == "held"
    assert {m["memory_key"] for m in explain["laundering"]} >= {"team_convention:42"}


def test_a_model_that_refuses_to_act_produces_no_action_and_no_leak(live_client):
    client, manager = live_client(FakeLlm(refusing_model))

    result = run_live(client, "attack_pipeline_42")

    assert result["actions"] == []  # Release never asked to post: nothing to gate
    assert manager.get("tinyqueue").sinks.posted("sink:public_release_page") == []
    assert {s["stopped"] for s in result["live"]["sessions"]} == {"done"}


# -------------------------------------------------- the loop (T3)
def test_invalid_json_gets_one_retry_and_then_the_session_continues(live_client):
    replies = ["I think I should fetch the issue", '{"done": true}']
    llm = FakeLlm(replies)
    client, _ = live_client(llm)

    result = client.post(
        f"{BASE}/scenarios/benign_43/run", json={"mode": "live", "guard": True}
    ).json()

    triage = result["live"]["sessions"][0]
    assert triage["stopped"] == "done" and triage["steps"] == 1
    assert llm.calls[1][-1] == {"role": "user", "content": "Reply with JSON only."}


def test_a_second_invalid_reply_stops_the_session():
    from api.agents.live import LiveAgents, SessionReport, ToolHandler

    agents = LiveAgents.__new__(LiveAgents)
    agents.llm = FakeLlm(["nope", "still nope"])
    agents.reports = []
    report = SessionReport("s-1", "triage")

    agents._run(report, "system", ToolHandler("triage", {}))

    assert report.stopped == "invalid_json" and agents.llm.stats.calls == 2


def test_a_reply_that_is_json_but_not_a_tool_call_counts_as_invalid():
    from api.agents.live import LiveAgents, SessionReport, ToolHandler

    agents = LiveAgents.__new__(LiveAgents)
    agents.llm = FakeLlm(['["fetch_issue"]', '{"hello": 1}'])
    agents.reports = []
    report = SessionReport("s-1", "triage")

    agents._run(report, "system", ToolHandler("triage", {}))

    assert report.stopped == "invalid_json"


def test_more_than_the_step_limit_stops_the_session(live_client):
    always_reads = FakeLlm(lambda m: '{"tool": "memory_read", "args": {"key": "task:43"}}')
    client, _ = live_client(always_reads)

    result = run_live(client, "benign_43")

    fixer = next(s for s in result["live"]["sessions"] if s["agent"] == "fixer")
    assert fixer["stopped"] == "max_steps" and fixer["steps"] == MAX_STEPS == 10


def test_a_tool_outside_the_agents_menu_is_refused_and_records_nothing(live_client, cypher):
    seen: list[str] = []

    def triage_tries_to_read_secrets(messages):
        seen.append(messages[-1]["content"])
        if len(seen) > 1:
            return '{"done": true}'
        return '{"tool": "read_env", "args": {"key": "PAYMENT_API_KEY"}}'

    client, manager = live_client(FakeLlm(triage_tries_to_read_secrets))

    run_live(client, "benign_43")

    assert any("TOOL RESULT read_env: ERROR: unknown tool" in m for m in seen)
    graph = manager.get("tinyqueue").graph
    assert cypher(graph)(
        "MATCH (:Artifact)-[:ORIGINATES_FROM]->(s:Source {trust:'secret'}) RETURN count(s)"
    ) == [[0]]


@pytest.mark.parametrize(
    "call",
    [
        '{"tool": "memory_write", "args": {"key": "k"}}',  # content missing
        '{"tool": "memory_write", "args": "nope"}',
        '{"tool": "fetch_issue", "args": {"number": "42"}}',  # wrong type
        '{"tool": "fetch_issue", "args": {"number": 9999}}',  # no such issue
        '{"tool": "memory_write", "args": {"key": "", "content": "x"}}',
    ],
)
def test_bad_tool_arguments_become_an_error_result_not_a_crash(live_client, call):
    answers = iter([call, '{"done": true}'])
    client, _ = live_client(FakeLlm(lambda m: next(answers, '{"done": true}')))

    result = run_live(client, "benign_43")

    assert result["live"]["sessions"][0]["stopped"] == "done"


def test_read_env_and_read_doc_only_accept_the_documented_values(live_client):
    seen: list[str] = []
    script = iter(
        [
            '{"tool": "read_env", "args": {"key": "HOME"}}',
            '{"tool": "read_doc", "args": {"name": "../../plan"}}',
            '{"done": true}',
        ]
    )

    def fixer_only(messages):
        seen.append(messages[-1]["content"])
        if messages[0]["content"].startswith("You are Fixer"):
            return next(script, '{"done": true}')
        return '{"done": true}'

    client, _ = live_client(FakeLlm(fixer_only))

    run_live(client, "benign_43")

    assert "TOOL RESULT read_env: ERROR: bad arguments" in seen
    assert "TOOL RESULT read_doc: ERROR: bad arguments" in seen


def test_an_llm_error_stops_only_that_session(live_client):
    def broken(messages):
        raise LlmError("provider down")

    client, _ = live_client(FakeLlm(broken))

    result = run_live(client, "benign_43")

    assert {s["stopped"] for s in result["live"]["sessions"]} == {"llm_error"}
    assert result["actions"] == []


def test_read_results_are_exactly_what_the_runtime_recorded(live_client):
    seen: list[str] = []

    def fixer_reads_memory(messages):
        seen.append(messages[-1]["content"])
        system = messages[0]["content"]
        if messages[0]["role"] == "user":
            return json.dumps(
                {"issue_id": 42, "component": "queue", "severity": "high", "kind": "bug"}
            )
        n = int(re.search(r"#(\d+)", system).group(1))
        if system.startswith("You are Triage") and len(_step_count(messages)) < 1:
            return json.dumps({"tool": "fetch_issue", "args": {"number": n}})
        if system.startswith("You are Triage") and len(_step_count(messages)) < 2:
            return json.dumps(
                {"tool": "memory_write", "args": {"key": "team_convention:42", "content": "C1"}}
            )
        if system.startswith("You are Fixer") and len(_step_count(messages)) < 1:
            return '{"tool": "memory_list", "args": {"prefix": "team_convention:"}}'
        return '{"done": true}'

    client, _ = live_client(FakeLlm(fixer_reads_memory))

    run_live(client, "attack_pipeline_42")

    listed = [m for m in seen if m.startswith("TOOL RESULT memory_list:")]
    assert json.loads(listed[0].split(": ", 1)[1]) == [
        {"key": "team_convention:42", "content": "C1"}
    ]


# -------------------------------------------------- extract_task is infrastructure (T4)
def test_extract_task_sends_only_the_raw_issue_text_and_the_triage_model_never_sees_it(live_client):
    llm = FakeLlm(following_model)
    client, manager = live_client(llm)

    run_live(client, "benign_43")

    extractor_calls = [c for c in llm.calls if c[0]["role"] == "user"]
    assert len(extractor_calls) == 1 and len(extractor_calls[0]) == 1
    prompt = extractor_calls[0][0]["content"]
    assert prompt == load_prompt("extractor", number=43, issue_text=FX.issue_text(43))
    triage_calls = [c for c in llm.calls if c[0]["content"].startswith("You are Triage")]
    assert not any("Extract structured" in m["content"] for c in triage_calls for m in c)


def test_an_invalid_extraction_leaves_no_sanitized_artifact(live_client, cypher):
    def model(messages):
        if messages[0]["role"] == "user":
            return '{"issue_id": 43, "component": "everything", "severity": "high", "kind": "bug"}'
        return following_model(messages)

    client, manager = live_client(FakeLlm(model))

    result = run_live(client, "benign_43")

    graph = manager.get("tinyqueue").graph
    assert cypher(graph)("MATCH (a:Artifact {kind:'sanitized'}) RETURN count(a)") == [[0]]
    fixer = next(s for s in result["live"]["sessions"] if s["agent"] == "fixer")
    assert fixer["stopped"] in {
        "done",
        "max_steps",
    }  # task:43 does not exist: the fixer sees an error


def test_extraction_for_another_issue_number_is_discarded(live_client, cypher):
    def model(messages):
        if messages[0]["role"] == "user":
            return '{"issue_id": 99, "component": "queue", "severity": "low", "kind": "bug"}'
        return following_model(messages)

    client, manager = live_client(FakeLlm(model))

    run_live(client, "benign_43")

    assert cypher(manager.get("tinyqueue").graph)(
        "MATCH (a:Artifact {kind:'sanitized'}) RETURN count(a)"
    ) == [[0]]


# ---------------------------------------- quarantine reaches live agents (only via the runtime)
def test_after_forensics_a_live_fixer_no_longer_sees_the_poisoned_memory(live_client):
    client, _ = live_client(FakeLlm(following_model))
    action = run_live(client, "attack_pipeline_42")["actions"][-1]["id"]
    control = client.post(
        f"{BASE}/scenarios/benign_43/run", json={"mode": "live", "reset": False}
    ).json()
    assert control["actions"][-1]["status"] == "held"  # the stored convention poisons issue 43 too
    client.post(f"{BASE}/forensics/{action}", json={})

    result = client.post(
        f"{BASE}/scenarios/benign_43/run", json={"mode": "live", "reset": False}
    ).json()

    assert result["actions"][-1]["status"] == "executed"  # the convention is quarantined: clean


# -------------------------------------------------- no key: nothing live
def test_without_a_key_live_mode_and_the_llm_forensic_mode_answer_501(client):
    live = client.post(f"{BASE}/scenarios/benign_43/run", json={"mode": "live"})
    forensic = client.post(f"{BASE}/forensics/act-0001", json={"mode": "llm"})

    assert (live.status_code, live.json()["error"]) == (501, "live_not_available")
    assert forensic.status_code in (404, 501)


def test_make_llm_returns_none_without_a_key_and_the_model_default_is_groq():
    assert make_llm(Settings()) is None
    model = make_llm(Settings(llm_api_key="gsk_" + "a" * 40))
    assert isinstance(model, LiteLlm) and model.model == "groq/qwen/qwen3.8-27b"


# -------------------------------------------------- the provider seam
class _Response:
    def __init__(self, text: str = "ok"):
        self.choices = [type("C", (), {"message": type("M", (), {"content": text})()})()]
        self.usage = type("U", (), {"prompt_tokens": 7, "completion_tokens": 3})()


def test_litellm_is_called_with_the_probed_arguments_and_usage_is_counted(monkeypatch):
    import litellm

    captured = {}

    def fake_completion(**kwargs):
        captured.update(kwargs)
        return _Response("hello")

    monkeypatch.setattr(litellm, "completion", fake_completion)
    llm = LiteLlm(Settings(llm_api_key="gsk_" + "a" * 40, llm_temperature=0.0))

    assert llm.complete([{"role": "user", "content": "hi"}]) == "hello"

    assert captured["model"] == "groq/qwen/qwen3.8-27b" and captured["temperature"] == 0.0
    assert "reasoning_effort" not in captured and captured["max_tokens"] >= 1024
    assert llm.stats.as_dict() == {"calls": 1, "prompt_tokens": 7, "completion_tokens": 3}


def test_rate_limits_are_retried_then_reported_without_the_key(monkeypatch, caplog):
    import litellm

    key = "gsk_" + "s" * 40

    class RateLimitError(Exception):
        pass

    attempts = []

    def failing(**kwargs):
        attempts.append(1)
        raise RateLimitError(f"too many requests for {kwargs['api_key']}")

    monkeypatch.setattr(litellm, "completion", failing)
    monkeypatch.setattr("api.llm.time.sleep", lambda s: None)
    caplog.set_level(logging.DEBUG)
    llm = LiteLlm(Settings(llm_api_key=key))

    with pytest.raises(LlmError) as raised:
        llm.complete([{"role": "user", "content": "hi"}])

    from api.llm import RETRIES

    assert len(attempts) == RETRIES
    assert key not in str(raised.value) and key not in caplog.text
    assert "RateLimitError" in str(raised.value)


def test_a_rate_limit_that_clears_succeeds(monkeypatch):
    import litellm

    class RateLimitError(Exception):
        pass

    calls = []

    def flaky(**kwargs):
        calls.append(1)
        if len(calls) < 3:
            raise RateLimitError("slow down")
        return _Response("fine")

    monkeypatch.setattr(litellm, "completion", flaky)
    monkeypatch.setattr("api.llm.time.sleep", lambda s: None)

    assert LiteLlm(Settings(llm_api_key="gsk_" + "a" * 40)).complete([]) == "fine"
    assert len(calls) == 3


def test_a_bad_request_is_not_retried(monkeypatch):
    import litellm

    class BadRequestError(Exception):
        pass

    calls = []

    def bad(**kwargs):
        calls.append(1)
        raise BadRequestError("invalid key")

    monkeypatch.setattr(litellm, "completion", bad)

    with pytest.raises(LlmError):
        LiteLlm(Settings(llm_api_key="gsk_" + "a" * 40)).complete([])
    assert len(calls) == 1


def test_the_key_never_appears_in_the_settings_repr_or_dump_to_logs():
    key = "gsk_" + "z" * 40
    settings = Settings.from_env({"PW_LLM_API_KEY": key, "PW_LLM_MODEL": "groq/x"})

    assert key not in repr(settings) and key not in str(settings)
    assert settings.llm_api_key == key and settings.llm_model == "groq/x"


def test_json_replies_may_be_wrapped_in_one_code_fence():
    assert parse_json_reply('```json\n{"done": true}\n```') == {"done": True}
    assert parse_json_reply('  {"tool": "x", "args": {}} ') == {"tool": "x", "args": {}}
    with pytest.raises(ValueError):
        parse_json_reply("not json")


def test_the_prompt_folder_is_part_of_the_package_files():
    assert Path(PROMPTS / "forensic.txt").is_file()


def test_a_token_budget_paces_calls_instead_of_burning_retries(monkeypatch):
    import litellm

    clock = {"now": 1000.0}
    sleeps: list[float] = []

    class Big(_Response):
        def __init__(self):
            super().__init__("ok")
            self.usage = type("U", (), {"prompt_tokens": 900, "completion_tokens": 50})()

    def advance(seconds):
        sleeps.append(seconds)
        clock["now"] += seconds

    monkeypatch.setattr(litellm, "completion", lambda **kw: Big())
    monkeypatch.setattr("api.llm.time.sleep", advance)
    monkeypatch.setattr("api.llm.time.monotonic", lambda: clock["now"])
    llm = LiteLlm(Settings(llm_api_key="gsk_" + "a" * 40, llm_tpm=1000))

    llm.complete([{"role": "user", "content": "x" * 30}])  # empty window: no wait
    assert sleeps == []
    llm.complete([{"role": "user", "content": "x" * 30}])  # 950 tokens used in the last minute

    assert sleeps and sleeps[0] >= 1.0 and sum(sleeps) <= 61
    assert llm.stats.calls == 2


def test_the_tpm_setting_comes_from_the_environment():
    assert Settings.from_env({"PW_LLM_TPM": "5500"}).llm_tpm == 5500
    assert Settings().llm_tpm == 0
