import { useCallback, useEffect, useRef, useState } from "react";
import { isMutating, subscribeActivity } from "./shared/lib/activity";

/** Polling only (plan §19): call `load` now and every `intervalMs` while mounted. Ticks are skipped while the tab is
 *  hidden or while a mutating request is in flight (it holds the workspace lock, so a poll would only queue behind it);
 *  the data is refreshed as soon as the tab is visible / the mutation has finished. */
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
    const tick = (): void => {
      if (!document.hidden && !isMutating()) reload();
    };
    const timer = window.setInterval(tick, intervalMs);
    const onVisible = (): void => {
      if (!document.hidden) reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    const offActivity = subscribeActivity(() => {
      if (!isMutating()) reload();
    });
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      offActivity();
    };
  }, [reload, intervalMs]);

  return { data, error, reload };
}

/** Re-render when the colour scheme changes: the OS setting or the manual `data-theme` switch (Cytoscape styles are
 *  computed in JS, so they must be rebuilt). */
export function useThemeTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (): void => setTick((n) => n + 1);
    media.addEventListener("change", onChange);
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      media.removeEventListener("change", onChange);
      observer.disconnect();
    };
  }, []);
  return tick;
}

export function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
