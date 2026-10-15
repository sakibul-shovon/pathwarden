"""Pathwarden as MCP tools (plan §16.1): an SDK client lists and calls the five tools."""

from __future__ import annotations

import asyncio
import secrets

import pytest
from mcp import Client

from api.mcp.tool_server import build_tool_server
from api.remediation.capability_graph import CapabilityService

BASE = "/api/ws/tinyqueue"
TOOLS = [
    "pathwarden_explain",
    "pathwarden_forensics",
    "pathwarden_gate",
    "pathwarden_quarantine_preview",
    "pathwarden_toxic_agents",
]


@pytest.fixture
def mcp_call(manager, settings, db):
    prefix = f"pw_cap_test_{secrets.token_hex(3)}_"
    server = build_tool_server(manager, CapabilityService(settings, prefix=prefix))

    def call(tool: str | None, arguments: dict | None = None):
        async def scenario():
            async with Client(server) as client:
                if tool is None:
                    return await client.list_tools()
                return await client.call_tool(tool, arguments or {})

        return asyncio.run(scenario())

    yield call
    for name in db.list_graphs():
        if name.startswith(prefix):
            db.select_graph(name).delete()


def held_action(client) -> str:
    response = client.post(f"{BASE}/scenarios/attack_pipeline_42/run", json={"guard": True})
    assert response.status_code == 200, response.text
    return response.json()["actions"][-1]["id"]


def test_an_sdk_client_lists_exactly_the_five_pathwarden_tools(mcp_call):
    listing = mcp_call(None)

    assert sorted(t.name for t in listing.tools) == TOOLS


def test_pathwarden_gate_returns_the_same_verdict_as_the_rest_api(client, mcp_call):
    action = held_action(client)

    result = mcp_call("pathwarden_gate", {"workspace": "tinyqueue", "action_id": action})

    assert not result.is_error
    rest = client.get(f"{BASE}/actions/{action}").json()["gate"]
    same = {k: v for k, v in result.structured_content.items() if k != "latency_ms"}
    assert same == {k: v for k, v in rest.items() if k != "latency_ms"}  # latency differs per call
    assert result.structured_content["verdict"] == "HOLD"
    assert result.structured_content["reason"] == "TRIFECTA"


def test_pathwarden_explain_gives_both_witnesses_and_the_laundering_memories(client, mcp_call):
    action = held_action(client)

    result = mcp_call("pathwarden_explain", {"workspace": "tinyqueue", "action_id": action})

    body = result.structured_content
    assert body["gate"]["untrusted_witness"][-1] == "src:issue:42"
    assert body["gate"]["secret_witness"][-1].startswith("src:env:")
    assert {m["memory_key"] for m in body["laundering"]} == {
        "issue_summary:42",
        "team_convention:42",
    }


def test_pathwarden_quarantine_preview_is_read_only(client, mcp_call):
    held_action(client)

    result = mcp_call(
        "pathwarden_quarantine_preview", {"workspace": "tinyqueue", "source_id": "src:issue:42"}
    )

    assert not result.is_error and result.structured_content["artifact_ids"]
    assert result.structured_content["affected_actions"]
    assert not any(m["quarantined"] for m in client.get(f"{BASE}/memory").json())  # unchanged


def test_pathwarden_forensics_quarantines_and_returns_the_report(client, mcp_call):
    action = held_action(client)

    result = mcp_call("pathwarden_forensics", {"workspace": "tinyqueue", "action_id": action})

    report = result.structured_content
    assert report["recommendation"] == "APPROVE_HEALED_RELEASE"
    assert report["untrusted_source"] == "src:issue:42"
    assert report["sandbox"]["verdict"] == "ALLOW"
    assert any(m["quarantined"] for m in client.get(f"{BASE}/memory").json())


def test_pathwarden_toxic_agents_matches_the_remediation_endpoint(mcp_call):
    result = mcp_call("pathwarden_toxic_agents", {"topology": "tinyqueue3"})

    assert not result.is_error
    assert result.structured_content == {
        "topology": "tinyqueue3",
        "toxic_agents": ["fixer", "release"],
    }


@pytest.mark.parametrize(
    ("tool", "arguments", "message"),
    [
        ("pathwarden_gate", {"workspace": "nope", "action_id": "act-0001"}, "unknown workspace"),
        ("pathwarden_gate", {"workspace": "tinyqueue", "action_id": "act-9999"}, "NotFoundError"),
        ("pathwarden_toxic_agents", {"topology": "nowhere"}, "NotFoundError"),
        (
            "pathwarden_forensics",
            {"workspace": "tinyqueue", "action_id": "act-9999"},
            "NotFoundError",
        ),
    ],
)
def test_errors_are_tool_errors_with_a_readable_message(client, mcp_call, tool, arguments, message):
    client.post(f"{BASE}/reset")

    result = mcp_call(tool, arguments)

    assert result.is_error and message in result.content[0].text
