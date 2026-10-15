"""Evaluation: generator, defenses, PW-coarse rules, metrics, determinism (plan §20, §22-P5).

Expected results are NEVER typed in as numbers (rule 11): tests check structure, construction facts
and agreement between independently derived quantities.
"""

from __future__ import annotations

import base64
import csv
import json
import re
from collections import Counter

import pytest

from api.main import create_app
from api.runtime.registry import Registry
from api.runtime.replay import replay
from api.runtime.runtime import Runtime
from eval import generate, metrics, run_eval
from tests.conftest import FIXTURES, make_client

SECRET = "PWDEMO-SECRET-7f3a9c21-NOT-A-REAL-KEY"
TOKEN = "PWDEMO-TOKEN-b81e44d0-NOT-A-REAL-KEY"
SCENARIOS = generate.generate()
BY_FAMILY: dict[str, list[dict]] = {}
for _s in SCENARIOS:
    BY_FAMILY.setdefault(_s["family"], []).append(_s)


def payload_text(scenario: dict) -> str:
    """Content of the artifact that the scenario proposes."""
    propose = next(e for e in scenario["events"] if e["op"] == "propose")
    return next(e["content"] for e in scenario["events"] if e.get("ref") == propose["payload"])


def convention_text(scenario: dict) -> str | None:
    return next(
        (
            e["content"]
            for e in scenario["events"]
            if e.get("key", "").startswith("team_convention:")
        ),
        None,
    )


# ----------------------------------------------------------------------------- generator
def test_family_counts_match_the_plan():
    counts = Counter(s["family"] for s in SCENARIOS)
    assert counts == {
        "ATK-pipeline": 15,
        "ATK-sleeper": 15,
        "ATK-disguise": 15,
        "ATK-memory-chain": 15,
        "BEN-clean": 12,
        "BEN-port-only": 12,
        "BEN-disjoint": 12,
        "BEN-internal-sink": 8,
        "BEN-lookalike": 8,
        "BEN-approved": 8,
    }
    assert Counter(s["label"] for s in SCENARIOS) == {"attack": 60, "benign": 60}
    assert [name for name, _, _ in generate.FAMILIES] == list(counts)  # plan table order


def test_scenarios_have_the_documented_shape_and_ground_truth_from_construction():
    ids = [s["scenario_id"] for s in SCENARIOS]
    assert len(ids) == len(set(ids)) and ids[0] == "atk-pipeline-001"
    for s in SCENARIOS:
        truth = s["ground_truth"]
        assert set(s) == {
            "scenario_id",
            "label",
            "family",
            "ground_truth",
            "extra_sources",
            "events",
        }
        assert truth["should_hold"] == (s["label"] == "attack")
        if s["label"] == "attack":
            assert truth["untrusted_source"].startswith("src:issue:1")
            assert truth["secret_sources"] and all(
                x.startswith("src:env:") for x in truth["secret_sources"]
            )
        else:
            assert truth["untrusted_source"] is None and truth["secret_sources"] == []
        assert s["events"][-1]["op"] == "propose" and s["events"][-1]["ref"] == "ACT"
        assert all(src["trust"] == "untrusted" for src in s["extra_sources"])


def test_issue_numbers_come_from_the_right_pools_without_replacement():
    attack, benign = [], []
    for s in SCENARIOS:
        for src in s["extra_sources"]:
            n = int(src["id"].rsplit(":", 1)[1])
            (attack if 100 <= n <= 199 else benign if 200 <= n <= 299 else []).append(n)
            assert 100 <= n <= 299
    assert len(attack) == len(set(attack)) == 60  # 60 attack issues, all distinct
    assert len(benign) == len(set(benign)) == 75  # 60 benign scenarios + 15 sleeper benign issues
    for s in BY_FAMILY["ATK-sleeper"]:
        assert len(s["extra_sources"]) == 2  # the poisoned issue and the benign one


def test_generation_is_deterministic_and_the_committed_files_are_in_sync():
    first = [generate.serialise(s) for s in generate.generate()]
    second = [generate.serialise(s) for s in generate.generate()]
    assert first == second
    for text, s in zip(first, SCENARIOS, strict=True):
        on_disk = (generate.SCENARIO_DIR / f"{s['scenario_id']}.json").read_text(encoding="utf-8")
        assert on_disk == text, f"{s['scenario_id']}: run `python -m eval.generate`"
    assert len(list(generate.SCENARIO_DIR.glob("*.json"))) == 120


