"""The MCP gateway (plan §16.2): a transparent proxy giving any MCP client lineage and the gate.

MCP client  <->  this gateway  <->  upstream MCP servers

One gateway process per agent connection; its lifetime is one Pathwarden ``Session``. The identity
comes from the environment (never from MCP client metadata). The gateway cannot see the LLM's own
state, so the session context is everything the session loaded or produced (conservative).

Fail closed: unlisted tools are hidden, unknown sources are refused, malformed upstream JSON is an
error, and any unexpected problem becomes a tool error instead of a forwarded call.
"""

from __future__ import annotations

import json
import logging
import os
import sys
from collections.abc import Callable, Iterator, Mapping
from contextlib import AbstractContextManager, AsyncExitStack, contextmanager, nullcontext
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Protocol

import mcp_types as types

from api.graph.client import NamedGraph, connect
from api.graph.schema import reset_graph
from api.mcp.config import GatewayConfig, GatewayTool, Refused, fill
from api.mcp.filelock import file_lock
from api.runtime.errors import (
    ArtifactNotFoundError,
    KeyNotFoundError,
    NotFoundError,
    ProvenanceError,
    QuarantinedError,
    ToolClassError,
    UnknownAgentError,
)
from api.runtime.events import EventLog
from api.runtime.gate import Gate, Verdict
from api.runtime.registry import Registry, load_policy, policy_version
from api.runtime.runtime import Runtime
from api.settings import Settings

log = logging.getLogger("pathwarden.gateway")

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"
REPO_ROOT = Path(__file__).resolve().parents[2]
UNMANAGED_TOOL = "gateway_unmanaged_read"
UNMANAGED_PREFIX = "src:unmanaged:"


class Upstream(Protocol):
    """What the gateway needs from an upstream: the SDK ``Client`` satisfies it."""

    async def list_tools(self) -> Any: ...

    async def call_tool(self, name: str, arguments: dict[str, Any] | None = None) -> Any: ...


@dataclass(frozen=True)
class Identity:
    """Who this gateway process speaks for (plan §16.2: environment only)."""

    workspace: str
    agent_id: str
    day_label: str
    task_ref: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Identity:
        env = os.environ if env is None else env
        names = ("PW_WORKSPACE", "PW_AGENT_ID", "PW_DAY_LABEL", "PW_TASK_REF")
        missing = [n for n in names if not env.get(n)]
        if missing:
            raise ValueError(f"the gateway needs these environment variables: {', '.join(missing)}")
        return cls(*(env[n] for n in names))


def gateway_registry(registry: Registry) -> Registry:
    """The registry plus one synthetic read tool for ``src:unmanaged:*`` (unmanaged reads).

    Trust of those sources is fixed to ``untrusted`` in code (``Runtime.add_source``), never decided
    by a model.
    """
    data = registry.model_dump(by_alias=True)
    data["tools"][UNMANAGED_TOOL] = {"class": "read", "source_prefix": UNMANAGED_PREFIX}
    return Registry.model_validate(data)


def _text(result: Any) -> str:
    return "".join(b.text for b in result.content if getattr(b, "type", "") == "text")


def _error(message: str) -> types.CallToolResult:
    return types.CallToolResult(
        content=[types.TextContent(type="text", text=message)], is_error=True
    )


