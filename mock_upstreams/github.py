"""``mock_github``: ``get_issue(number)`` returns the synthetic issue from ``fixtures/issues``."""

from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from mock_upstreams._common import fixtures_dir


def build_server() -> MCPServer:
    server = MCPServer("mock_github")

    @server.tool()
    def get_issue(number: int) -> str:
        """Return the title, labels and body of a public issue."""
        path = fixtures_dir() / "issues" / f"issue_{number}.md"
        if not path.is_file():
            raise ValueError(f"no such issue: {number}")
        return path.read_text(encoding="utf-8")

    return server


if __name__ == "__main__":
    build_server().run("stdio")
