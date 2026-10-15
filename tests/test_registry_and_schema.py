"""Registry validation, graph seeding and indexes (plan §7, §8.1, §8.9)."""

from __future__ import annotations

import pytest
import yaml
from pydantic import ValidationError

from api.graph.schema import (
    INDEX_DDL,
    main_graph_name,
    mcp_graph_name,
    reset_graph,
    sandbox_graph_name,
)
from api.runtime.errors import ToolClassError, UnknownToolError
from api.runtime.registry import Policy, Registry, load_policy
from tests.conftest import FIXTURES


def raw_registry() -> dict:
    return yaml.safe_load((FIXTURES / "registry.yaml").read_text(encoding="utf-8"))


# ----------------------------------------------------------------------------- registry
def test_the_plan_registry_loads_with_the_expected_contents(registry):
    assert registry.workspace == "tinyqueue"
    assert [a.id for a in registry.agents] == ["triage", "fixer", "release"]
    trust = {s.id: s.trust for s in registry.sources}
    assert trust["src:issue:42"] == "untrusted"
    assert trust["src:env:PORT"] == "internal"
    assert trust["src:env:PAYMENT_API_KEY"] == "secret"
    assert trust["src:env:DEPLOY_TOKEN"] == "secret"
    assert registry.sink("sink:public_release_page").external is True
    assert registry.sink("sink:internal_changelog").external is False
    assert registry.tool("fetch_issue").source_prefix == "src:issue:"
    assert registry.tool("post_release").sink == "sink:public_release_page"


def test_tool_lookup_fails_closed(registry):
    with pytest.raises(UnknownToolError):
        registry.tool("no_such_tool")
    with pytest.raises(ToolClassError):
        registry.tool_of_class("memory_write", "read")
    assert registry.source("src:nope") is None


def test_eval_extras_extend_a_copy_and_leave_the_original_untouched(registry, eval_registry):
    assert len(registry.agents) == 3 and len(eval_registry.agents) == 3 + 8
    assert eval_registry.source("src:env:ALL").trust == "secret"
    assert registry.source("src:env:ALL") is None
    assert {"relay1", "curator4", "auditor"} <= {a.id for a in eval_registry.agents}


@pytest.mark.parametrize(
    "mutate, why",
    [
        (lambda d: d["tools"]["fetch_issue"].pop("source_prefix"), "read needs source_prefix"),
        (lambda d: d["tools"]["memory_write"].pop("store"), "write needs store"),
        (lambda d: d["tools"]["post_release"].update(sink="sink:nowhere"), "undeclared sink"),
        (lambda d: d["sources"][0].update(trust="trusted"), "invalid trust level"),
        (lambda d: d["agents"].append(dict(d["agents"][0])), "duplicate agent id"),
        (lambda d: d["tools"]["fetch_issue"].update(class_="read"), "unknown field"),
    ],
)
def test_invalid_registries_are_rejected(mutate, why):
    data = raw_registry()
    mutate(data)
    with pytest.raises(ValidationError):
        Registry.model_validate(data)


def test_policy_loads():
    policy = load_policy(FIXTURES / "policy.yaml")
    assert policy == Policy(strict=False, max_lineage_hops=16, query_timeout_ms=2000)


# ----------------------------------------------------------------------------- schema
def test_graph_name_helpers():
    assert main_graph_name("tinyqueue") == "pw_tinyqueue"
    assert sandbox_graph_name("tinyqueue") == "pw_tinyqueue__sbx"
    assert mcp_graph_name("tinyqueue") == "pw_mcp_tinyqueue"


def test_reset_seeds_registry_nodes_and_creates_indexes(db, graph, registry, cypher):
    run = cypher(graph)
    assert run("MATCH (a:Agent) RETURN count(a)") == [[3]]
    assert run("MATCH (s:Source) RETURN count(s)") == [[len(registry.sources)]]
    assert run("MATCH (k:Sink) RETURN count(k)") == [[2]]
    assert run("MATCH (s:Source {id: 'src:env:PAYMENT_API_KEY'}) RETURN s.trust") == [["secret"]]
    assert run("MATCH (k:Sink {id: 'sink:public_release_page'}) RETURN k.external") == [[True]]
    assert len(INDEX_DDL) == 7
    assert db.select_graph(graph.name).list_indices().result_set


def test_reset_is_idempotent_and_wipes_previous_lineage(db, graph, registry, runtime, cypher):
    sid = runtime.start_session("triage", "Mon", "issue:42")
    runtime.write(sid, "memory_write", "memory", "k", "v")

    reset_graph(db, graph.name, registry)

    run = cypher(graph)
    assert run("MATCH (n:Session) RETURN count(n)") == [[0]]
    assert run("MATCH (n:Artifact) RETURN count(n)") == [[0]]
    assert run("MATCH (a:Agent) RETURN count(a)") == [[3]]  # reseeded once, not twice


def test_eval_registry_seeds_the_extra_agents_and_the_coarse_source(
    make_graph, eval_registry, cypher
):
    graph = make_graph(eval_registry)
    run = cypher(graph)
    assert run("MATCH (a:Agent) RETURN count(a)") == [[11]]
    assert run("MATCH (s:Source {id: 'src:env:ALL'}) RETURN s.trust") == [["secret"]]