class Gateway:
    def __init__(
        self,
        *,
        config: GatewayConfig,
        registry: Registry,
        runtime: Runtime,
        gate: Gate,
        upstreams: Mapping[str, Upstream],
        identity: Identity,
        locked: Callable[[], AbstractContextManager[None]] = nullcontext,
    ) -> None:
        self.config = config
        self.registry = registry
        self.runtime = runtime
        self.gate = gate
        self.upstreams = upstreams
        self.identity = identity
        self._locked = locked
        self.session_id: str | None = None
        self._exposed = config.exposed()

    # ------------------------------------------------------------------ lifecycle
    def start_session(self) -> str:
        """One process lifetime = one session. The agent must be declared in the registry."""
        with self._guard():
            self.session_id = self.runtime.start_session(
                self.identity.agent_id, self.identity.day_label, self.identity.task_ref
            )
        return self.session_id

    @contextmanager
    def _guard(self) -> Iterator[None]:
        """Cross-process lock plus a fresh view of the clock and id counters."""
        with self._locked():
            self.runtime.resync()
            yield

    # ------------------------------------------------------------------ MCP surface
    async def list_tools(self) -> list[types.Tool]:
        """Only the configured tools, named ``<server>__<tool>``; everything else is hidden."""
        offered: dict[str, Any] = {}
        for server, upstream in self.upstreams.items():
            for tool in (await upstream.list_tools()).tools:
                offered[f"{server}.{tool.name}"] = tool
        exposed: list[types.Tool] = []
        for name, key in self._exposed.items():
            tool = offered.get(key)
            if tool is None:
                log.warning("configured tool %s is not offered by its upstream; hidden", key)
                continue
            exposed.append(
                types.Tool(name=name, description=tool.description, input_schema=tool.input_schema)
            )
        return exposed

    async def call_tool(self, name: str, arguments: dict[str, Any] | None) -> types.CallToolResult:
        args = arguments or {}
        try:
            key = self._exposed.get(name)
            if key is None:
                raise Refused(f"Refused by Pathwarden: {name!r} is not an exposed tool")
            if self.session_id is None:
                raise Refused("Refused by Pathwarden: no session (the gateway did not start)")
            server, _, tool = key.partition(".")
            cfg = self.config.tools[key]
            handler = {
                "read": self._read,
                "write": self._write,
                "load": self._load,
                "external": self._external,
            }[cfg.cls]
            return await handler(server, tool, cfg, args)
        except Refused as refusal:
            return _error(str(refusal))
        except QuarantinedError as err:
            return _error(f"Quarantined by Pathwarden: {err}")
        except (
            KeyNotFoundError,
            ArtifactNotFoundError,
            NotFoundError,
            ProvenanceError,
            ToolClassError,
            UnknownAgentError,
        ) as err:
            return _error(f"Refused by Pathwarden: {type(err).__name__}: {err}")
        except Exception as err:  # fail closed: nothing is forwarded after an unexpected problem
            log.exception("gateway error on %s", name)
            return _error(
                f"Pathwarden gateway error ({type(err).__name__}); the call was not completed"
            )

    # ------------------------------------------------------------------ helpers
    async def _forward(self, server: str, tool: str, args: dict[str, Any]) -> types.CallToolResult:
        return await self.upstreams[server].call_tool(tool, args)

    def _registry_tool(self, cls: str, *, store: str | None = None, sink: str | None = None) -> str:
        for name, definition in self.registry.tools.items():
            if name == UNMANAGED_TOOL or definition.cls != cls:
                continue
            if (store is not None and definition.store == store) or (
                sink is not None and definition.sink == sink
            ):
                return name
        raise Refused(f"Refused by Pathwarden: the registry has no {cls} tool for {store or sink}")

    def _read_tool(self, source_id: str) -> str:
        best: tuple[int, str] | None = None
        for name, definition in self.registry.tools.items():
            prefix = definition.source_prefix
            if name == UNMANAGED_TOOL or definition.cls != "read" or not prefix:
                continue
            if source_id.startswith(prefix) and (best is None or len(prefix) > best[0]):
                best = (len(prefix), name)
        if best is None:
            raise Refused(f"Refused by Pathwarden: no registry read tool covers {source_id}")
        return best[1]

    def _string_arg(self, args: dict[str, Any], name: str | None) -> str:
        value = args.get(name or "")
        if not isinstance(value, str):
            raise Refused(f"Refused by Pathwarden: argument {name!r} must be a string")
        return value

    def _record_unmanaged(self, store: str, content: str) -> None:
        source_id = f"{UNMANAGED_PREFIX}{store}"
        self.runtime.add_source(source_id, "unmanaged", "untrusted", f"Unmanaged reads of {store}")
        self.runtime.read_source(self._sid(), UNMANAGED_TOOL, source_id, content)

    def _sid(self) -> str:
        assert self.session_id is not None
        return self.session_id

    # ------------------------------------------------------------------ tool classes (§16.2)
    async def _read(
        self, server: str, tool: str, cfg: GatewayTool, args: dict
    ) -> types.CallToolResult:
        source_id = fill(cfg.source_id or "", args)
        if self.registry.source(source_id) is None:
            raise Refused(f"Refused by Pathwarden: {source_id} is not a source in the registry")
        registry_tool = self._read_tool(source_id)
        result = await self._forward(server, tool, args)
        if result.is_error:
            return result
        with self._guard():
            self.runtime.read_source(self._sid(), registry_tool, source_id, _text(result))
        return result

    async def _write(
        self, server: str, tool: str, cfg: GatewayTool, args: dict
    ) -> types.CallToolResult:
        key = self._string_arg(args, cfg.key_arg)
        content = self._string_arg(args, cfg.content_arg)
        registry_tool = self._registry_tool("write", store=cfg.store)
        result = await self._forward(server, tool, args)
        if result.is_error:
            return result
        with self._guard():
            self.runtime.write(self._sid(), registry_tool, cfg.kind or "", key, content)
        return result

    async def _load(
        self, server: str, tool: str, cfg: GatewayTool, args: dict
    ) -> types.CallToolResult:
        registry_tool = self._registry_tool("load", store=cfg.store)
        if cfg.key_arg is not None:
            return await self._load_key(server, tool, cfg, args, registry_tool)
        return await self._load_prefix(server, tool, cfg, args, registry_tool)

    async def _load_key(
        self, server: str, tool: str, cfg: GatewayTool, args: dict, registry_tool: str
    ) -> types.CallToolResult:
        key = self._string_arg(args, cfg.key_arg)
        with self._guard():
            artifact_id, exists = self.runtime.find_key(registry_tool, key)
        if artifact_id is None and exists:
            raise Refused(f"Quarantined by Pathwarden: {key}")  # not forwarded
        result = await self._forward(server, tool, args)
        if result.is_error:
            return result
        content = _text(result)
        with self._guard():
            if artifact_id is None:  # never written through the gateway: an unmanaged read
                self._record_unmanaged(cfg.store or "", content)
            else:
                if self.runtime.get_artifact(artifact_id)["content"] != content:
                    raise Refused(
                        f"Refused by Pathwarden: the upstream's {key!r} differs from the recorded "
                        "lineage (it may be a newer, quarantined version)"
                    )
                self.runtime.load(self._sid(), registry_tool, artifact_id)
        return result

    async def _load_prefix(
        self, server: str, tool: str, cfg: GatewayTool, args: dict, registry_tool: str
    ) -> types.CallToolResult:
        result = await self._forward(server, tool, args)
        if result.is_error:
            return result
        try:
            entries = json.loads(_text(result))
            if not isinstance(entries, list) or not all(
                isinstance(e, dict)
                and isinstance(e.get("key"), str)
                and isinstance(e.get("content"), str)
                for e in entries
            ):
                raise ValueError("not a list of {key, content}")
        except ValueError as err:
            raise Refused(f"Refused by Pathwarden: malformed upstream response ({err})") from None
        kept: list[dict] = []
        with self._guard():
            for entry in entries:
                artifact_id, exists = self.runtime.find_key(registry_tool, entry["key"])
                if artifact_id is None and exists:
                    continue  # every recorded version is quarantined: removed from the response
                if artifact_id is None:
                    self._record_unmanaged(cfg.store or "", entry["content"])
                else:
                    if self.runtime.get_artifact(artifact_id)["content"] != entry["content"]:
                        continue  # differs from the recorded (non-quarantined) lineage: removed
                    self.runtime.load(self._sid(), registry_tool, artifact_id)
                kept.append(entry)
        return types.CallToolResult(content=[types.TextContent(type="text", text=json.dumps(kept))])

    async def _external(
        self, server: str, tool: str, cfg: GatewayTool, args: dict
    ) -> types.CallToolResult:
        content = self._string_arg(args, cfg.content_arg)
        draft_tool = self._registry_tool("write", store="workspace")
        external_tool = self._registry_tool("external", sink=cfg.sink)
        task = self.identity.task_ref
        # payload key: changelog:N for issue:N, so the Forensic Agent can derive the task
        key = (
            f"changelog:{task.split(':', 1)[1]}"
            if task.startswith("issue:")
            else f"external:{server}.{tool}"
        )
        with self._guard():
            draft = self.runtime.write(self._sid(), draft_tool, "draft", key, content)
            action_id = self.runtime.propose(self._sid(), external_tool, draft)
            verdict = self.gate.decide(action_id)
        if verdict.verdict is not Verdict.ALLOW:
            ui = f"{self.config.ui_url}/?tab=investigate&ws={self.identity.workspace}-mcp"
            raise Refused(f"Held by Pathwarden: {action_id} ({verdict.reason}). Review at {ui}")
        result = await self._forward(server, tool, args)
        if not result.is_error:
            with self._guard():
                self.runtime.set_action_status(action_id, "executed", verdict.reason)
        return result


