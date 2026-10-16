import { useEffect, useState } from "react";

/** Elapsed milliseconds since `active` became true, ticking once a second, and whether the wait is "slow" (> 1 s).
 *  Under one second a button label is enough feedback; beyond it the user needs to see that work is going on
 *  (NN/g response-time limits, ui-redesign.md §14.3). No percent and no estimate: the API reports no progress. */
export function useElapsed(active: boolean): { elapsedMs: number; slow: boolean } {
  const [elapsedMs, setElapsedMs] = useState(0);
  useEffect(() => {
    if (!active) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    setElapsedMs(0);
    const timer = window.setInterval(() => setElapsedMs(Date.now() - started), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!active) {
      setSlow(false);
      return;
    }
    const timer = window.setTimeout(() => setSlow(true), 1000);
    return () => window.clearTimeout(timer);
  }, [active]);
  return { elapsedMs, slow };
}
