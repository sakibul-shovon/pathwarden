import { useCallback, useEffect, useState } from "react";
import { api, isDatabaseDown, isUnreachable } from "../api/client";
import type { HealthInfo } from "../api/types";

export type HealthState =
  | { status: "connecting" }
  | { status: "ok"; info: HealthInfo }
  | { status: "db_down"; detail: string }
  | { status: "unreachable"; detail: string }
  | { status: "error"; code: string; detail: string };

/** One health check on load and on `retry()`: it decides whether the app can show data at all. */
export function useHealth(): { health: HealthState; retry: () => void } {
  const [health, setHealth] = useState<HealthState>({ status: "connecting" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .health()
      .then((info) => {
        if (!cancelled) setHealth({ status: "ok", info });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const detail = err instanceof Error ? err.message : String(err);
        if (isUnreachable(err)) setHealth({ status: "unreachable", detail });
        else if (isDatabaseDown(err)) setHealth({ status: "db_down", detail });
        else setHealth({ status: "error", code: (err as { code?: string }).code ?? "error", detail });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setHealth({ status: "connecting" });
    setAttempt((n) => n + 1);
  }, []);

  return { health, retry };
}