# ---------------------------------------------------------------------- process entry point
def _spawn_parameters(command: list[str], upstream_state: Path):
    from mcp import StdioServerParameters

    executable = sys.executable if command[0] in ("python", "python3") else command[0]
    return StdioServerParameters(
        command=executable,
        args=command[1:],
        env={"PW_MOCK_STATE_DIR": str(upstream_state), "PW_FIXTURES_DIR": str(FIXTURES_DIR)},
        cwd=str(REPO_ROOT),
    )


def build_gateway(
    config: GatewayConfig,
    identity: Identity,
    settings: Settings,
    upstreams: Mapping[str, Upstream],
    fixtures_dir: Path = FIXTURES_DIR,
) -> Gateway:
    """Connect to the graph ``config.graph`` (seeded from the registry if it does not exist)."""
    if identity.workspace != config.workspace:
        raise ValueError(
            f"PW_WORKSPACE={identity.workspace!r} but the gateway serves {config.workspace!r}"
        )
    registry = gateway_registry(Registry.load(fixtures_dir / "registry.yaml"))
    if registry.workspace != config.workspace:
        raise ValueError("the registry and gateway.yaml describe different workspaces")
    policy = load_policy(fixtures_dir / "policy.yaml")
    db = connect(settings)
    state = settings.state_dir / f"{config.workspace}-mcp"
    lock = state / "gateway.lock"
    with file_lock(lock):
        if config.graph not in db.list_graphs():
            graph = reset_graph(db, config.graph, registry, policy.query_timeout_ms)
        else:
            graph = NamedGraph(db, config.graph, policy.query_timeout_ms)
    runtime = Runtime(graph, registry, events=EventLog(state / "events.jsonl"))
    gate = Gate(
        graph,
        policy,
        policy_version=policy_version(fixtures_dir / "policy.yaml"),
        verdict_log=state / "verdicts.jsonl",
    )
    return Gateway(
        config=config,
        registry=registry,
        runtime=runtime,
        gate=gate,
        upstreams=upstreams,
        identity=identity,
        locked=lambda: file_lock(lock),
    )


