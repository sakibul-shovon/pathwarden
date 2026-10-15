"""``fixtures/gateway.yaml`` (plan §8.8): the upstream tools the gateway exposes, and how."""

from __future__ import annotations

from pathlib import Path
from typing import Literal, Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

EXPOSED_SEPARATOR = "__"


class Refused(Exception):
    """The gateway refuses a call (fail closed); the message becomes the MCP tool error."""


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class UpstreamDef(_Strict):
    command: list[str] = Field(min_length=1)


class GatewayTool(_Strict):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    cls: Literal["read", "write", "load", "external"] = Field(alias="class")
    source_id: str | None = None
    store: Literal["team_memory", "workspace"] | None = None
    kind: str | None = None
    key_arg: str | None = None
    content_arg: str | None = None
    prefix_arg: str | None = None
    sink: str | None = None

    @model_validator(mode="after")
    def _complete(self) -> Self:
        need = {
            "read": ("source_id",),
            "write": ("store", "kind", "key_arg", "content_arg"),
            "load": ("store",),
            "external": ("sink", "content_arg"),
        }[self.cls]
        missing = [name for name in need if getattr(self, name) is None]
        if missing:
            raise ValueError(f"class {self.cls} needs {', '.join(missing)}")
        if self.cls == "load" and (self.key_arg is None) == (self.prefix_arg is None):
            raise ValueError("class load needs exactly one of key_arg / prefix_arg")
        return self


class GatewayConfig(_Strict):
    workspace: str
    graph: str
    ui_url: str
    transport: Literal["stdio"]
    upstreams: dict[str, UpstreamDef]
    tools: dict[str, GatewayTool]

    @model_validator(mode="after")
    def _known_upstreams(self) -> Self:
        for name in self.tools:
            server, dot, tool = name.partition(".")
            if not dot or not tool or server not in self.upstreams:
                raise ValueError(
                    f"tool {name!r} must be '<upstream>.<tool>' of a declared upstream"
                )
        return self

    @classmethod
    def load(cls, path: Path) -> GatewayConfig:
        return cls.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))

    def exposed(self) -> dict[str, str]:
        """exposed name (``<server>__<tool>``) -> configured key (``<server>.<tool>``)."""
        return {name.replace(".", EXPOSED_SEPARATOR, 1): name for name in self.tools}


def fill(template: str, args: dict) -> str:
    """Fill ``{name}`` placeholders from the call arguments; a missing argument refuses the call."""
    try:
        return template.format_map({k: str(v) for k, v in args.items()})
    except KeyError as missing:
        raise Refused(
            f"Refused by Pathwarden: missing argument {missing} for {template!r}"
        ) from None
