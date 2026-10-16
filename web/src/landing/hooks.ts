import { useEffect, useState } from "react";
import { probeHealth, type Probe } from "./landingLogic";

/** One health request on load, never repeated; a failure is silent and leaves the call to action on "Run it locally". */
export function useProbe(): Probe {
  const [probe, setProbe] = useState<Probe>("unknown");
  useEffect(() => {
    let cancelled = false;
    const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
    void probeHealth(base, window.fetch.bind(window)).then((result) => {
      if (!cancelled) setProbe(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return probe;
}

/** Following an in-page link moves focus to that section's heading, so keyboard and screen-reader users land where they went. */
export function useAnchorFocus(): void {
  useEffect(() => {
    const onHash = (): void => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      const heading = document.getElementById(id)?.querySelector<HTMLElement>("h1, h2");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
}