async def serve(config_path: Path | None = None) -> None:
    """Run the gateway on stdin/stdout for ONE agent (identity from the environment).

    The configuration is ``fixtures/gateway.yaml`` unless ``PW_GATEWAY_CONFIG`` names another file
    (used by the tests to point at a throw-away graph).
    """
    config_path = config_path or Path(
        os.environ.get("PW_GATEWAY_CONFIG") or FIXTURES_DIR / "gateway.yaml"
    )
    from mcp import Client
    from mcp.server.lowlevel import Server
    from mcp.server.stdio import stdio_server

    settings = Settings.from_env()
    identity = Identity.from_env()
    config = GatewayConfig.load(config_path)
    upstream_state = settings.state_dir / f"{config.workspace}-mcp" / "upstreams"

    async with AsyncExitStack() as stack:
        upstreams: dict[str, Upstream] = {}
        for name, definition in config.upstreams.items():
            params = _spawn_parameters(definition.command, upstream_state)
            upstreams[name] = await stack.enter_async_context(Client(params))
        gateway = build_gateway(config, identity, settings, upstreams)
        gateway.start_session()

        async def on_list_tools(ctx: Any, params: Any) -> types.ListToolsResult:
            return types.ListToolsResult(tools=await gateway.list_tools())

        async def on_call_tool(
            ctx: Any, params: types.CallToolRequestParams
        ) -> types.CallToolResult:
            return await gateway.call_tool(params.name, params.arguments)

        server = Server(
            "pathwarden-gateway", on_list_tools=on_list_tools, on_call_tool=on_call_tool
        )
        async with stdio_server() as (read, write):
            await server.run(read, write, server.create_initialization_options())


def main() -> None:
    import asyncio

    asyncio.run(serve())


if __name__ == "__main__":
    main()
