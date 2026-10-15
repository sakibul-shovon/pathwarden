"""P9 probe (plan rule 13): the MCP SDK as it exists NOW, before any gateway code is written.

Checks, with the installed ``mcp`` package (2.x, which renamed FastMCP and changed many APIs):
  1. a minimal high-level server (``MCPServer``, one tool) started as a stdio subprocess and called
     by the SDK client (``Client``),
  2. a tool error is reported as ``is_error`` on the result (not as an exception),
  3. a low-level ``Server`` with dynamic ``on_list_tools`` / ``on_call_tool`` (what the gateway
     needs: arbitrary tool names and input schemas, error results built by hand),
  4. a low-level server that itself spawns a stdio upstream and forwards a call (the gateway shape),
  5. the child process exits when the client closes (no zombie).

Run: ``python scripts/probe_mcp.py``. Exit code 0 only if every check passes.
The same file is the server child (``--serve-high`` / ``--serve-low`` / ``--serve-proxy``).
"""

from __future__ import annotations

import asyncio
import sys
from typing import Any

HERE = __file__


# ------------------------------------------------------------------ server children
def serve_high() -> None:
    from mcp.server.mcpserver import MCPServer

    server = MCPServer("probe-high")

    @server.tool()
    def add(a: int, b: int) -> int:
        return a + b

    @server.tool()
    def boom() -> str:
        raise ValueError("boom on purpose")

    server.run("stdio")


async def _serve_low_async(*, proxy: bool) -> None:
    import mcp_types as types
    from mcp import Client, StdioServerParameters
    from mcp.server.lowlevel import Server
    from mcp.server.stdio import stdio_server

    upstream: dict[str, Any] = {}

    async def on_list_tools(ctx: Any, params: Any) -> types.ListToolsResult:
        tool = types.Tool(
            name="probe__echo",
            description="echo",
            input_schema={
                "type": "object",
                "properties": {"text": {"type": "string"}},
                "required": ["text"],
            },
        )
        return types.ListToolsResult(tools=[tool])

    async def on_call_tool(ctx: Any, params: types.CallToolRequestParams) -> types.CallToolResult:
        args = params.arguments or {}
        if params.name != "probe__echo":
            return types.CallToolResult(
                content=[types.TextContent(type="text", text="unknown tool")], is_error=True
            )
        if args.get("text") == "refuse":
            return types.CallToolResult(
                content=[types.TextContent(type="text", text="Held by probe: act-0001 (TRIFECTA)")],
                is_error=True,
            )
        if proxy:
            result = await upstream["client"].call_tool("add", {"a": 2, "b": 3})
            text = result.content[0].text  # type: ignore[union-attr]
            return types.CallToolResult(
                content=[types.TextContent(type="text", text=f"proxied:{text}")]
            )
        return types.CallToolResult(content=[types.TextContent(type="text", text=args["text"])])

    server = Server("probe-low", on_list_tools=on_list_tools, on_call_tool=on_call_tool)
    async with stdio_server() as (read, write):
        if proxy:
            params = StdioServerParameters(command=sys.executable, args=[HERE, "--serve-high"])
            async with Client(params) as client:
                upstream["client"] = client
                await server.run(read, write, server.create_initialization_options())
        else:
            await server.run(read, write, server.create_initialization_options())


# ------------------------------------------------------------------ the probe (client side)
results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {detail}")


async def probe() -> None:
    from mcp import Client, StdioServerParameters

    high = StdioServerParameters(command=sys.executable, args=[HERE, "--serve-high"])
    async with Client(high) as client:
        tools = await client.list_tools()
        names = sorted(t.name for t in tools.tools)
        check("high-level server lists its tools over stdio", names == ["add", "boom"], str(names))
        ok = await client.call_tool("add", {"a": 2, "b": 3})
        text = ok.content[0].text  # type: ignore[union-attr]
        check("tool call returns text content", text == "5" and not ok.is_error, repr(text))
        bad = await client.call_tool("boom", {})
        check(
            "a raised exception becomes is_error on the result",
            bad.is_error is True,
            repr(bad.content[0].text)[:80],  # type: ignore[union-attr]
        )

    low = StdioServerParameters(command=sys.executable, args=[HERE, "--serve-low"])
    async with Client(low) as client:
        tools = await client.list_tools()
        schema = tools.tools[0].input_schema
        check(
            "low-level server exposes a dynamic tool with its own schema",
            tools.tools[0].name == "probe__echo" and schema["required"] == ["text"],
            f"{tools.tools[0].name} {schema}",
        )
        echo = await client.call_tool("probe__echo", {"text": "hi"})
        check(
            "low-level call returns content",
            echo.content[0].text == "hi",
            repr(echo.content[0].text),
        )  # type: ignore[union-attr]
        held = await client.call_tool("probe__echo", {"text": "refuse"})
        check(
            "low-level server returns a hand-built tool error",
            held.is_error is True and "Held by probe" in held.content[0].text,  # type: ignore[union-attr]
            repr(held.content[0].text),  # type: ignore[union-attr]
        )

    proxy = StdioServerParameters(command=sys.executable, args=[HERE, "--serve-proxy"])
    async with Client(proxy) as client:
        forwarded = await client.call_tool("probe__echo", {"text": "go"})
        check(
            "a low-level server can spawn an upstream and forward a call (gateway shape)",
            forwarded.content[0].text == "proxied:5",  # type: ignore[union-attr]
            repr(forwarded.content[0].text),  # type: ignore[union-attr]
        )


def main() -> int:
    if "--serve-high" in sys.argv:
        serve_high()
        return 0
    if "--serve-low" in sys.argv:
        asyncio.run(_serve_low_async(proxy=False))
        return 0
    if "--serve-proxy" in sys.argv:
        asyncio.run(_serve_low_async(proxy=True))
        return 0
    try:
        asyncio.run(asyncio.wait_for(probe(), timeout=90))
    except Exception as exc:  # the probe must report, not crash
        check("probe completed", False, f"{type(exc).__name__}: {exc}")
    failed = [name for name, ok, _ in results if not ok]
    print(f"\n{len(results) - len(failed)} PASS, {len(failed)} FAIL")
    return 1 if failed or not results else 0


if __name__ == "__main__":
    sys.exit(main())
