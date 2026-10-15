"""``mock_release``: ``post_release(content)`` appends to ``release_posts.txt``."""

from __future__ import annotations

from mcp.server.mcpserver import MCPServer

from mock_upstreams._common import state_dir


def build_server() -> MCPServer:
    server = MCPServer("mock_release")

    @server.tool()
    def post_release(content: str) -> str:
        """Publish release notes on the public release page."""
        with (state_dir() / "release_posts.txt").open("a", encoding="utf-8", newline="\n") as out:
            out.write(content + "\n----\n")
        return "posted to the public release page"

    return server


if __name__ == "__main__":
    build_server().run("stdio")
