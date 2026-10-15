"""The lineage writer (plan §9). Only this module writes provenance (rule 4).

Design points:
* One Runtime = one graph + one id namespace. Main: ``""`` (``a-0001``); sandbox: ``"sbx"``
  (``a-sbx-0001``). Counters and the logical clock are rebuilt from the graph on construction,
  so a Runtime can be recreated at any time without id or clock collisions.
* Session context is read from the graph immediately before each write; nothing is cached.
* Every graph access is a named query (``api/graph/queries``). Unknown or missing means refuse.
"""

from __future__ import annotations

import hashlib
import json
import re
import threading
from collections.abc import Iterator
from contextlib import contextmanager

from api.graph.client import NamedGraph
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
from api.runtime.registry import Registry

# Re-exported so callers can import every domain error from one place.
__all__ = [
    "ArtifactNotFoundError",
    "KeyNotFoundError",
    "LogicalClock",
    "NotFoundError",
    "ProvenanceError",
    "QuarantinedError",
    "Runtime",
    "ToolClassError",
    "UnknownAgentError",
]

ID_PREFIXES = {
    "session": "s-",
    "artifact": "a-",
    "action": "act-",
    "approval": "apr-",
    "quarantine": "q-",
}
WRITE_KINDS = frozenset({"memory", "draft", "patch"})
TRUST_LEVELS = frozenset({"untrusted", "internal", "secret"})
_NAMESPACE = re.compile(r"^[a-z]+$")