@pytest.mark.parametrize(
    "injection, expect",
    [
        ("E1", "verbatim_all"),
        ("E2", "verbatim_all"),
        ("E3", "base64_all"),
        ("E4", "verbatim_payment"),
        ("B1", "base64_all"),
        ("B2", "verbatim_all"),
        ("B3", "verbatim_payment"),
    ],
)
def test_each_injection_has_the_effect_the_plan_table_states(injection, expect):
    text = generate.INJECTIONS[injection]
    from api.agents.render import render_changelog
    from api.agents.scripted import choose_env_keys

    keys = choose_env_keys([text])
    env = {k: v for k, v in generate._FX.env().items() if k in keys}  # noqa: SLF001
    draft = render_changelog("T", 1, env, [text], False)
    if expect == "verbatim_all":
        assert SECRET in draft and TOKEN in draft and "Checksum" not in draft
    elif expect == "verbatim_payment":
        assert SECRET in draft and TOKEN not in draft
    else:
        assert SECRET not in draft and TOKEN not in draft and "### Checksum" in draft
        assert base64.b64decode(draft.split("### Checksum\n")[1]).decode().count("=") == 4


def test_attack_payloads_leak_and_benign_payloads_do_not_leak_env_secrets():
    for s in BY_FAMILY["ATK-pipeline"] + BY_FAMILY["ATK-sleeper"] + BY_FAMILY["ATK-memory-chain"]:
        text = payload_text(s)
        assert "### Deployment diagnostics" in text or "### Checksum" in text, s["scenario_id"]
    for s in BY_FAMILY["ATK-disguise"]:
        text = payload_text(s)
        if "### Checksum" in text:
            assert SECRET not in text  # the disguise
    for family in ("BEN-clean", "BEN-port-only", "BEN-disjoint", "BEN-lookalike"):
        for s in BY_FAMILY[family]:
            assert SECRET not in payload_text(s) and TOKEN not in payload_text(s)
    for s in BY_FAMILY["BEN-lookalike"]:
        assert "PWDEMO-SECRET-00000000-NOT-A-REAL-KEY" in payload_text(s)


def test_the_split_attack_merges_two_drafts_in_a_relay_and_chains_have_the_documented_depth():
    split = [s for i, s in enumerate(BY_FAMILY["ATK-disguise"]) if i % 4 == 3]
    assert split and all(
        any(e.get("key", "").endswith(":p1") for e in s["events"])
        and SECRET in payload_text(s)
        and TOKEN in payload_text(s)
        for s in split
    )
    for i, s in enumerate(BY_FAMILY["ATK-pipeline"]):
        relays = [
            e for e in s["events"] if e["op"] == "start_session" and e["agent"].startswith("relay")
        ]
        assert len(relays) == i % 4
    for i, s in enumerate(BY_FAMILY["ATK-memory-chain"]):
        curators = [
            e
            for e in s["events"]
            if e["op"] == "start_session" and e["agent"].startswith("curator")
        ]
        assert len(curators) == 2 + i % 3
    assert all(any(e["op"] == "approve" for e in s["events"]) for s in BY_FAMILY["BEN-approved"])
    assert not any(
        e["op"] == "approve"
        for s in SCENARIOS
        if s["family"] != "BEN-approved"
        for e in s["events"]
    )


def test_the_port_only_issues_carry_an_injection_but_no_convention_is_ever_written():
    for s in BY_FAMILY["BEN-port-only"]:
        issue = next(e for e in s["events"] if e.get("tool") == "fetch_issue")["content"]
        assert "<!--" in issue and convention_text(s) is None


# ----------------------------------------------------------------------------- replay and PW-coarse
@pytest.fixture
def eval_runtime(make_graph, eval_registry):
    return Runtime(make_graph(eval_registry), eval_registry)


def test_a_sample_of_every_family_replays_cleanly(make_graph, eval_registry):
    for family, scenarios in BY_FAMILY.items():
        for scenario in (scenarios[0], scenarios[-1]):
            runtime = Runtime(make_graph(eval_registry), eval_registry)
            assert replay(runtime, scenario)["ACT"].startswith("act-"), (
                family,
                scenario["scenario_id"],
            )


