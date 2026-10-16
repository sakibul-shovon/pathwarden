import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** Motion helpers (ui-redesign.md §17). Motion explains causality, state change or spatial origin and nothing else; the final state is
 *  always complete without it, and under `prefers-reduced-motion` a trace jumps to that final state. */

const QUERY = "(prefers-reduced-motion: reduce)";

export const prefersReducedMotion = (): boolean => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches;

/** True while the person asks for reduced motion (updates when the setting changes). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const media = window.matchMedia(QUERY);
    const onChange = (): void => setReduced(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** `120ms`, `0.12s`, `0ms`, ` 180ms ` to milliseconds; anything else is `fallback`. */
export function parseDuration(value: string, fallback = 0): number {
  const m = /^\s*(-?\d*\.?\d+)\s*(ms|s)\s*$/.exec(value);
  if (!m) return fallback;
  const n = Number(m[1]);
  return m[2] === "s" ? n * 1000 : n;
}

/** The value of a motion token (`--dur-1`, `--dur-trace-step`) in milliseconds, read where it is used so the reduced-motion override applies. */
export function tokenMs(name: string, fallback = 0): number {
  if (typeof document === "undefined") return fallback;
  return parseDuration(getComputedStyle(document.documentElement).getPropertyValue(name), fallback);
}

/** The witness trace: reveal `frames` one after another, `stepMs` apart, the first frame already shown. Shared by the HTML rails and
 *  the canvas, so their timing is identical. Returns a function that cancels what has not happened yet. With no step time (reduced
 *  motion) every frame is shown at once. */
export function runTrace<T>(frames: T[][], stepMs: number, onFrame: (frame: T[], index: number) => void, onDone?: () => void): () => void {
  if (frames.length === 0 || !(stepMs > 0)) {
    frames.forEach((f, i) => onFrame(f, i));
    onDone?.();
    return () => undefined;
  }
  const timers: number[] = [];
  frames.forEach((frame, i) => {
    timers.push(
      window.setTimeout(() => {
        onFrame(frame, i);
        if (i === frames.length - 1) onDone?.();
      }, i * stepMs),
    );
  });
  return () => timers.forEach((t) => window.clearTimeout(t));
}

/** How many steps of each rail are shown: all of them when there is no trace, otherwise growing by one per frame. */
export const revealedSteps = (frame: number | null, total: number): number => (frame === null ? total : Math.min(total, frame + 1));

const canAnimateTrace = (): boolean => !prefersReducedMotion() && tokenMs("--dur-trace-step") > 0;

/** Drives the HTML witness trace: `null` shows everything (no key, a trace already played for this key, or reduced motion); otherwise the
 *  index of the last revealed frame, advancing every `--dur-trace-step`. Plays once for each new `key`; while `ready` is false it waits on
 *  the first frame (the payload), so the rest does not flash before the trace starts. */
export function useTraceFrame(key: string | null, frameCount: number, ready = true): number | null {
  const played = useRef<string | null>(null);
  const [frame, setFrame] = useState<number | null>(() => (key !== null && frameCount > 0 && canAnimateTrace() ? 0 : null));
  useEffect(() => {
    if (key === null || frameCount === 0 || played.current === key || !canAnimateTrace()) {
      if (key !== null) played.current = key;
      setFrame(null);
      return;
    }
    setFrame(0);
    if (!ready) return;
    const step = tokenMs("--dur-trace-step");
    const frames = Array.from({ length: frameCount }, (_, i) => [i]);
    return runTrace(
      frames,
      step,
      (f) => setFrame(f[0] ?? null),
      () => {
        played.current = key;
        setFrame(null);
      },
    );
  }, [key, frameCount, ready]);
  return frame;
}

/** True once the element has been at least `ratio` visible; never goes back. Uses an IntersectionObserver, not a scroll listener. */
export function useOnceVisible<T extends Element>(ratio = 0.5): [React.RefObject<T>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (seen || !el) return;
    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: ratio },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen, ratio]);
  return [ref, seen];
}

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/** A view switch as a crossfade (the View Transitions API, §17.4): only where the browser has it and motion is not reduced; anywhere else the
 *  update simply happens. The update runs synchronously inside the transition so the new view is in the DOM when the browser takes its snapshot. */
export function withViewTransition(update: () => void): void {
  const doc: ViewTransitionDocument | undefined = typeof document === "undefined" ? undefined : document;
  if (!doc || typeof doc.startViewTransition !== "function" || prefersReducedMotion()) {
    update();
    return;
  }
  doc.startViewTransition(() => {
    flushSync(update);
  });
}
