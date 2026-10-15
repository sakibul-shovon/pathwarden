"""Scripted agents: a deterministic simulation of an LLM that follows injected instructions (§12.2).

They talk to the system only through ``Runtime`` calls (rule 4: agents never hold a graph handle)
and read their inputs from ``fixtures/`` (the synthetic issue tracker, deploy ``.env`` and docs).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

import yaml

from api.agents.render import render_changelog
from api.agents.schema import TaskSchema
from api.runtime.runtime import Runtime

ENV_KEYS = ("PORT", "LOG_LEVEL", "PAYMENT_API_KEY", "DEPLOY_TOKEN")
_COMMENT = re.compile(r"<!--(.*?)-->", re.S)


class Fixtures:
    """Read access to the synthetic data the scripted agents 'see'."""

    def __init__(self, root: Path) -> None:
        self.root = root

    def issue_text(self, n: int) -> str:
        return (self.root / "issues" / f"issue_{n}.md").read_text(encoding="utf-8")

    def env(self) -> dict[str, str]:
        return yaml.safe_load((self.root / "env.yaml").read_text(encoding="utf-8"))

    def doc(self, name: str) -> str:
        return (self.root / "docs" / f"{name}.md").read_text(encoding="utf-8")


@dataclass(frozen=True)
class IssueView:
    """Parsed issue file: ``Title: ..`` / ``Labels: ..`` header, blank line, body."""

    title: str
    labels: tuple[str, ...]
    body: str

    @classmethod
    def parse(cls, text: str) -> IssueView:
        header, _, body = text.partition("\n\n")
        title = next(
            (h[len("Title:") :].strip() for h in header.splitlines() if h.startswith("Title:")), ""
        )
        labels_line = next(
            (h[len("Labels:") :] for h in header.splitlines() if h.startswith("Labels:")), ""
        )
        labels = tuple(x.strip() for x in labels_line.split(",") if x.strip())
        return cls(title, labels, body)

    @property
    def first_body_line(self) -> str:
        return next((line.strip() for line in self.body.splitlines() if line.strip()), "")

    @property
    def hidden_comment(self) -> str | None:
        match = _COMMENT.search(self.body)
        return match.group(1).strip() if match else None


def extract_task(number: int, issue: IssueView) -> TaskSchema:
    """The scripted extractor (§12.2 step 2): fields come from the labels only."""
    labels = issue.labels
    component = "queue" if "queue" in labels else "docs" if "docs" in labels else "other"
    severity = "high" if "bug" in labels and component == "queue" else "low"
    kind = next((label for label in labels if label in ("bug", "docs", "feature")), "bug")
    return TaskSchema(issue_id=number, component=component, severity=severity, kind=kind)


def env_keys_named_in(conventions: list[str]) -> list[str]:
    """Env keys that appear verbatim in any convention, in canonical order."""
    found = [
        key
        for key in ENV_KEYS
        if any(re.search(rf"(?<![A-Z_]){key}(?![A-Z_])", text) for text in conventions)
    ]
    return found


def choose_env_keys(conventions: list[str]) -> list[str]:
    """§12.2 step 3: named keys only; else all four if a convention mentions .env; else PORT."""
    named = env_keys_named_in(conventions)
    if named:
        return named
    if any(".env" in text.lower() for text in conventions):
        return list(ENV_KEYS)
    return ["PORT"]


@dataclass(frozen=True)
class SessionInfo:
    id: str
    agent: str
    day: str
    task_ref: str


class ScriptedAgents:
    def __init__(self, runtime: Runtime, fixtures: Fixtures) -> None:
        self._rt = runtime
        self._fx = fixtures

    # ------------------------------------------------------------------ Triage
    def triage(self, n: int, day: str, *, disable_compromise: bool = False) -> SessionInfo:
        """Read issue ``n``; record a task, a summary and (if compromised) a convention."""
        rt = self._rt
        task_ref = f"issue:{n}"
        sid = rt.start_session("triage", day, task_ref)
        text = self._fx.issue_text(n)
        issue = IssueView.parse(text)

        raw = rt.read_source(sid, "fetch_issue", f"src:issue:{n}", text)
        task = extract_task(
            n, issue
        )  # validated by the Pydantic model; invalid -> exception, no artifact
        rt.sanitize(sid, raw, task.model_dump(), f"task:{n}")
        rt.write(sid, "memory_write", "memory", f"issue_summary:{n}", issue.first_body_line)

        comment = issue.hidden_comment
        if comment is not None and not disable_compromise:
            rt.write(sid, "memory_write", "memory", f"team_convention:{n}", comment)
        return SessionInfo(sid, "triage", day, task_ref)

    # ------------------------------------------------------------------ Fixer
    def fixer(self, n: int, day: str, *, cite_security_guide: bool = False) -> SessionInfo:
        """Read the task and all team conventions, read the env keys they ask for, write a draft."""
        rt = self._rt
        task_ref = f"issue:{n}"
        sid = rt.start_session("fixer", day, task_ref)

        _, task_json = rt.load_by_key(sid, "memory_read", f"task:{n}")
        conventions = [
            content for _, content in rt.load_by_prefix(sid, "memory_read", "team_convention:")
        ]

        env = self._fx.env()
        env_values: dict[str, str] = {}
        for key in choose_env_keys(conventions):
            rt.read_source(sid, "read_env", f"src:env:{key}", env[key])
            env_values[key] = env[key]
        if cite_security_guide:
            rt.read_source(
                sid, "read_doc", "src:docs:security_guide", self._fx.doc("security_guide")
            )

        component = TaskSchema.model_validate_json(task_json).component
        rt.write(sid, "workspace_write", "patch", f"patch:{n}", f"Patch for #{n} ({component})")
        title = IssueView.parse(self._fx.issue_text(n)).title
        draft = render_changelog(title, n, env_values, conventions, cite_security_guide)
        rt.write(sid, "workspace_write", "draft", f"changelog:{n}", draft)
        return SessionInfo(sid, "fixer", day, task_ref)

    # ------------------------------------------------------------------ Release
    def release(self, n: int, day: str) -> tuple[SessionInfo, str]:
        """Load the latest non-quarantined changelog and propose posting it; returns the action."""
        rt = self._rt
        task_ref = f"issue:{n}"
        sid = rt.start_session("release", day, task_ref)
        artifact_id, _ = rt.load_by_key(sid, "workspace_read", f"changelog:{n}")
        action_id = rt.propose(sid, "post_release", artifact_id)
        return SessionInfo(sid, "release", day, task_ref), action_id
