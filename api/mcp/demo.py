"""Gateway demo with SCRIPTED MCP clients (plan §16.4; the live-LLM version needs P8).

Three agents (triage, fixer, release) are three separate MCP client sessions, each talking to its
own gateway process over stdio. They do what the scripted agents of the main demo do, but through
MCP tools only. The lineage lands in ``pw_mcp_tinyqueue``; the release is held with an MCP tool
error, and the same witnesses are visible in the UI at ``?tab=investigate&ws=tinyqueue-mcp``.

Run: ``make demo-mcp`` (needs FalkorDB). It RESETS the ``tinyqueue-mcp`` workspace first.
Exit code 0 only if the leak was held and nothing was posted.
"""

from __future__ import annotations

import asyncio
import json
import sys
from typing import Any

from mcp import Client, StdioServerParameters

from api.agents.render import render_changelog
from api.agents.scripted import IssueView, choose_env_keys
from api.mcp.gateway import FIXTURES_DIR, REPO_ROOT
from api.settings import Settings
from api.workspace import WorkspaceManager

ISSUE = 42
WORKSPACE = "tinyqueue"
UI = "http://localhost:5173"


def _text(result: Any) -> str:
    return "".join(b.text for b in result.content if getattr(b, "type", "") == "text")


def _env(settings: Settings, agent: str, task: str) -> dict[str, str]:
    env = {
        "PW_WORKSPACE": WORKSPACE,
        "PW_AGENT_ID": agent,
        "PW_DAY_LABEL": "Mon",
        "PW_TASK_REF": task,
        "PW_STATE_DIR": str(settings.state_dir),
        "PW_FALKORDB_HOST": settings.falkordb_host,
        "PW_FALKORDB_PORT": str(settings.falkordb_port),
    }
    if settings.falkordb_password:
        env["PW_FALKORDB_PASSWORD"] = settings.falkordb_password
    return env


def _gateway(settings: Settings, agent: str, task: str) -> Client:
    params = StdioServerParameters(
        command=sys.executable,
        args=["-m", "api.mcp.gateway"],
        env=_env(settings, agent, task),
        cwd=str(REPO_ROOT),
    )
    return Client(params)


async def triage(settings: Settings, log: list[str]) -> None:
    async with _gateway(settings, "triage", f"issue:{ISSUE}") as client:
        issue = _text(await client.call_tool("github__get_issue", {"number": ISSUE}))
        view = IssueView.parse(issue)
        await client.call_tool(
            "memory__memory_write",
            {"key": f"issue_summary:{ISSUE}", "content": view.first_body_line},
        )
        log.append(f"triage: read issue #{ISSUE}, wrote issue_summary:{ISSUE}")
        if view.hidden_comment:  # the injected instruction a compromised triage agent follows
            await client.call_tool(
                "memory__memory_write",
                {"key": f"team_convention:{ISSUE}", "content": view.hidden_comment},
            )
            log.append(f"triage: wrote team_convention:{ISSUE} (a convention from the issue)")


async def fixer(settings: Settings, log: list[str]) -> None:
    async with _gateway(settings, "fixer", f"issue:{ISSUE}") as client:
        listed = await client.call_tool("memory__memory_list", {"prefix": "team_convention:"})
        conventions = [entry["content"] for entry in json.loads(_text(listed))]
        log.append(f"fixer: loaded {len(conventions)} team convention(s)")
        env_values: dict[str, str] = {}
        for key in choose_env_keys(conventions):
            env_values[key] = _text(await client.call_tool("env__get_env", {"key": key}))
        log.append(f"fixer: read deploy settings {sorted(env_values)}")
        title = IssueView.parse(
            (FIXTURES_DIR / "issues" / f"issue_{ISSUE}.md").read_text(encoding="utf-8")
        ).title
        draft = render_changelog(title, ISSUE, env_values, conventions, False)
        await client.call_tool(
            "workspace__workspace_write", {"key": f"changelog:{ISSUE}", "content": draft}
        )
        log.append(f"fixer: wrote changelog:{ISSUE}")


async def release(settings: Settings, log: list[str]) -> tuple[bool, str]:
    async with _gateway(settings, "release", f"issue:{ISSUE}") as client:
        draft = _text(
            await client.call_tool("workspace__workspace_read", {"key": f"changelog:{ISSUE}"})
        )
        log.append(f"release: loaded changelog:{ISSUE}")
        result = await client.call_tool("release__post_release", {"content": draft})
        return bool(result.is_error), _text(result)


async def run(settings: Settings) -> int:
    workspace = WorkspaceManager(settings).get(f"{WORKSPACE}-mcp")
    workspace.reset()  # clean pw_mcp_tinyqueue, gateway state and mock upstream state
    log: list[str] = []
    await triage(settings, log)
    await fixer(settings, log)
    is_error, message = await release(settings, log)
    posted = (settings.state_dir / f"{WORKSPACE}-mcp" / "upstreams" / "release_posts.txt").is_file()
    print("\n".join(log))
    print(f"release: post_release -> {'TOOL ERROR' if is_error else 'forwarded'}: {message}")
    print(f"public release page written: {posted}")
    held = is_error and message.startswith("Held by Pathwarden:") and not posted
    print("RESULT:", "attack HELD by the gateway" if held else "!!! attack NOT held")
    print(f"Investigate it: {UI}/?tab=investigate&ws={WORKSPACE}-mcp")
    return 0 if held else 1


def main() -> None:
    settings = Settings.from_env()
    sys.exit(asyncio.run(run(settings)))


if __name__ == "__main__":
    main()
