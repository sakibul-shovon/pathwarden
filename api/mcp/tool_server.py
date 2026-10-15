"""Pathwarden as MCP tools (plan §16.1): ask the gate, the lineage and the forensic agent over MCP.

Five tools, all backed by the services the REST API already uses (no new logic, no new Cypher):

* ``pathwarden_gate(workspace, action_id)``              - a fresh, non-recording gate result
* ``pathwarden_explain(workspace, action_id)``           - witnesses and laundering memories
* ``pathwarden_quarantine_preview(workspace, source_id)``- what a quarantine would cover
* ``pathwarden_forensics(workspace, action_id)``         - run the (scripted) Forensic Agent
* ``pathwarden_toxic_agents(topology)``                  - toxic agents of a capability graph

``pathwarden_forensics`` quarantines automatically (risk-reducing, rule 8); releasing or approving
stays a human action in the UI. Errors are reported as MCP tool errors with a readable message.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import asdict
from typing import Any

from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError

from api.forensics.agent import LlmModeUnavailableError
from api.remediation.capability_graph import CapabilityService
from api.runtime.errors import PathwardenError
from api.runtime.explain import laundering_memories
from api.runtime.gate import GateResult
from api.settings import Settings, load_dotenv
from api.workspace import Workspace, WorkspaceManager


def _gate_dict(result: GateResult) -> dict[str, Any]:
    out = asdict(result)
    out["verdict"] = result.verdict.value
    return out


def build_tool_server(workspaces: WorkspaceManager, remediation: CapabilityService) -> MCPServer:
    server = MCPServer("pathwarden")

    def workspace_of(name: str) -> Workspace:
        try:
            return workspaces.get(name)
        except PathwardenError as err:
            raise ToolError(f"unknown workspace {name!r}: {err}") from None

    def guarded(action: Callable[[], Any]) -> Any:
        try:
            return action()
        except ToolError:
            raise
        except LlmModeUnavailableError as err:
            raise ToolError(str(err)) from None
        except PathwardenError as err:
            raise ToolError(f"{type(err).__name__}: {err}") from None

    @server.tool()
    def pathwarden_gate(workspace: str, action_id: str) -> dict[str, Any]:
        """The gate's verdict (HOLD / BLOCK / ALLOW) for an action, computed now, not recorded."""
        ws = workspace_of(workspace)

        def work() -> dict[str, Any]:
            ws.runtime.get_action(action_id)  # unknown actions fail loudly
            return _gate_dict(ws.gate.evaluate(action_id))

        return guarded(work)

    @server.tool()
    def pathwarden_explain(workspace: str, action_id: str) -> dict[str, Any]:
        """Why an action is held: the witness paths and the memories that laundered the text."""
        ws = workspace_of(workspace)

        def work() -> dict[str, Any]:
            ws.runtime.get_action(action_id)
            gate = _gate_dict(ws.gate.evaluate(action_id))
            gate["untrusted_witness"], gate["secret_witness"] = ws.gate.witnesses(action_id)
            return {"gate": gate, "laundering": laundering_memories(ws.graph, action_id)}

        return guarded(work)

    @server.tool()
    def pathwarden_quarantine_preview(workspace: str, source_id: str) -> dict[str, Any]:
        """What quarantining everything derived from ``source_id`` would cover (read-only)."""
        ws = workspace_of(workspace)
        return guarded(lambda: ws.quarantine_preview(source_id))

    @server.tool()
    def pathwarden_forensics(workspace: str, action_id: str) -> dict[str, Any]:
        """Investigate a held action: find the poisoned memory, quarantine, replay in a sandbox."""
        ws = workspace_of(workspace)
        return guarded(lambda: ws.forensics(action_id, "scripted").model_dump())

    @server.tool()
    def pathwarden_toxic_agents(topology: str) -> dict[str, Any]:
        """Agents that can combine untrusted data, secrets and an external sink (r4)."""
        return guarded(
            lambda: {"topology": topology, "toxic_agents": remediation.toxic_agents(topology)}
        )

    return server


def main() -> None:
    """``python -m api.mcp.tool_server``: serve the tools over stdio (see ``make mcp-server``)."""
    from pathlib import Path

    load_dotenv(Path(".env"))
    settings = Settings.from_env()
    server = build_tool_server(WorkspaceManager(settings), CapabilityService(settings))
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
