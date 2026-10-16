"""Record the real run behind the landing page (ui-redesign.md §11.4).

Every figure on the public landing page (the witness plate, the Rule-of-Two letters, the leaked
release page, the held-versus-healed diff) is drawn from JSON recorded here from the real API,
never from hand-typed ids. The output is committed together with how and when it was made, so a
reader can regenerate it.

    python scripts/capture_landing_story.py  # needs the API on 127.0.0.1:8000 (make up && make api)

The script RESETS the local ``tinyqueue`` workspace (it runs ``attack_pipeline_42`` twice and then
forensics), so run it deliberately and never against a hosted tenant: it refuses a non-local API
unless ``--allow-remote`` is given. Scripted mode only: no API key, no LLM call. Standard library
only.
"""

from __future__ import annotations

import argparse
import datetime
import json
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import quote, urlparse

SCENARIO = "attack_pipeline_42"
SINK = "sink:public_release_page"
LOCAL_HOSTS = {"127.0.0.1", "localhost", "::1"}
DEFAULT_OUT = (
    Path(__file__).resolve().parent.parent / "web" / "src" / "landing" / "recorded" / "story.json"
)


class Api:
    def __init__(self, base: str, workspace: str) -> None:
        self.root = f"{base.rstrip('/')}/api"
        self.ws = f"{self.root}/ws/{workspace}"

    def call(
        self, method: str, url: str, body: dict[str, Any] | None = None, human: bool = False
    ) -> Any:
        data = None if body is None else json.dumps(body).encode()
        headers = {"content-type": "application/json"}
        if human:
            # a deliberate action by the person running this script (it resets the demo workspace)
            headers["x-pw-human"] = "true"
        request = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as err:
            raise SystemExit(
                f"{method} {url} -> {err.code}: {err.read().decode(errors='replace')[:300]}"
            ) from err
        except urllib.error.URLError as err:
            raise SystemExit(
                f"cannot reach the API at {url} ({err.reason}); start it with `make up && make api`"
            ) from err

    def get(self, path: str) -> Any:
        return self.call("GET", f"{self.ws}{path}")

    def post(self, path: str, body: dict[str, Any] | None = None, human: bool = False) -> Any:
        return self.call("POST", f"{self.ws}{path}", body or {}, human)


def git_commit() -> str:
    try:
        out = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"], capture_output=True, text=True, check=True
        )
        return out.stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"


def capture(api: Api) -> dict[str, Any]:
    api.post("/reset", human=True)

    # 1. the attack with the guard off: every agent passes the Rule of Two and the secret reaches
    #    the public page
    off_run = api.post(f"/scenarios/{SCENARIO}/run", {"guard": False, "mode": "scripted"})
    off_posted = api.get(f"/sinks/{quote(SINK, safe='')}")

    # 2. the same attack with the guard on: the post is held, both witness paths are returned
    api.post("/reset", human=True)
    on_run = api.post(f"/scenarios/{SCENARIO}/run", {"guard": True, "mode": "scripted"})
    held = next((a for a in on_run["actions"] if a["status"] == "held"), None)
    if held is None:
        raise SystemExit(
            "the guarded run produced no held action: is the API running the demo scenarios?"
        )
    action_id = held["id"]
    action = api.get(f"/actions/{action_id}")
    explain = api.get(f"/actions/{action_id}/explain")

    # 3. forensics: quarantine, sandbox replay, and the held and healed payloads side by side (the
    #    held payload is read before the quarantine changes anything)
    held_artifact = api.get(f"/artifacts/{action['payload_id']}?graph=main")
    report = api.post(f"/forensics/{action_id}", {"mode": "scripted"})
    if not report.get("diff"):
        raise SystemExit("forensics returned no held-versus-healed diff")
    healed_artifact = api.get(f"/artifacts/{report['diff']['healed_payload_id']}?graph=sandbox")

    # leave the demo workspace clean
    api.post("/reset", human=True)

    return {
        "scenario": SCENARIO,
        "guard_off": {"run": off_run, "posted": off_posted},
        "guard_on": {"run": on_run, "action": action, "explain": explain},
        "heal": {"report": report, "held": held_artifact, "healed": healed_artifact},
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument(
        "--api", default="http://127.0.0.1:8000", help="API base URL (default: the local API)"
    )
    parser.add_argument("--workspace", default="tinyqueue")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="allow a non-local API (it resets the workspace!)",
    )
    args = parser.parse_args(argv)

    host = urlparse(args.api).hostname or ""
    if host not in LOCAL_HOSTS and not args.allow_remote:
        raise SystemExit(
            f"refusing to reset a workspace on {host}: pass --allow-remote if you really mean it"
        )

    story = capture(Api(args.api, args.workspace))
    story["generated"] = {
        "command": "python scripts/capture_landing_story.py",
        "date": datetime.date.today().isoformat(),
        "commit": git_commit(),
        "mode": "scripted",
        "note": (
            "Recorded from the real API; ids come from the runtime's namespaced counters. "
            "Regenerate rather than edit."
        ),
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(
        json.dumps(story, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    print(f"recorded {SCENARIO} -> {args.out} ({args.out.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
