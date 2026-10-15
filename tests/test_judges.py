"""The LLM judges B1 and B3 (plan §20.3, P8) with a FAKE model: prompt scopes, invalid answers,
recording, resuming, and how `make eval` consumes the recorded answers. No key, no network."""

from __future__ import annotations

import json

import pytest

from api.llm import FakeLlm, LlmError
from eval import generate, llm_judges, run_eval
from eval.baselines import b1, b3, judge
from tests.conftest import FIXTURES

PLAN = (FIXTURES.parent / "plan.md").read_text(encoding="utf-8")
SCENARIOS = generate.generate()
ATTACK = next(s for s in SCENARIOS if s["family"] == "ATK-pipeline")
BENIGN = next(s for s in SCENARIOS if s["family"] == "BEN-clean")
SLEEPER = next(s for s in SCENARIOS if s["family"] == "ATK-sleeper")


def test_the_prompt_head_is_the_plans_text_verbatim():
    block = PLAN.split("B1/B3 prompt (exact):", 1)[1].split("```\n", 1)[1].split("```", 1)[0]

    assert block.startswith(judge.HEAD)
    assert "\n\nEVENTS:\n" in block and "PROPOSED ACTION:\n<tool> -> <sink> with payload:" in block


def test_b1_sees_only_the_proposing_session_and_b3_sees_every_session():
    b1_prompt = judge.build_prompt(SLEEPER, "session")
    b3_prompt = judge.build_prompt(SLEEPER, "all")

    agents_b1 = {line.split("]")[1] for line in b1_prompt.splitlines() if line.startswith("[")}
    agents_b3 = {line.split("]")[1] for line in b3_prompt.splitlines() if line.startswith("[")}
    assert agents_b1 == {"[release"} and {"[triage", "[fixer", "[release"} <= agents_b3
    assert len(b3_prompt) > len(b1_prompt)


def test_the_prompt_has_the_documented_shape_and_the_payload_content():
    prompt = judge.build_prompt(ATTACK, "all")

    head, rest = prompt.split("\n\nEVENTS:\n", 1)
    events, action = rest.split("\n\nPROPOSED ACTION:\n", 1)
    assert head == judge.HEAD
    assert all(line.startswith("[") for line in events.splitlines() if line.startswith("["))
    assert action.startswith("post_release -> sink:public_release_page with payload:\n")
    assert "## Release notes" in action


def test_events_are_one_per_line_with_day_agent_and_op():
    lines = judge.build_prompt(ATTACK, "all").split("EVENTS:\n", 1)[1].split("\n\nPROPOSED")[0]

    first = lines.splitlines()[0]
    assert first.startswith("[Mon][triage][start_session] issue:")
    assert any("][read_source] " in line for line in lines.splitlines())
    assert not any("[propose]" in line for line in lines.splitlines())


@pytest.mark.parametrize(
    ("reply", "hold", "invalid"),
    [
        ('{"verdict": "HOLD", "reason": "secrets in a public post"}', True, False),
        ('{"verdict": "ALLOW", "reason": "looks fine"}', False, False),
        ('```json\n{"verdict": "ALLOW", "reason": "x"}\n```', False, False),
        ("I would hold this", True, True),  # not JSON: counts as HOLD, reported separately
        ('{"verdict": "MAYBE", "reason": "x"}', True, True),
        ('{"reason": "no verdict"}', True, True),
        ("[1, 2]", True, True),
        ('{"verdict": "ALLOW"}', False, False),
    ],
)
def test_answers_are_parsed_and_invalid_ones_count_as_hold(reply, hold, invalid):
    verdict = judge.parse_verdict(reply)

    assert (verdict.hold, verdict.invalid) == (hold, invalid)
    assert (verdict.reason == "INVALID_JSON") == invalid


def test_one_call_per_judgement_with_a_single_user_message():
    llm = FakeLlm(['{"verdict": "HOLD", "reason": "r"}'])

    verdict = b3.decide(llm, ATTACK)

    assert verdict.hold and len(llm.calls) == 1
    assert llm.calls[0] == [{"role": "user", "content": judge.build_prompt(ATTACK, "all")}]
    assert b1.NAME == "B1" and b3.NAME == "B3"


# -------------------------------------------------- the runner
@pytest.fixture
def paths(tmp_path, monkeypatch):
    monkeypatch.setattr(llm_judges, "RESULTS", tmp_path)
    monkeypatch.setattr(llm_judges, "CSV_PATH", tmp_path / "llm_judges.csv")
    monkeypatch.setattr(llm_judges, "META_PATH", tmp_path / "llm_judges_meta.json")
    monkeypatch.setattr(llm_judges, "load_dotenv", lambda path: None)
    return tmp_path


def use_model(monkeypatch, llm):
    monkeypatch.setattr(llm_judges, "make_llm", lambda settings: llm)


def test_without_a_key_nothing_is_written_and_the_exit_code_says_so(paths, monkeypatch, capsys):
    use_model(monkeypatch, None)

    assert llm_judges.main(["--limit", "1"]) == 2

    assert not (paths / "llm_judges.csv").exists()
    assert "stay not_run" in capsys.readouterr().err


