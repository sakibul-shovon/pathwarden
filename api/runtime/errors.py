"""Domain errors. Everything fails closed (plan rule 6): unknown or missing means refuse."""

from __future__ import annotations


class PathwardenError(Exception):
    """Base class for all domain errors."""


class UnknownToolError(PathwardenError):
    """The tool name is not in the registry."""


class ToolClassError(PathwardenError):
    """The tool's class (or its source prefix) does not match the requested operation."""


class UnknownAgentError(PathwardenError):
    """No such agent in the graph."""


class NotFoundError(PathwardenError):
    """A session, source, sink, action or artifact needed by the operation does not exist."""


class ArtifactNotFoundError(NotFoundError):
    """No artifact with this id."""


class KeyNotFoundError(NotFoundError):
    """Nothing was ever written under this (store, key)."""


class QuarantinedError(PathwardenError):
    """The artifact, or every version stored under the key, is quarantined."""


class ProvenanceError(PathwardenError):
    """A lineage write did not produce the edges it must (e.g. DERIVED_FROM count mismatch)."""


class ActionStateError(PathwardenError):
    """The action's state does not allow this operation (e.g. approving an executed action)."""
