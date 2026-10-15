"""Replay a plan §20.1 scenario into a Runtime, mapping the scenario's local refs to real ids."""

from __future__ import annotations

from api.runtime.runtime import Runtime


class ReplayError(ValueError):
    """The scenario is malformed (unknown op or reference). Replay fails closed."""


def replay(runtime: Runtime, scenario: dict) -> dict[str, str]:
    """Execute ``scenario["events"]`` in order. Returns {local name -> real id}."""
    for source in scenario.get("extra_sources", []):
        runtime.add_source(source["id"], source["kind"], source["trust"], source["label"])

    ids: dict[str, str] = {}

    def real(name: str) -> str:
        try:
            return ids[name]
        except KeyError:
            raise ReplayError(f"unknown reference {name!r}") from None

    for index, event in enumerate(scenario["events"]):
        op = event.get("op")
        try:
            if op == "start_session":
                ids[event["sid"]] = runtime.start_session(
                    event["agent"], event["day"], event["task_ref"]
                )
            elif op == "read_source":
                ids[event["ref"]] = runtime.read_source(
                    real(event["sid"]), event["tool"], event["source_id"], event["content"]
                )
            elif op == "sanitize":
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
