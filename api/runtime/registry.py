"""Registry and policy: the only place trust labels and tool classes come from (plan rule 5)."""

from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Literal, Self

import yaml
from pydantic import BaseModel, ConfigDict, Field, model_validator

from api.runtime.errors import ToolClassError, UnknownToolError

ToolClass = Literal["read", "sanitize", "write", "load", "external"]
Store = Literal["team_memory", "workspace"]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class AgentDef(_Strict):
    id: str
    role: str


class SourceDef(_Strict):
    id: str
    kind: str
    trust: Literal["untrusted", "internal", "secret"]
    label: str


class SinkDef(_Strict):
    id: str
    kind: str
    external: bool


class ToolDef(_Strict):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    cls: ToolClass = Field(alias="class")
    source_prefix: str | None = None
    store: Store | None = None
    sink: str | None = None


class Policy(_Strict):
    strict: bool
    max_lineage_hops: int
    query_timeout_ms: int


class Registry(_Strict):
    workspace: str
    agents: list[AgentDef]
    sources: list[SourceDef]
    sinks: list[SinkDef]
    tools: dict[str, ToolDef]

    @model_validator(mode="after")
    def _consistent(self) -> Self:
        for label, items in (
            ("agent", [a.id for a in self.agents]),
            ("source", [s.id for s in self.sources]),
            ("sink", [k.id for k in self.sinks]),
        ):
            if len(items) != len(set(items)):
                raise ValueError(f"duplicate {label} id in registry")
        sink_ids = {k.id for k in self.sinks}
        for name, tool in self.tools.items():
            if tool.cls == "read" and not tool.source_prefix:
                raise ValueError(f"tool {name}: class read needs source_prefix")
            if tool.cls in ("write", "load") and not tool.store:
                raise ValueError(f"tool {name}: class {tool.cls} needs store")
            if tool.cls == "external" and tool.sink not in sink_ids:
                raise ValueError(f"tool {name}: sink {tool.sink!r} is not a declared sink")
        return self

    # ------------------------------------------------------------------ loading
    @classmethod
    def load(cls, path: Path) -> Registry:
        return cls.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))

    def with_eval_extras(self, path: Path) -> Registry:
        """Return a copy extended with ``fixtures/registry_eval.yaml`` (evaluation only)."""
        extra = yaml.safe_load(path.read_text(encoding="utf-8"))
        data = self.model_dump(by_alias=True)
        data["agents"] += extra.get("extra_agents", [])
        data["sources"] += extra.get("extra_sources", [])
        return Registry.model_validate(data)

    # ------------------------------------------------------------------ lookups
    def tool(self, name: str) -> ToolDef:
        try:
            return self.tools[name]
        except KeyError:
            raise UnknownToolError(name) from None

    def tool_of_class(self, name: str, expected: ToolClass) -> ToolDef:
        tool = self.tool(name)
        if tool.cls != expected:
            raise ToolClassError(f"tool {name} has class {tool.cls}, operation needs {expected}")
        return tool

    def source(self, source_id: str) -> SourceDef | None:
        return next((s for s in self.sources if s.id == source_id), None)

    def sink(self, sink_id: str) -> SinkDef | None:
        return next((k for k in self.sinks if k.id == sink_id), None)


def load_policy(path: Path) -> Policy:
    return Policy.model_validate(yaml.safe_load(path.read_text(encoding="utf-8")))


def policy_version(path: Path) -> str:
    """Identifies the policy that produced a verdict: sha256 of the policy file's bytes (A-04)."""
    return hashlib.sha256(path.read_bytes()).hexdigest()
