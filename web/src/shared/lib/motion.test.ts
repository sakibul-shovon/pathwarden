import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseDuration, revealedSteps, runTrace, withViewTransition } from "./motion";

describe("parseDuration", () => {
  it.each([
    ["120ms", 120],
    ["0ms", 0],
    [" 180ms ", 180],
    ["0.12s", 120],
    ["1s", 1000],
    [".26s", 260],
  ])("reads %j as %j ms", (text, ms) => {
    expect(parseDuration(text)).toBeCloseTo(ms);
  });

  it("gives the fallback for anything that is not a duration, never NaN", () => {
    for (const bad of ["", "fast", "12", "ms", "12px", "calc(1s)"]) expect(parseDuration(bad, 7)).toBe(7);
    expect(parseDuration("")).toBe(0);
  });
});

describe("revealedSteps", () => {
  it("shows every step when there is no trace, and one more per frame while it runs, never more than exist", () => {
    expect(revealedSteps(null, 4)).toBe(4);
    expect(revealedSteps(0, 4)).toBe(1);
    expect(revealedSteps(2, 4)).toBe(3);
    expect(revealedSteps(9, 4)).toBe(4);
  });
});

describe("runTrace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reveals the frames in order, one step apart, and says when it is done", () => {
    const seen: number[] = [];
    let done = 0;
    runTrace([["a"], ["b"], ["c"]], 110, (_f, i) => seen.push(i), () => done++);
    vi.advanceTimersByTime(0);
    expect(seen).toEqual([0]);
    vi.advanceTimersByTime(110);
    expect(seen).toEqual([0, 1]);
    expect(done).toBe(0);
    vi.advanceTimersByTime(110);
    expect(seen).toEqual([0, 1, 2]);
    expect(done).toBe(1);
    vi.advanceTimersByTime(5000);
    expect(done).toBe(1);
  });

  it("hands each frame its own elements, so both rails can move together", () => {
    const frames: string[][] = [];
    runTrace([["u0", "s0"], ["u1", "s1"], ["u2"]], 50, (f) => frames.push(f));
    vi.advanceTimersByTime(200);
    expect(frames).toEqual([["u0", "s0"], ["u1", "s1"], ["u2"]]);
  });

  it("can be cancelled, and then nothing more happens", () => {
    const seen: number[] = [];
    let done = 0;
    const cancel = runTrace([[1], [2], [3]], 100, (_f, i) => seen.push(i), () => done++);
    vi.advanceTimersByTime(100);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(seen).toEqual([0, 1]);
    expect(done).toBe(0);
  });

  it("shows everything at once when there is no step time (reduced motion), without waiting", () => {
    const seen: number[] = [];
    let done = 0;
    runTrace([[1], [2], [3]], 0, (_f, i) => seen.push(i), () => done++);
    expect(seen).toEqual([0, 1, 2]);
    expect(done).toBe(1);
  });

  it("does nothing and finishes at once for an empty trace", () => {
    let done = 0;
    runTrace([], 100, () => undefined, () => done++);
    expect(done).toBe(1);
  });
});

describe("withViewTransition", () => {
  afterEach(() => vi.unstubAllGlobals());
  const env = (reduced: boolean, supported: boolean) => {
    const started: (() => void)[] = [];
    vi.stubGlobal("window", { matchMedia: () => ({ matches: reduced }) });
    vi.stubGlobal("document", supported ? { startViewTransition: (cb: () => void) => started.push(cb) } : {});
    return started;
  };

  it("runs the update inside a view transition where the browser has one and motion is not reduced", () => {
    const started = env(false, true);
    let ran = 0;
    withViewTransition(() => ran++);
    expect(started).toHaveLength(1);
    expect(ran).toBe(0);
    started[0]?.();
    expect(ran).toBe(1);
  });

  it("just runs the update under reduced motion", () => {
    const started = env(true, true);
    let ran = 0;
    withViewTransition(() => ran++);
    expect(ran).toBe(1);
    expect(started).toHaveLength(0);
  });

  it("just runs the update in a browser without view transitions", () => {
    const started = env(false, false);
    let ran = 0;
    withViewTransition(() => ran++);
    expect(ran).toBe(1);
    expect(started).toHaveLength(0);
  });
});
