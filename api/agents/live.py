"""Live LLM agents (plan §12.3): the scripted agents' three roles and tools, driven by a model.

Each agent is a loop of at most ``MAX_STEPS`` model replies. A reply is JSON only: ``{"tool": ..,
"args": {..}}`` or ``{"done": true}``. An invalid reply gets ONE retry; a second invalid reply stops
the session. The system prompts (``api/agents/prompts/*.txt``) describe the role and tools and say
nothing about security or Pathwarden: the point is realistic behaviour. Agents never hold a graph
handle: every effect goes through ``Runtime`` (rules 4 and 5); tool results returned to the model
never include anything the runtime did not record.

``extract_task`` is infrastructure, not a tool: the orchestrator runs it right after Triage's first
``fetch_issue`` of the task's own issue, sending only the raw issue text, and validates the reply
against ``TaskSchema`` (fail closed: no valid reply, no sanitized artifact).
"""

from __future__ import annotations

import json
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from api.agents.schema import TaskSchema
from api.agents.scripted import ENV_KEYS, Fixtures, SessionInfo
from api.llm import Llm, LlmError, parse_json_reply
from api.runtime.errors import PathwardenError
from api.runtime.runtime import Runtime

log = logging.getLogger("pathwarden.live")

PROMPTS = Path(__file__).parent / "prompts"
# The plan says 6 (§12.3). The scripted Fixer itself does 9 operations when a convention asks for
# all four env keys, so 6 would cut a compliant model off before it writes the draft: D-032.
MAX_STEPS = 10
MAX_TEXT = 20_000

TOOL_MENUS: dict[str, dict[str, str]] = {
    "triage": {
        "fetch_issue": '{"number": int}',
        "memory_write": '{"key": str, "content": str}',
    },
    "fixer": {
        "memory_read": '{"key": str}',
        "memory_list": '{"prefix": str}',
        "read_env": '{"key": "PORT" | "LOG_LEVEL" | "PAYMENT_API_KEY" | "DEPLOY_TOKEN"}',
        "read_doc": '{"name": "security_guide"}',
        "workspace_write": '{"key": str, "content": str}',
    },
    "release": {
        "workspace_read": '{"key": str}',
        "post_release": '{"key": str}',
    },
}

_PLACEHOLDER = re.compile(r"\{(number|tool_menu|issue_text|action_id)\}")


def tool_menu_text(agent: str) -> str:
    return "; ".join(f"{name} {schema}" for name, schema in TOOL_MENUS[agent].items())


def load_prompt(name: str, **values: object) -> str:
    """The prompt file with its placeholders filled in one pass (the JSON braces stay)."""
    text = (PROMPTS / f"{name}.txt").read_text(encoding="utf-8").rstrip("\n")
    return _PLACEHOLDER.sub(lambda m: str(values[m.group(1)]), text)


class ToolHandler:
    """A tool dispatcher for one session; ``finished`` ends the loop early (after posting)."""

    finished = False

    def __init__(self, agent: str, tools: dict[str, Callable[[dict], str]]) -> None:
        self._agent = agent
        self._tools = tools

    def __call__(self, tool: Any, args: Any) -> str:
        if not isinstance(tool, str) or tool not in TOOL_MENUS[self._agent]:
            return "ERROR: unknown tool"
        if not isinstance(args, dict):
            return "ERROR: args must be an object"
        try:
            return self._tools[tool](args)
        except PathwardenError as err:
            return f"ERROR: {type(err).__name__}"
        except (KeyError, ValueError, TypeError, OSError):
            return "ERROR: bad arguments"


def _text_arg(args: dict, name: str) -> str:
    value = args.get(name)
    if not isinstance(value, str) or not value.strip() or len(value) > MAX_TEXT:
        raise ValueError(name)
    return value


@dataclass
class SessionReport:
    session: str
    agent: str
    steps: int = 0
    stopped: str = ""  # done | finished | max_steps | invalid_json | llm_error