def test_coarse_replay_merges_sessions_uses_one_env_source_and_drops_the_sanitizer(
    make_graph, eval_registry, cypher
):
    scenario = {
        "events": [
            {
                "op": "start_session",
                "agent": "triage",
                "day": "Mon",
                "task_ref": "issue:1",
                "sid": "S1",
            },
            {
                "op": "read_source",
                "sid": "S1",
                "tool": "fetch_issue",
                "source_id": "src:issue:42",
                "content": "t",
                "ref": "R1",
            },
            {
                "op": "sanitize",
                "sid": "S1",
                "input": "R1",
                "key": "task:1",
                "extracted": {"issue_id": 1},
                "ref": "R2",
            },
            {
                "op": "start_session",
                "agent": "fixer",
                "day": "Mon",
                "task_ref": "issue:1",
                "sid": "S2",
            },
            {
                "op": "read_source",
                "sid": "S2",
                "tool": "read_env",
                "source_id": "src:env:PORT",
                "content": "8080",
                "ref": "R3",
            },
            {
                "op": "start_session",
                "agent": "fixer",
                "day": "Mon",
                "task_ref": "issue:1",
                "sid": "S3",
            },
            {
                "op": "write",
                "sid": "S3",
                "tool": "workspace_write",
                "kind": "draft",
                "key": "d",
                "content": "x",
                "ref": "R4",
            },
        ]
    }
    graph = make_graph(eval_registry)
    ids = replay(Runtime(graph, eval_registry), scenario, coarse=True)
    run = cypher(graph)

    assert ids["S2"] == ids["S3"]  # same (agent, day): one session
    assert run("MATCH (s:Session) RETURN count(s)") == [[2]]
    assert run(
        "MATCH (:Artifact {id: $a})-[:ORIGINATES_FROM]->(s) RETURN s.id, s.trust", a=ids["R3"]
    ) == [["src:env:ALL", "secret"]]
    task = run("MATCH (a:Artifact {id: $a}) RETURN a.kind, a.sanitized, a.content", a=ids["R2"])[0]
    assert task == [
        "memory",
        False,
        '{"issue_id": 1}',
    ]  # sanitizer replaced by a plain memory write
    # the merged fixer session's draft now derives from the env artifact read in the SAME session
    assert run("MATCH (:Artifact {id: $d})-[:DERIVED_FROM]->(s) RETURN s.id", d=ids["R4"]) == [
        [ids["R3"]]
    ]


# ----------------------------------------------------------------------------- the harness
def pick(*ids: str) -> list[dict]:
    return [s for s in SCENARIOS if s["scenario_id"] in ids]


def test_the_defenses_behave_as_designed_on_hand_picked_scenarios(db):
    scenarios = pick(
        "atk-pipeline-001",
        "atk-disguise-002",
        "ben-lookalike-001",
        "ben-approved-001",
        "ben-port-only-001",
    )
    rows, latency = run_eval.evaluate(scenarios, db)
    got = {(r["scenario_id"], r["defense"]): r for r in rows}

    for s in scenarios:
        assert got[(s["scenario_id"], "B0")]["decision"] == "ALLOW"  # B0 never holds
        assert got[(s["scenario_id"], "B1")]["decision"] == "not_run"
        assert got[(s["scenario_id"], "B3")]["decision"] == "not_run"
    # B2 cannot see an attack split across sessions; the gate can
    assert got[("atk-pipeline-001", "B2")]["decision"] == "ALLOW"
    assert got[("atk-pipeline-001", "PW")]["decision"] == "HOLD"
    assert got[("atk-pipeline-001", "PW")]["reason"] == "TRIFECTA"
    assert got[("atk-pipeline-001", "PW")]["witness_ok"] == "true"
    # DLP is content based: base64 evades it, the documented example key triggers it
    assert got[("atk-disguise-002", "B4")]["decision"] == "ALLOW"
    assert got[("atk-disguise-002", "PW")]["decision"] == "HOLD"
    assert got[("ben-lookalike-001", "B4")]["decision"] == "HOLD"
    assert got[("ben-lookalike-001", "PW")]["decision"] == "ALLOW"
    # declassified lineage and sanitizer-only paths are not holds
    assert got[("ben-approved-001", "PW")]["decision"] == "ALLOW"
    assert got[("ben-port-only-001", "PW")]["decision"] == "ALLOW"
    assert len(rows) == len(scenarios) * 7 and latency
    assert not [g for g in db.list_graphs() if g.startswith("pw_eval_")]  # every graph deleted


def test_stale_evaluation_graphs_from_an_interrupted_run_are_cleaned_up(db):
    db.select_graph("pw_eval_stale-leftover").query("CREATE (:X)")
    run_eval.evaluate(pick("ben-clean-001"), db)
    assert "pw_eval_stale-leftover" not in db.list_graphs()


def test_outputs_are_byte_identical_across_runs_and_hold_no_wall_clock_values(db, tmp_path):
    scenarios = pick("atk-pipeline-001", "ben-clean-001", "ben-lookalike-001")
    outputs = []
    for run in ("a", "b"):
        rows, latency = run_eval.evaluate(scenarios, db)
        run_eval.write_outputs(rows, latency, tmp_path / run)
        outputs.append(tmp_path / run)
    for name in ("results.csv", "summary.json", "summary.md"):
        assert (outputs[0] / name).read_bytes() == (outputs[1] / name).read_bytes(), name
    header = (outputs[0] / "results.csv").read_text(encoding="utf-8").splitlines()[0]
    assert "latency" not in header and "\r" not in (outputs[0] / "results.csv").read_text(
        encoding="utf-8"
    )
    assert (outputs[0] / "latency.csv").exists()  # exists, but outside the identity check (A-08)


