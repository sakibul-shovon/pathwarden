import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "./theme";

/** Polling only (plan §19): call `load` now and every `intervalMs` while mounted. */
export function usePoll<T>(
  load: () => Promise<T>,
  intervalMs: number,
  enabled = true,
): { data: T | null; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => {
    loadRef
      .current()
      .then((value) => {
        setData(value);
        setError(null);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    if (!enabled) return;
    reload();
    const timer = window.setInterval(reload, intervalMs);
    return () => window.clearInterval(timer);
  }, [reload, intervalMs, enabled]);

  return { data, error, reload };
}

/** Re-render when the theme changes (Cytoscape styles are computed in JS). Returns the resolved theme. */
export function useThemeTick(): string {
  return useTheme().theme;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
