import { useCallback, useEffect, useState } from "react";
import { api, ApiError, hasKey } from "../api/client";

/** Can this browser open the workspace? (ui-redesign.md §12.2.) The probe is `GET /api/ws/{ws}/scenarios`: it goes
 *  through the same access check as every workspace route but only returns the static scenario list, so it touches no graph. */
export type AccessState = "checking" | "open" | "needs_key" | "rejected" | "forbidden" | "error";

export function useAccess(workspace: string, enabled: boolean): { access: AccessState; recheck: () => void } {
  const [access, setAccess] = useState<AccessState>("checking");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setAccess("checking");
    api
      .scenarios()
      .then(() => {
        if (!cancelled) setAccess("open");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) setAccess(hasKey() ? "rejected" : "needs_key");
        else if (err instanceof ApiError && err.status === 403) setAccess("forbidden");
        else setAccess("error"); // not an access problem: the views show their own errors
      });
    return () => {
      cancelled = true;
    };
  }, [workspace, enabled, attempt]);

  const recheck = useCallback(() => setAttempt((n) => n + 1), []);
  return { access, recheck };
}

export const blocksWorkspaceViews = (access: AccessState): boolean =>
  access === "needs_key" || access === "rejected" || access === "forbidden";