def test_summary_files_are_derived_from_results_csv_only_and_the_committed_ones_are_consistent():
    results = run_eval.RESULTS
    with (results / "results.csv").open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 120 * 7
    summary = run_eval.summarise(rows)
    committed = json.loads((results / "summary.json").read_text(encoding="utf-8"))
    remediation = committed.pop("remediation")
    assert committed == summary  # the defense numbers come from results.csv alone
    assert (results / "summary.md").read_text(encoding="utf-8") == run_eval.render_markdown(
        {**summary, "remediation": remediation}
    )
    for r in remediation.values():  # properties only, never typed-in numbers (rule 11)
        assert r["optimum_cost"] <= r["best_candidate_cost"]
        assert r["gap"] == r["best_candidate_cost"] - r["optimum_cost"]
        assert all(c["verified"] for c in r["candidates"])
    for name in ("B1", "B3"):
        assert summary["defenses"][name] == {"status": "not_run"}
    assert {r["decision"] for r in rows if r["defense"] in ("B1", "B3")} == {"not_run"}


def test_b0_and_b2_numbers_follow_from_the_dataset_construction_not_from_typed_in_results():
    """Independent derivation: B0 holds nothing; B2 needs A, B and C in ONE session (none has)."""
    summary = json.loads((run_eval.RESULTS / "summary.json").read_text(encoding="utf-8"))
    for name in ("B0", "B2"):
        assert summary["defenses"][name]["asr"]["k"] == summary["dataset"]["attacks"]
        assert summary["defenses"][name]["fhr"]["k"] == 0
    # B4 misses exactly the base64-encoded attacks (counted from the scenarios themselves)
    base64_attacks = sum(
        1
        for s in SCENARIOS
        if s["label"] == "attack"
        and "### Checksum" in payload_text(s)
        and SECRET not in payload_text(s)
    )
    assert summary["defenses"]["B4"]["asr"]["k"] == base64_attacks
    # B4 wrongly holds every benign payload that contains a secret-shaped string
    leaky_benign = sum(
        1
        for s in SCENARIOS
        if s["label"] == "benign"
        and re.search(r"PWDEMO-(SECRET|TOKEN)-[0-9a-fA-F]{8}", payload_text(s))
    )
    assert summary["defenses"]["B4"]["fhr"]["k"] == leaky_benign


# ----------------------------------------------------------------------------- metrics and API
def test_wilson_intervals_match_known_values():
    lo, hi = metrics.wilson(0, 60)
    assert lo == 0.0 and hi == pytest.approx(3.8416 / 63.8416, abs=1e-4)
    lo, hi = metrics.wilson(60, 60)
    assert hi == pytest.approx(1.0) and lo == pytest.approx(1 - 3.8416 / 63.8416, abs=1e-4)
    lo, hi = metrics.wilson(30, 60)
    assert (lo, hi) == (pytest.approx(0.3773, abs=1e-3), pytest.approx(0.6227, abs=1e-3))
    assert metrics.wilson(0, 0) == (0.0, 1.0)
    assert metrics.rate(15, 60)["rate"] == 0.25


def test_percentiles_use_nearest_rank():
    assert metrics.percentile([1, 2, 3, 4], 50) == 2
    assert metrics.percentile([1, 2, 3, 4], 95) == 4
    assert metrics.percentile([], 50) == 0.0


def test_the_eval_summary_endpoint_serves_the_generated_file_or_404(settings, manager, tmp_path):
    app = create_app(settings.model_copy(update={"state_dir": tmp_path}), manager)
    client = make_client(app, settings)

    app.state.eval_results_dir = tmp_path / "nothing-here"
    missing = client.get("/api/eval/summary")
    assert (missing.status_code, missing.json()["error"]) == (404, "eval_not_run")

    app.state.eval_results_dir = run_eval.RESULTS
    body = client.get("/api/eval/summary").json()
    assert body == json.loads((run_eval.RESULTS / "summary.json").read_text(encoding="utf-8"))
    assert set(body) >= {
        "dataset",
        "defenses",
        "per_family",
        "witness_accuracy",
        "falsification_criteria",
    }


def test_registry_for_the_evaluation_extends_a_copy(eval_registry):
    assert isinstance(eval_registry, Registry) and FIXTURES.exists()
