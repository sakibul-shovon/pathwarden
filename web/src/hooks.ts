import { useCallback, useEffect, useRef, useState } from "react";

/** Polling only (plan §19): call `load` now and every `intervalMs` while mounted. */
export function usePoll<T>(
  load: () => Promise<T>,
  intervalMs: number,
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
    reload();
    const timer = window.setInterval(reload, intervalMs);
    return () => window.clearInterval(timer);
  }, [reload, intervalMs]);

  return { data, error, reload };
}

/** Re-render when the OS colour scheme changes (Cytoscape styles are computed in JS). */
export function useThemeTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setTick((n) => n + 1);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return tick;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
