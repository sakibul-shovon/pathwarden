"""``mock_env``: ``get_env(key)`` returns a value of the SYNTHETIC ``.env`` (fixtures/env.yaml)."""

from __future__ import annotations

import yaml
from mcp.server.mcpserver import MCPServer

from mock_upstreams._common import fixtures_dir


def build_server() -> MCPServer:
    server = MCPServer("mock_env")

    @server.tool()
    def get_env(key: str) -> str:
        """Return the value of one deployment setting."""
        values = yaml.safe_load((fixtures_dir() / "env.yaml").read_text(encoding="utf-8"))
        if key not in values:
            raise ValueError(f"no such setting: {key}")
        return str(values[key])

    return server


if __name__ == "__main__":
    build_server().run("stdio")
