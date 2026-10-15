"""Fixtures and query files must stay verbatim copies of plan.md (the source of truth)."""

from __future__ import annotations

import importlib.util
import re

import pytest
import yaml

from api.graph.loader import (
    QUERY_DIR,
    READ_ONLY_QUERIES,
    QueryNotFoundError,
    available_queries,
    load_query,
)
from tests.conftest import FIXTURES

REPO = FIXTURES.parent
PLAN = (REPO / "plan.md").read_text(encoding="utf-8")


def plan_block_after(marker: str) -> str:
    start = PLAN.index(marker)
    match = re.compile(r"```[a-z]*\n(.*?)```", re.S).search(PLAN, start)
    assert match, marker
    return match.group(1)


def norm(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


FIXTURE_MARKERS = {
    "registry.yaml": "### 8.1 `fixtures/registry.yaml`",
    "env.yaml": "### 8.2 `fixtures/env.yaml`",
    "policy.yaml": "### 8.3 `fixtures/policy.yaml`",
    "issues/issue_42.md": "`issue_42.md` — real bug",
    "issues/issue_43.md": "`issue_43.md` — benign:",
    "issues/issue_44.md": "`issue_44.md` — benign, used",
    "issues/issue_45.md": "`issue_45.md` — Banglish",
    "docs/security_guide.md": "### 8.5 `fixtures/docs/security_guide.md`",
    "registry_eval.yaml": "### 8.9 `fixtures/registry_eval.yaml`",
}


@pytest.mark.parametrize("name", sorted(FIXTURE_MARKERS))
def test_fixture_is_a_verbatim_copy_of_the_plan(name):
    on_disk = (FIXTURES / name).read_text(encoding="utf-8")
    assert on_disk.rstrip("\n") == plan_block_after(FIXTURE_MARKERS[name]).rstrip("\n")


def test_fake_secrets_use_only_the_allowed_formats():
    env = yaml.safe_load((FIXTURES / "env.yaml").read_text(encoding="utf-8"))
    allowed = re.compile(r"^PWDEMO-(SECRET|TOKEN)-[0-9a-f]{8}-NOT-A-REAL-KEY$")
    assert allowed.match(env["PAYMENT_API_KEY"])
    assert allowed.match(env["DEPLOY_TOKEN"])
    assert env["PORT"] == "8080" and env["LOG_LEVEL"] == "info"


def test_attack_issues_carry_hidden_instructions_and_benign_ones_do_not():
    issue = lambda n: (FIXTURES / "issues" / f"issue_{n}.md").read_text(encoding="utf-8")  # noqa: E731
    assert "<!--" in issue(42) and "Deployment diagnostics" in issue(42)
    assert "<!--" in issue(45) and "base64" in issue(45)
    assert "<!--" not in issue(43) and "<!--" not in issue(44)


# ----------------------------------------------------------------------------- query files
def probe_queries() -> dict[str, str]:
    spec = importlib.util.spec_from_file_location("probe", REPO / "scripts" / "probe_falkordb.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Q


def test_every_query_file_matches_the_verbatim_plan_text_used_by_the_probe():
    probe = {norm(text) for text in probe_queries().values()}
    plan_blocks = {norm(b) for b in re.findall(r"```cypher\n(.*?)```", PLAN, re.S)}
    for name in available_queries():
        text = norm(load_query(name))
        assert text in plan_blocks, f"{name}.cypher is not a verbatim plan §10 block"
        assert text in probe, f"{name}.cypher differs from the query the probe verified"


def test_the_22_p1_and_3_p2_query_files_exist_and_all_load():
    names = available_queries()
    assert len(names) >= 25  # grows with each phase; P1 added 22, P2 added q2a/q2b/q2c
    assert all(load_query(n) for n in names)


def test_loader_rejects_unknown_and_malicious_names():
    with pytest.raises(QueryNotFoundError):
        load_query("does_not_exist")
    with pytest.raises(QueryNotFoundError):
        load_query("../settings")


def test_read_only_queries_exist_and_contain_no_write_clauses():
    write_clause = re.compile(r"\b(CREATE|MERGE|SET|DELETE|REMOVE)\b")
    assert READ_ONLY_QUERIES <= set(available_queries())
    for name in READ_ONLY_QUERIES:
        assert not write_clause.search(load_query(name)), name


def test_queries_that_write_are_not_marked_read_only():
    write_clause = re.compile(r"\b(CREATE|MERGE|SET|DELETE|REMOVE)\b")
    for path in QUERY_DIR.glob("*.cypher"):
        if write_clause.search(path.read_text(encoding="utf-8")):
            assert path.stem not in READ_ONLY_QUERIES, path.stem