def sha256_hex(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


class LogicalClock:
    """Integer clock; the only source of time stored in the graph (no wall-clock values)."""

    def __init__(self, start: int = 1) -> None:
        self._next = start

    @property
    def next_value(self) -> int:
        return self._next

    def tick(self) -> int:
        value = self._next
        self._next += 1
        return value


class Runtime:
    def __init__(
        self,
        graph: NamedGraph,
        registry: Registry,
        *,
        namespace: str = "",
        events: EventLog | None = None,
    ) -> None:
        if namespace and not _NAMESPACE.match(namespace):
            raise ValueError(f"invalid id namespace {namespace!r}")
        self._graph = graph
        self._registry = registry
        self.namespace = namespace
        self.events = events if events is not None else EventLog()
        self._lock = threading.RLock()
        infix = f"{namespace}-" if namespace else ""
        self._prefix = {kind: f"{prefix}{infix}" for kind, prefix in ID_PREFIXES.items()}
        self._clock = LogicalClock(self._initial_clock())
        self._counters = {kind: self._initial_counter(p) for kind, p in self._prefix.items()}

    # ------------------------------------------------------------------ id and clock state
    def _initial_clock(self) -> int:
        rows = self._graph.run("q0_max_ts")
        max_ts = rows[0][0] if rows and rows[0][0] is not None else 0
        return int(max_ts) + 1

    def _initial_counter(self, prefix: str) -> int:
        # The query matches by STARTS WITH, so prefix "a-" also returns "a-sbx-0003": keep only
        # ids of exactly this namespace.
        exact = re.compile(rf"^{re.escape(prefix)}(\d+)$")
        numbers = [
            int(m.group(1))
            for (identifier,) in self._graph.run("q0_ids_with_prefix", prefix=prefix)
            if (m := exact.match(identifier))
        ]
        return max(numbers, default=0) + 1

    @contextmanager
    def _alloc(self, kind: str) -> Iterator[tuple[str, int]]:
        """Reserve the next id and clock value; consume them only if the body succeeds."""
        with self._lock:
            ident = f"{self._prefix[kind]}{self._counters[kind]:04d}"
            ts = self._clock.next_value
            yield ident, ts
            self._counters[kind] += 1
            self._clock.tick()

    def resync(self) -> None:
        """Re-read the clock and the id counters from the graph.

        Needed when several processes write to one graph (one MCP gateway process per agent): a
        long-lived runtime would otherwise reuse ids another process has already taken.
        """
        with self._lock:
            self._clock = LogicalClock(self._initial_clock())
            self._counters = {kind: self._initial_counter(p) for kind, p in self._prefix.items()}

    # ------------------------------------------------------------------ small helpers
    def _context(self, session_id: str) -> list[str]:
        return [row[0] for row in self._graph.run("q1_session_context", session_id=session_id)]

    def _log(self, **event: object) -> None:
        self.events.append(event)

    # ------------------------------------------------------------------ registry-driven setup
    def add_agent(self, agent_id: str, role: str) -> None:
        """Idempotent (evaluation extras)."""
        with self._lock:
            self._graph.run("q1_add_agent", id=agent_id, role=role)

    def add_source(self, source_id: str, kind: str, trust: str, label: str) -> None:
        """Idempotent (evaluation extras, gateway ``src:unmanaged:*``). Trust is not LLM-derived."""
        if trust not in TRUST_LEVELS:
            raise ValueError(f"invalid trust {trust!r}")
        with self._lock:
            self._graph.run("q1_add_source", id=source_id, kind=kind, trust=trust, label=label)

    # ------------------------------------------------------------------ sessions and reads
    def start_session(self, agent_id: str, day_label: str, task_ref: str) -> str:
        """Session + (Agent)-[:RAN]->(Session). Context starts empty. Returns the session id."""
        with self._alloc("session") as (sid, ts):
            rows = self._graph.run(
                "q1_start_session",
                agent_id=agent_id,
                session_id=sid,
                day_label=day_label,
                task_ref=task_ref,
                ts=ts,
            )
            if not rows:
                raise UnknownAgentError(agent_id)
        self._log(op="start_session", agent=agent_id, day=day_label, task_ref=task_ref, sid=sid)
        return sid

    def read_source(self, session_id: str, tool: str, source_id: str, content: str) -> str:
        """Raw artifact + ORIGINATES_FROM + PRODUCED; joins the session context."""
        definition = self._registry.tool_of_class(tool, "read")
        if not source_id.startswith(definition.source_prefix or "\0"):
            raise ToolClassError(f"source {source_id!r} does not match tool {tool}'s prefix")
        with self._alloc("artifact") as (aid, ts):
            rows = self._graph.run(
                "q1_read_source",
                session_id=session_id,
                source_id=source_id,
                artifact_id=aid,
                content=content,
                content_hash=sha256_hex(content),
                ts=ts,
            )
            if not rows:
                raise NotFoundError(f"session {session_id!r} or source {source_id!r} not found")
        self._log(
            op="read_source",
            sid=session_id,
            tool=tool,
            source_id=source_id,
            content=content,
            ref=aid,
        )
        return aid

    def load(self, session_id: str, tool: str, artifact_id: str) -> str:
        """(Session)-[:LOADED]->(Artifact). Raises if the artifact is missing or quarantined."""
        self._registry.tool_of_class(tool, "load")
        with self._lock:
            rows = self._graph.run("q1_load", session_id=session_id, artifact_id=artifact_id)
            if rows:
                self._log(op="load", sid=session_id, tool=tool, ref_in=artifact_id)
                return rows[0][1]
            found = self._graph.run("q1_get_artifact", artifact_id=artifact_id)
        if not found:
            raise ArtifactNotFoundError(artifact_id)
        if found[0][10]:  # quarantined
            raise QuarantinedError(artifact_id)
        raise NotFoundError(f"session {session_id!r} not found")

    def load_by_key(self, session_id: str, tool: str, key: str) -> tuple[str, str]:
        """Load the latest non-quarantined artifact stored under ``key``. Returns (id, content)."""
        definition = self._registry.tool_of_class(tool, "load")
        with self._lock:
            rows = self._graph.run("q1_lookup_key", store=definition.store, key=key)
            if rows:
                artifact_id = rows[0][0]
                return artifact_id, self.load(session_id, tool, artifact_id)
            existing = self._graph.run("q1_key_exists", store=definition.store, key=key)
        if existing and existing[0][0] > 0:
            raise QuarantinedError(f"every version of {key!r} is quarantined")
        raise KeyNotFoundError(key)

    def load_by_prefix(self, session_id: str, tool: str, prefix: str) -> list[tuple[str, str]]:
        """Load the latest non-quarantined version of every key starting with ``prefix``.

        Results are loaded in ``created_at`` order. May be empty.
        """
        definition = self._registry.tool_of_class(tool, "load")
        with self._lock:
            rows = self._graph.run("q1_lookup_prefix", store=definition.store, prefix=prefix)
            latest: dict[str, tuple[str, int]] = {}
            for artifact_id, key, created_at in rows:  # rows arrive oldest first
                latest[key] = (artifact_id, created_at)
            ordered = sorted(latest.values(), key=lambda item: item[1])
            return [(aid, self.load(session_id, tool, aid)) for aid, _ in ordered]

    def find_key(self, tool: str, key: str) -> tuple[str | None, bool]:
        """Look up ``key`` in the tool's store without loading it.

        Returns ``(id of the latest non-quarantined version or None, whether any version exists)``.
        """
        definition = self._registry.tool_of_class(tool, "load")
        with self._lock:
            rows = self._graph.run("q1_lookup_key", store=definition.store, key=key)
            if rows:
                return rows[0][0], True
            existing = self._graph.run("q1_key_exists", store=definition.store, key=key)
        return None, bool(existing and existing[0][0] > 0)

    # ------------------------------------------------------------------ writes
    def write(
        self,
        session_id: str,
        tool: str,
        kind: str,
        key: str,
        content: str,
        task_ref: str = "",
    ) -> str:
        """Artifact in the tool's store, DERIVED_FROM every artifact in the session context."""
        definition = self._registry.tool_of_class(tool, "write")
        if kind not in WRITE_KINDS:
            raise ToolClassError(f"cannot write artifacts of kind {kind!r}")
        with self._alloc("artifact") as (aid, ts):
            context = self._context(session_id)
            rows = self._graph.run(
                "q1_write",
                session_id=session_id,
                artifact_id=aid,
                kind=kind,
                key=key,
                store=definition.store,
                content=content,
                content_hash=sha256_hex(content),
                ts=ts,
                task_ref=task_ref,
                context_ids=context,
            )
            # q1_write ends in an aggregate (count): it returns [[0]] even when its MATCH found
            # no session and nothing was created. Verify the artifact exists before trusting it.
            if not rows or not self._graph.run("q1_get_artifact", artifact_id=aid):
                raise NotFoundError(f"session {session_id!r} not found")
            if rows[0][0] != len(context):
                raise ProvenanceError(f"{aid}: derived {rows[0][0]} of {len(context)} edges")
        event = {
            "op": "write",
            "sid": session_id,
            "tool": tool,
            "kind": kind,
            "key": key,
            "content": content,
            "ref": aid,
        }
        if task_ref:
            event["task_ref"] = task_ref
        self._log(**event)
        return aid

    def sanitize(self, session_id: str, input_artifact_id: str, extracted: dict, key: str) -> str:
        """Sanitized artifact derived from ONLY ``input_artifact_id`` (schema already validated)."""
        content = json.dumps(extracted, sort_keys=True)
        with self._alloc("artifact") as (aid, ts):
            rows = self._graph.run(
                "q1_sanitize",
                session_id=session_id,
                input_id=input_artifact_id,
                artifact_id=aid,
                key=key,
                content=content,
                content_hash=sha256_hex(content),
                ts=ts,
            )
            if not rows:
                raise NotFoundError(f"session {session_id!r} or input {input_artifact_id!r}")
        self._log(
            op="sanitize",
            sid=session_id,
            input=input_artifact_id,
            key=key,
            extracted=extracted,
            ref=aid,
        )
        return aid

    # ------------------------------------------------------------------ actions
    def propose(self, session_id: str, tool: str, payload_artifact_id: str) -> str:
        """Action(status='proposed') + PAYLOAD + TARGETS + PROPOSED. Nothing is executed here."""
        definition = self._registry.tool_of_class(tool, "external")
        with self._alloc("action") as (action_id, ts):
            rows = self._graph.run(
                "q1_propose",
                session_id=session_id,
                payload_id=payload_artifact_id,
                sink_id=definition.sink,
                action_id=action_id,
                tool=tool,
                ts=ts,
            )
            if not rows:
                raise NotFoundError(
                    f"session {session_id!r}, payload {payload_artifact_id!r} or sink not found"
                )
        self._log(
            op="propose", sid=session_id, tool=tool, payload=payload_artifact_id, ref=action_id
        )
        return action_id

    def approve_artifact(self, artifact_id: str, approver: str) -> None:
        """Human declassification: Approval + APPROVES; ``approved = true`` on the artifact."""
        with self._alloc("approval") as (approval_id, ts):
            rows = self._graph.run(
                "q1_approve_artifact",
                artifact_id=artifact_id,
                approval_id=approval_id,
                by=approver,
                ts=ts,
            )
            if not rows:
                raise ArtifactNotFoundError(artifact_id)
        self._log(op="approve", ref_in=artifact_id, by=approver)

    def approve(self, action_id: str, approver: str) -> None:
        """Approve the payload of ``action_id`` (resolved with ``q2d``). Human endpoints only."""
        rows = self._graph.run("q2d_action_context", action_id=action_id)
        if not rows:
            raise NotFoundError(f"action {action_id!r} not found")
        payload_id = rows[0][1]
        if payload_id is None:
            raise ProvenanceError(f"action {action_id!r} has no payload")
        self.approve_artifact(payload_id, approver)

    def set_action_status(self, action_id: str, status: str, reason: str = "") -> None:
        with self._lock:
            rows = self._graph.run(
                "q1_set_action_status", action_id=action_id, status=status, reason=reason
            )
        if not rows:
            raise NotFoundError(f"action {action_id!r} not found")

    def supersede(self, old_action_id: str, new_action_id: str) -> None:
        with self._lock:
            rows = self._graph.run("q1_supersede", old_id=old_action_id, new_id=new_action_id)
        if not rows:
            raise NotFoundError(f"action {old_action_id!r} or {new_action_id!r} not found")

    def node_details(self, ids: list[str]) -> list[dict]:
        """Metadata (never content) of nodes by id (``q6b``)."""
        columns = (
            "id",
            "label",
            "kind",
            "trust",
            "sanitized",
            "approved",
            "quarantined",
            "agent_id",
            "session_id",
            "key",
            "created_at",
        )
        rows = self._graph.run("q6b_node_details", ids=sorted(set(ids)))
        return [dict(zip(columns, row, strict=True)) for row in rows]

    def apply_quarantine(self, source_id: str, artifact_ids: list[str], by: str) -> tuple[str, int]:
        """Mark ``artifact_ids`` quarantined and record a ``Quarantine`` audit node (reversible)."""
        ids = sorted(set(artifact_ids))
        if len(self.node_details(ids)) != len(ids):
            raise NotFoundError("some artifacts to quarantine do not exist")
        with self._alloc("quarantine") as (qid, ts):
            rows = self._graph.run(
                "q4c_quarantine_apply",
                qid=qid,
                source_id=source_id,
                ts=ts,
                by=by,
                artifact_ids=ids,
            )
            count = rows[0][0] if rows else 0
            if count != len(ids):
                raise ProvenanceError(f"{qid}: quarantined {count} of {len(ids)} artifacts")
        return qid, count

    def release_quarantine(self, quarantine_id: str) -> int:
        """Human undo: un-quarantine everything covered by ``quarantine_id`` (``q4d``)."""
        with self._lock:
            rows = self._graph.run("q4d_quarantine_release", qid=quarantine_id)
        released = rows[0][0] if rows else 0
        if released == 0:  # count() returns a row even for an unknown id
            raise NotFoundError(f"quarantine {quarantine_id!r} not found")
        return released

    def action_context(self, action_id: str) -> dict:
        """Payload, sink and external flag of an action (``q2d``); ids only, never content."""
        rows = self._graph.run("q2d_action_context", action_id=action_id)
        if not rows:
            raise NotFoundError(f"action {action_id!r} not found")
        _, payload_id, sink_id, external = rows[0]
        return {
            "action_id": action_id,
            "payload_id": payload_id,
            "sink_id": sink_id,
            "external": external,
        }

    def list_actions(self) -> list[dict]:
        """Every action with its current status (``q7b`` at the current clock), oldest first."""
        rows = self._graph.run("q7b_actions_at_time", t=self._clock.next_value)
        actions = [{"id": a, "status": s, "payload_id": p} for a, s, p in rows]
        return sorted(actions, key=lambda action: action["id"])

    def get_action(self, action_id: str) -> dict:
        for action in self.list_actions():
            if action["id"] == action_id:
                return action
        raise NotFoundError(f"action {action_id!r} not found")

    # ------------------------------------------------------------------ reads for agents/UI only
    def get_artifact(self, artifact_id: str) -> dict:
        """Full artifact including ``content``. Never used by the gate or the Forensic Agent."""
        rows = self._graph.run("q1_get_artifact", artifact_id=artifact_id)
        if not rows:
            raise ArtifactNotFoundError(artifact_id)
        names = (
            "id kind key store content agent_id session_id created_at "
            "sanitized approved quarantined"
        ).split()
        return dict(zip(names, rows[0], strict=True))
