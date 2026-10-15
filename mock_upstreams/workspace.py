"""``mock_workspace``: the agents' shared working files (drafts, patches)."""

from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from mock_upstreams._common import load_store, save_store


def build_server() -> MCPServer:
    server = MCPServer("mock_workspace")

    @server.tool()
    def workspace_write(key: str, content: str) -> str:
        """Store (or overwrite) one workspace file."""
        data = load_store("workspace")
        data[key] = content
        save_store("workspace", data)
        return f"stored {key}"

    @server.tool()
    def workspace_read(key: str) -> str:
        """Return the content of one workspace file."""
        data = load_store("workspace")
        if key not in data:
            raise ValueError(f"no workspace file: {key}")
        return data[key]

    return server


if __name__ == "__main__":
    build_server().run("stdio")