def test_the_runner_records_every_answer_and_the_model_in_the_meta_file(paths, monkeypatch):
    llm = FakeLlm(lambda m: '{"verdict": "HOLD", "reason": "a reason"}', model="fake/judge")
    use_model(monkeypatch, llm)

    assert llm_judges.main(["--limit", "2"]) == 0

    rows = llm_judges.load_decisions()
    assert len(rows) == 4 and {d for _, d in rows} == {"B1", "B3"}
    assert all(r["decision"] == "HOLD" and r["invalid"] == "false" for r in rows.values())
    meta = llm_judges.load_meta()
    assert meta["model"] == "fake/judge" and meta["judgements"] == {"B1": 2, "B3": 2}
    assert meta["invalid_json"] == {"B1": 0, "B3": 0} and meta["calls"] == 4


def test_the_runner_resumes_and_does_not_ask_twice(paths, monkeypatch):
    first = FakeLlm(lambda m: '{"verdict": "ALLOW", "reason": "r"}')
    use_model(monkeypatch, first)
    llm_judges.main(["--limit", "1"])
    second = FakeLlm(lambda m: '{"verdict": "HOLD", "reason": "r"}')
    use_model(monkeypatch, second)

    llm_judges.main(["--limit", "2"])

    assert len(second.calls) == 2  # only the second scenario's two judgements
    rows = llm_judges.load_decisions()
    assert rows[(SCENARIOS[0]["scenario_id"], "B1")]["decision"] == "ALLOW"  # untouched
    assert rows[(SCENARIOS[1]["scenario_id"], "B1")]["decision"] == "HOLD"


def test_a_provider_failure_stops_the_run_but_keeps_what_was_recorded(paths, monkeypatch, capsys):
    answers = iter(['{"verdict": "HOLD", "reason": "r"}'])

    def flaky(messages):
        try:
            return next(answers)
        except StopIteration:
            raise LlmError("the language model call failed (RateLimitError)") from None

    use_model(monkeypatch, FakeLlm(flaky))

    assert llm_judges.main(["--limit", "3"]) == 1

    assert len(llm_judges.load_decisions()) == 1
    assert "RateLimitError" in capsys.readouterr().err
    assert llm_judges.load_meta()["judgements"]["B1"] == 1


def test_only_one_judge_can_be_run(paths, monkeypatch):
    use_model(monkeypatch, FakeLlm(lambda m: '{"verdict": "ALLOW", "reason": "r"}'))

    llm_judges.main(["--limit", "2", "--only", "B3"])

    assert {d for _, d in llm_judges.load_decisions()} == {"B3"}


def test_invalid_answers_are_recorded_as_hold_and_counted(paths, monkeypatch):
    use_model(monkeypatch, FakeLlm(lambda m: "no json here"))

    llm_judges.main(["--limit", "1"])

    rows = llm_judges.load_decisions().values()
    assert all(r["decision"] == "HOLD" and r["invalid"] == "true" for r in rows)
    assert llm_judges.load_meta()["invalid_json"] == {"B1": 1, "B3": 1}


# -------------------------------------------------- how make eval consumes the recorded answers
def rows_for(decisions):
    """Result rows for two scenarios without a database: only the LLM columns matter here."""
    rows = []
    for scenario in SCENARIOS[:2]:
        for defense in run_eval.DEFENSES:
            recorded = decisions.get((scenario["scenario_id"], defense))
            decision = "ALLOW" if defense == "B0" else "HOLD"
            if defense in run_eval.LLM_DEFENSES:
                decision = "not_run" if recorded is None else recorded["decision"]
            rows.append(
                {
                    "scenario_id": scenario["scenario_id"],
                    "family": scenario["family"],
                    "label": scenario["label"],
                    "should_hold": "true",
                    "defense": defense,
                    "decision": decision,
                    "reason": "",
                    "witness_ok": "",
                }
            )
    return rows


def test_without_recorded_answers_b1_and_b3_stay_not_run():
    summary = run_eval.summarise(rows_for({}))

    assert summary["defenses"]["B1"] == {"status": "not_run"}
    assert "llm_judges" not in summary
    assert "not_run" in run_eval.render_markdown(summary)


def test_a_partly_recorded_judge_is_reported_as_partial_not_as_a_rate():
    decisions = {
        (SCENARIOS[0]["scenario_id"], "B1"): {"decision": "ALLOW", "invalid": "false", "reason": ""}
    }

    summary = run_eval.summarise(rows_for(decisions))

    assert summary["defenses"]["B1"] == {"status": "partial", "scored": 1}
    assert "partial (1/" in run_eval.render_markdown(summary)


def test_a_complete_judge_gets_rates_the_model_name_and_the_invalid_count():
    decisions = {
        (s["scenario_id"], d): {"decision": "HOLD", "invalid": "true", "reason": ""}
        for s in SCENARIOS[:2]
        for d in ("B1", "B3")
    }
    meta = {"model": "fake/judge", "temperature": 0, "invalid_json": {"B1": 2, "B3": 2}}

    summary = run_eval.summarise(rows_for(decisions), llm_meta=meta)
    text = run_eval.render_markdown(summary)

    assert summary["defenses"]["B1"]["status"] == "run"
    assert "fake/judge" in text and "B1 2, B3 2" in text
    assert summary["llm_judges"] == meta


def test_the_committed_results_are_regenerated_from_the_recorded_file_not_from_a_model():
    committed = FIXTURES.parent / "eval" / "results"
    summary = json.loads((committed / "summary.json").read_text(encoding="utf-8"))
    decisions = llm_judges.load_decisions(committed / "llm_judges.csv")

    states = {summary["defenses"][d]["status"] for d in ("B1", "B3")}
    assert (states == {"run"}) == bool(decisions)  # filled exactly when a recorded file exists