@dataclass
class LiveAgents:
    runtime: Runtime
    fixtures: Fixtures
    llm: Llm
    reports: list[SessionReport] = field(default_factory=list)

    # ------------------------------------------------------------------ the loop
    def _reply(self, messages: list[dict[str, str]]) -> tuple[str, dict] | None:
        """One model reply as a JSON object; ONE retry on invalid output; None stops the session."""
        for attempt in range(2):
            raw = self.llm.complete(messages)
            try:
                parsed = parse_json_reply(raw)
                if isinstance(parsed, dict) and ("tool" in parsed or parsed.get("done") is True):
                    return raw, parsed
            except ValueError:
                pass
            if attempt == 0:
                messages.append({"role": "assistant", "content": raw})
                messages.append({"role": "user", "content": "Reply with JSON only."})
        return None

    def _run(self, report: SessionReport, system: str, handler: ToolHandler) -> None:
        messages = [{"role": "system", "content": system}, {"role": "user", "content": "Start."}]
        try:
            for _ in range(MAX_STEPS):
                answer = self._reply(messages)
                report.steps += 1
                if answer is None:
                    report.stopped = "invalid_json"
                    return
                raw, parsed = answer
                messages.append({"role": "assistant", "content": raw})
                if parsed.get("done") is True:
                    report.stopped = "done"
                    return
                result = handler(parsed.get("tool"), parsed.get("args", {}))
                messages.append(
                    {"role": "user", "content": f"TOOL RESULT {parsed.get('tool')}: {result}"}
                )
                if handler.finished:
                    report.stopped = "finished"
                    return
            report.stopped = "max_steps"
        except LlmError:
            report.stopped = "llm_error"
        finally:
            log.info("live %s session %s stopped: %s", report.agent, report.session, report.stopped)
            self.reports.append(report)

    def _session(self, agent: str, n: int, day: str) -> tuple[SessionInfo, SessionReport]:
        task_ref = f"issue:{n}"
        sid = self.runtime.start_session(agent, day, task_ref)
        return SessionInfo(sid, agent, day, task_ref), SessionReport(sid, agent)

    # ------------------------------------------------------------------ Triage
    def triage(self, n: int, day: str, **_flags: object) -> SessionInfo:
        """Scenario flags (``disable_compromise``...) steer the SCRIPTED agents only; here the
        issue text and the model decide."""
        rt = self.runtime
        info, report = self._session("triage", n, day)
        extracted = False

        def fetch_issue(args: dict) -> str:
            nonlocal extracted
            number = args["number"]
            if not isinstance(number, int) or isinstance(number, bool):
                raise ValueError("number")
            text = self.fixtures.issue_text(number)
            raw = rt.read_source(info.id, "fetch_issue", f"src:issue:{number}", text)
            if number == n and not extracted:
                extracted = True
                self._extract_task(info.id, raw, n, text)
            return text

        def memory_write(args: dict) -> str:
            key, content = _text_arg(args, "key"), _text_arg(args, "content")
            rt.write(info.id, "memory_write", "memory", key, content)
            return f"stored {key}"

        handler = ToolHandler("triage", {"fetch_issue": fetch_issue, "memory_write": memory_write})
        self._run(
            report, load_prompt("triage", number=n, tool_menu=tool_menu_text("triage")), handler
        )
        return info

    def _extract_task(self, session_id: str, raw_id: str, n: int, issue_text: str) -> None:
        """Infrastructure (§12.3): only the raw issue text goes to the model; the reply must
        validate against ``TaskSchema``, otherwise there is no sanitized artifact."""
        prompt = load_prompt("extractor", number=n, issue_text=issue_text)
        try:
            data = parse_json_reply(self.llm.complete([{"role": "user", "content": prompt}]))
            task = TaskSchema.model_validate(data)
        except (LlmError, ValueError, ValidationError):
            log.info("extract_task for issue %s failed validation: no sanitized artifact", n)
            return
        if task.issue_id != n:
            return
        self.runtime.sanitize(session_id, raw_id, task.model_dump(), f"task:{n}")

    # ------------------------------------------------------------------ Fixer
    def fixer(self, n: int, day: str, **_flags: object) -> SessionInfo:
        rt = self.runtime
        info, report = self._session("fixer", n, day)

        def memory_read(args: dict) -> str:
            return rt.load_by_key(info.id, "memory_read", _text_arg(args, "key"))[1]

        def memory_list(args: dict) -> str:
            prefix = args.get("prefix", "")
            if not isinstance(prefix, str):
                raise ValueError("prefix")
            loaded = rt.load_by_prefix(info.id, "memory_read", prefix)
            keys = {d["id"]: d["key"] for d in rt.node_details([a for a, _ in loaded])}
            return json.dumps([{"key": keys[a], "content": c} for a, c in loaded])

        def read_env(args: dict) -> str:
            key = args["key"]
            if key not in ENV_KEYS:
                raise ValueError("key")
            value = self.fixtures.env()[key]
            rt.read_source(info.id, "read_env", f"src:env:{key}", value)
            return f"{key}={value}"

        def read_doc(args: dict) -> str:
            name = args["name"]
            if name != "security_guide":
                raise ValueError("name")
            text = self.fixtures.doc(name)
            rt.read_source(info.id, "read_doc", f"src:docs:{name}", text)
            return text

        def workspace_write(args: dict) -> str:
            key, content = _text_arg(args, "key"), _text_arg(args, "content")
            kind = "patch" if key.startswith("patch:") else "draft"
            rt.write(info.id, "workspace_write", kind, key, content)
            return f"stored {key}"

        handler = ToolHandler(
            "fixer",
            {
                "memory_read": memory_read,
                "memory_list": memory_list,
                "read_env": read_env,
                "read_doc": read_doc,
                "workspace_write": workspace_write,
            },
        )
        self._run(
            report, load_prompt("fixer", number=n, tool_menu=tool_menu_text("fixer")), handler
        )
        return info

    # ------------------------------------------------------------------ Release
    def release(self, n: int, day: str) -> tuple[SessionInfo, str | None]:
        """Returns the proposed action id, or None when the model never asked to post."""
        rt = self.runtime
        info, report = self._session("release", n, day)
        proposed: list[str] = []

        def workspace_read(args: dict) -> str:
            return rt.load_by_key(info.id, "workspace_read", _text_arg(args, "key"))[1]

        def post_release(args: dict) -> str:
            key = _text_arg(args, "key")
            artifact_id, exists = rt.find_key("workspace_read", key)
            if artifact_id is None:
                return "ERROR: quarantined" if exists else "ERROR: no such file"
            proposed.append(rt.propose(info.id, "post_release", artifact_id))
            handler.finished = True
            return f"queued for publication as {proposed[-1]}"

        handler = ToolHandler(
            "release", {"workspace_read": workspace_read, "post_release": post_release}
        )
        self._run(
            report, load_prompt("release", number=n, tool_menu=tool_menu_text("release")), handler
        )
        return info, (proposed[0] if proposed else None)
