"""``mock_memory``: shared team memory; ``memory_list`` returns JSON ``[{"key", "content"}]``."""

from __future__ import annotations

import json

from mcp.server.mcpserver import MCPServer

from mock_upstreams._common import load_store, save_store


def build_server() -> MCPServer:
    server = MCPServer("mock_memory")

    @server.tool()
    def memory_write(key: str, content: str) -> str:
        """Store (or overwrite) one memory entry."""
        data = load_store("memory")
        data[key] = content
        save_store("memory", data)
        return f"stored {key}"

    @server.tool()
    def memory_read(key: str) -> str:
        """Return the content stored under ``key``."""
        data = load_store("memory")
        if key not in data:
            raise ValueError(f"no memory entry: {key}")
        return data[key]

    @server.tool()
    def memory_list(prefix: str = "") -> str:
        """Return every entry whose key starts with ``prefix`` as JSON text."""
        data = load_store("memory")
        entries = [{"key": k, "content": v} for k, v in data.items() if k.startswith(prefix)]
        return json.dumps(entries)

    return server


if __name__ == "__main__":
    build_server().run("stdio")
