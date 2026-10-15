"""Replay a plan §20.1 scenario into a Runtime, mapping the scenario's local refs to real ids."""

from __future__ import annotations

import json

from api.runtime.runtime import Runtime


class ReplayError(ValueError):
    """The scenario is malformed (unknown op or reference). Replay fails closed."""


COARSE_ENV_SOURCE = "src:env:ALL"


def replay(runtime: Runtime, scenario: dict, *, coarse: bool = False) -> dict[str, str]:
    """Execute ``scenario["events"]`` in order. Returns {local name -> real id}.

    ``coarse=True`` applies the three PW-coarse ablation overrides of plan §20.3 (v1 behaviour):
    1. sessions of the same (agent, day) are merged, so context keeps accumulating;
    2. every ``src:env:*`` source becomes ``src:env:ALL`` (one secret artifact for the whole .env);
    3. ``sanitize`` runs as a plain ``memory_write`` (kind memory, ``sanitized: false``) that
       derives from the whole session context, so the sanitizer no longer cuts anything.
    """
    for source in scenario.get("extra_sources", []):
        runtime.add_source(source["id"], source["kind"], source["trust"], source["label"])

    ids: dict[str, str] = {}
    merged: dict[tuple[str, str], str] = {}  # (agent, day) -> real session id (coarse only)

    def real(name: str) -> str:
        try:
            return ids[name]
        except KeyError:
            raise ReplayError(f"unknown reference {name!r}") from None

    for index, event in enumerate(scenario["events"]):
        op = event.get("op")
        try:
            if op == "start_session":
                key = (event["agent"], event["day"])
                if coarse and key in merged:
                    ids[event["sid"]] = merged[key]
                else:
                    ids[event["sid"]] = runtime.start_session(*key, event["task_ref"])
                    merged[key] = ids[event["sid"]]
            elif op == "read_source":
                source_id = event["source_id"]
                if coarse and source_id.startswith("src:env:"):
                    source_id = COARSE_ENV_SOURCE
                ids[event["ref"]] = runtime.read_source(
                    real(event["sid"]), event["tool"], source_id, event["content"]
                )
            elif op == "sanitize":
                if coarse:
                    ids[event["ref"]] = runtime.write(
                        real(event["sid"]),
                        "memory_write",
                        "memory",
                        event["key"],
                        json.dumps(event["extracted"], sort_keys=True),
                    )
                else:
                    ids[event["ref"]] = runtime.sanitize(
                        real(event["sid"]), real(event["input"]), event["extracted"], event["key"]
                    )
            elif op == "write":
                ids[event["ref"]] = runtime.write(
                    real(event["sid"]),
                    event["tool"],
                    event["kind"],
                    event["key"],
                    event["content"],
                    event.get("task_ref", ""),
                )
            elif op == "load":
                runtime.load(real(event["sid"]), event["tool"], real(event["ref_in"]))
            elif op == "approve":
                runtime.approve_artifact(real(event["ref_in"]), event["by"])
            elif op == "propose":
                ids[event["ref"]] = runtime.propose(
                    real(event["sid"]), event["tool"], real(event["payload"])
                )
            else:
                raise ReplayError(f"unknown op {op!r}")
        except KeyError as exc:
            raise ReplayError(f"event {index} ({op}): missing field {exc}") from exc
    return ids
