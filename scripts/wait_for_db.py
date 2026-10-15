"""Wait until FalkorDB answers (stdlib only, so it runs before the dependencies are installed).

``make up`` calls it after ``docker compose up -d``: the container is "started" a moment before the
database accepts commands, and ``make demo`` right after ``make up`` must not race it.
Host and port come from PW_FALKORDB_HOST / PW_FALKORDB_PORT (default localhost:6379).
"""

from __future__ import annotations

import os
import socket
import sys
import time

HOST = os.environ.get("PW_FALKORDB_HOST") or "localhost"
PORT = int(os.environ.get("PW_FALKORDB_PORT") or 6379)
TIMEOUT_S = 90


def answers() -> bool:
    try:
        with socket.create_connection((HOST, PORT), timeout=2) as sock:
            sock.settimeout(2)
            sock.sendall(b"PING\r\n")
            # +PONG, or an error such as -NOAUTH: either way the server is up
            return sock.recv(16)[:1] in (b"+", b"-")
    except OSError:
        return False


def main() -> int:
    deadline = time.monotonic() + TIMEOUT_S
    while time.monotonic() < deadline:
        if answers():
            print(f"FalkorDB is answering at {HOST}:{PORT}")
            return 0
        time.sleep(1)
    print(f"FalkorDB did not answer at {HOST}:{PORT} within {TIMEOUT_S} s", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
