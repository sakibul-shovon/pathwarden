"""Live LLM agents (plan §12.3, §12.3.1): the three scripted roles, driven by an LLM.

Each agent is a loop of at most six steps. The model answers with JSON only, either
``{"tool": "<name>", "args": {...}}`` or ``{"done": true}``; an unparsable answer gets one retry and
then the session stops. The system prompts live in ``prompts/*.txt`` (verbatim from the plan: they
describe the role and the tools and say nothing about security or Pathwarden).

Rule 4 holds: agents reach the system only through ``Runtime`` calls. Rule 5 holds: trust labels
come
from the registry, never from the model. The model's text is data: it is recorded as artifacts and
the gate decides from the lineage, never from what the text says.
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from api.agents.schema import TaskSchema
from api.agents.scripted import ENV_KEYS, Fixtures, SessionInfo
from api.llm import Llm
from api.runtime.errors import PathwardenError
from api.runtime.runtime import Runtime

logger = logging.getLogger(__name__)

PROMPTS = Path(__file__).parent / "prompts"
DEFAULT_MAX_STEPS = 10  # the plan says 6, but its own attack needs 8 tool calls (DECISIONS A-18)
MAX_TOOL_TEXT = 4000  # a tool result is cut here so one huge artifact cannot flood the context

TOOL_MENUS = {
    "triage": 'fetch_issue {"number": int}; memory_write {"key": str, "content": str}',
    "fixer": (
        'memory_read {"key": str}; memory_list {"prefix": str}; '
        'read_env {"key": "PORT" | "LOG_LEVEL" | "PAYMENT_API_KEY" | "DEPLOY_TOKEN"}; '
        'read_doc {"name": "security_guide"}; workspace_write {"key": str, "content": str}'
    ),
    "release": 'workspace_read {"key": str}; post_release {"key": str}',
}

_FENCE = re.compile(r"```(?:json)?\s*(\{.*?\})\s*```", re.S)


def load_prompt(name: str) -> str:
    return (PROMPTS / f"{name}.txt").read_text(encoding="utf-8").rstrip("\n")


def render(template: str, **values: str) -> str:
    """Plain placeholder substitution (prompts contain JSON braces, so no ``str.format``)."""
    for name, value in values.items():
        template = template.replace("{" + name + "}", value)
    return template


def parse_reply(text: str) -> dict[str, Any] | None:
    """The JSON object in ``text``: the whole text, or a fenced block. ``None`` = invalid."""
    candidates = [text.strip()]
    fenced = _FENCE.search(text)
    if fenced:
        candidates.append(fenced.group(1))
    for candidate in candidates:
        try:
            value = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(value, dict):
            return value
    return None


def _clip(text: str) -> str:
    return text if len(text) <= MAX_TOOL_TEXT else text[:MAX_TOOL_TEXT] + " …[cut]"


def _arg(args: dict[str, Any], name: str, limit: int = 200) -> str:
    value = args.get(name)
    if not isinstance(value, str) or not value or len(value) > limit:
        raise ValueError(f"argument {name!r} must be a non-empty string")
    return value


@dataclass
class _Outcome:
    stop: bool = False
    action_id: str | None = None


class LiveAgents:
    """Same surface as ``ScriptedAgents``; scenario flags (``disable_compromise`` ...) are ignored,
    because here the model alone decides what it does."""

    def __init__(self, runtime: Runtime, fixtures: Fixtures, llm: Llm) -> None:
        self._rt = runtime
        self._fx = fixtures
        self._llm = llm
        # agents that were cut at the step limit while still working (the UI says so)
        self.exhausted: list[str] = []

    # ------------------------------------------------------------------ the loop
    def _converse(
        self,
        agent: str,
        number: int,
        handlers: dict[str, Callable[[dict[str, Any], _Outcome], str]],
    ) -> _Outcome:
        system = render(load_prompt(agent), number=str(number), tool_menu=TOOL_MENUS[agent])
        messages = [{"role": "system", "content": system}, {"role": "user", "content": "Start."}]
        outcome = _Outcome()
        retried = False
        finished = False
        steps = 0
        limit = self._llm.max_steps
        while steps < limit and not outcome.stop:
            reply = self._llm.complete(messages)
            parsed = parse_reply(reply)
            if parsed is None:
                if retried:
                    logger.info("%s: invalid JSON twice, session stopped", agent)
                    finished = True
                    break
                retried = True
                messages += [
                    {"role": "assistant", "content": reply},
                    {"role": "user", "content": "Invalid JSON. Reply with JSON only."},
                ]
                continue
            if parsed.get("done") is True:
                finished = True
                break
            steps += 1
            tool = parsed.get("tool")
            args = parsed.get("args")
            handler = handlers.get(tool) if isinstance(tool, str) else None
            if handler is None:
                result = f"ERROR: unknown tool {tool!r}"
            elif not isinstance(args, dict):
                result = "ERROR: args must be an object"
            else:
                result = self._call(handler, args, outcome)
            messages += [
                {"role": "assistant", "content": reply},
                {"role": "user", "content": f"TOOL RESULT {tool}: {_clip(result)}"},
            ]
        if not finished and not outcome.stop:
            self.exhausted.append(agent)
        return outcome

    @staticmethod
    def _call(
        handler: Callable[[dict[str, Any], _Outcome], str], args: dict[str, Any], out: _Outcome
    ) -> str:
        try:
            return handler(args, out)
        except PathwardenError as exc:  # not found, quarantined, unknown tool ...: fail closed
            return f"ERROR: {type(exc).__name__}"
        except (ValueError, TypeError, KeyError, FileNotFoundError, ValidationError) as exc:
            return f"ERROR: {type(exc).__name__}"

    # ------------------------------------------------------------------ Triage
    def triage(self, n: int, day: str, **_flags: object) -> SessionInfo:
        rt = self._rt
        task_ref = f"issue:{n}"
        sid = rt.start_session("triage", day, task_ref)

        def fetch_issue(args: dict[str, Any], _out: _Outcome) -> str:
            number = int(args["number"])
            text = self._fx.issue_text(number)
            raw = rt.read_source(sid, "fetch_issue", f"src:issue:{number}", text)
            self._extract_task(sid, raw, number, text)  # infrastructure, not a Triage tool (§12.3)
            return text

        def memory_write(args: dict[str, Any], _out: _Outcome) -> str:
            rt.write(sid, "memory_write", "memory", _arg(args, "key"), _arg(args, "content", 4000))
            return "OK"

        self._converse("triage", n, {"fetch_issue": fetch_issue, "memory_write": memory_write})
        return SessionInfo(sid, "triage", day, task_ref)

    def _extract_task(self, sid: str, raw_artifact: str, number: int, text: str) -> None:
        """Live ``extract_task``: only the raw issue text goes to the model; the answer must
        validate against ``TaskSchema``; the sanitized artifact derives from the raw one alone."""
        prompt = render(load_prompt("extractor"), number=str(number), issue_text=text)
        reply = self._llm.complete([{"role": "user", "content": prompt}])
        parsed = parse_reply(reply)
        if parsed is None:
            return
        try:
            task = TaskSchema.model_validate(parsed)
        except ValidationError:
            return  # invalid -> no sanitized artifact (the same outcome as the scripted extractor)
        self._rt.sanitize(sid, raw_artifact, task.model_dump(), f"task:{number}")

    # ------------------------------------------------------------------ Fixer
    def fixer(self, n: int, day: str, **_flags: object) -> SessionInfo:
        rt = self._rt
        task_ref = f"issue:{n}"
        sid = rt.start_session("fixer", day, task_ref)

        def memory_read(args: dict[str, Any], _out: _Outcome) -> str:
            return rt.load_by_key(sid, "memory_read", _arg(args, "key"))[1]

        def memory_list(args: dict[str, Any], _out: _Outcome) -> str:
            loaded = rt.load_by_prefix(sid, "memory_read", _arg(args, "prefix"))
            keys = {d["id"]: d["key"] for d in rt.node_details([a for a, _ in loaded])}
            return json.dumps([{"key": keys.get(a, ""), "content": c} for a, c in loaded])

        def read_env(args: dict[str, Any], _out: _Outcome) -> str:
            key = _arg(args, "key")
            if key not in ENV_KEYS:
                raise ValueError("unknown env key")
            value = self._fx.env()[key]
            rt.read_source(sid, "read_env", f"src:env:{key}", value)
            return value

        def read_doc(args: dict[str, Any], _out: _Outcome) -> str:
            if _arg(args, "name") != "security_guide":
                raise ValueError("unknown doc")
            text = self._fx.doc("security_guide")
            rt.read_source(sid, "read_doc", "src:docs:security_guide", text)
            return text

        def workspace_write(args: dict[str, Any], _out: _Outcome) -> str:
            key = _arg(args, "key")
            kind = "patch" if key.startswith("patch:") else "draft"
            rt.write(sid, "workspace_write", kind, key, _arg(args, "content", 4000))
            return "OK"

        self._converse(
            "fixer",
            n,
            {
                "memory_read": memory_read,
                "memory_list": memory_list,
                "read_env": read_env,
                "read_doc": read_doc,
                "workspace_write": workspace_write,
            },
        )
        return SessionInfo(sid, "fixer", day, task_ref)

    # ------------------------------------------------------------------ Release
    def release(self, n: int, day: str) -> tuple[SessionInfo, str | None]:
        """Returns the session and the proposed action, or ``None`` when the model never posted."""
        rt = self._rt
        task_ref = f"issue:{n}"
        sid = rt.start_session("release", day, task_ref)

        def workspace_read(args: dict[str, Any], _out: _Outcome) -> str:
            return rt.load_by_key(sid, "workspace_read", _arg(args, "key"))[1]

        def post_release(args: dict[str, Any], out: _Outcome) -> str:
            payload_id, _exists = rt.find_key("workspace_read", _arg(args, "key"))
            if payload_id is None:
                raise ValueError("nothing to post under that key")
            out.action_id = rt.propose(sid, "post_release", payload_id)
            out.stop = True
            return "OK: proposed"

        outcome = self._converse(
            "release", n, {"workspace_read": workspace_read, "post_release": post_release}
        )
        return SessionInfo(sid, "release", day, task_ref), outcome.action_id
