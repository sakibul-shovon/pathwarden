"""Mock upstream MCP servers for the gateway demo and tests (plan §16.3).

Each module exposes ``build_server()`` (an ``MCPServer``) and runs it over stdio with
``python -m mock_upstreams.<name>``. State lives in JSON files under ``PW_MOCK_STATE_DIR`` so
that it survives across the gateway processes (one per agent) of a demo; the data they return comes
from ``fixtures/`` (synthetic issues, a synthetic ``.env``). No real credentials anywhere.
"""
