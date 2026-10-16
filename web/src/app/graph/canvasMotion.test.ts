import { describe, expect, it } from "vitest";
import type cytoscape from "cytoscape";
import { fadeIn, fitView, MOVE_EASING, newIds, ZOOM_MS, zoomTo } from "./canvasMotion";

const fakeCy = () => {
  const calls: { fn: string; arg: unknown }[] = [];
  const cy = {
    zoom: (arg: unknown) => calls.push({ fn: "zoom", arg }),
    fit: (...arg: unknown[]) => calls.push({ fn: "fit", arg }),
    animate: (arg: unknown) => calls.push({ fn: "animate", arg }),
    elements: () => "ALL",
  };
  return { cy: cy as unknown as cytoscape.Core, calls };
};

describe("zoom and fit glide over 200 ms with the movement curve, and jump under reduced motion", () => {
  it("animates zoom to the level around the given point", () => {
    const { cy, calls } = fakeCy();
    zoomTo(cy, 1.5, { x: 10, y: 20 }, false);
    expect(calls).toEqual([{ fn: "animate", arg: { zoom: { level: 1.5, renderedPosition: { x: 10, y: 20 } }, duration: ZOOM_MS, easing: MOVE_EASING } }]);
    expect(ZOOM_MS).toBe(200);
    expect(MOVE_EASING).toBe("ease-in-out");
  });

  it("sets the zoom at once when motion is reduced", () => {
    const { cy, calls } = fakeCy();
    zoomTo(cy, 0.8, { x: 1, y: 2 }, true);
    expect(calls).toEqual([{ fn: "zoom", arg: { level: 0.8, renderedPosition: { x: 1, y: 2 } } }]);
  });

  it("animates the fit of every element with its padding, or fits at once when reduced", () => {
    const a = fakeCy();
    fitView(a.cy, 24, false);
    expect(a.calls).toEqual([{ fn: "animate", arg: { fit: { eles: "ALL", padding: 24 }, duration: ZOOM_MS, easing: MOVE_EASING } }]);
    const b = fakeCy();
    fitView(b.cy, 24, true);
    expect(b.calls).toEqual([{ fn: "fit", arg: [undefined, 24] }]);
  });
});

describe("fadeIn", () => {
  const eles = (empty = false) => {
    const log: string[] = [];
    let done: (() => void) | undefined;
    const c = {
      empty: () => empty,
      style: (k: string, v: unknown) => log.push(`style ${k}=${String(v)}`),
      animate: (spec: unknown, opts: { duration: number; complete: () => void }) => {
        log.push(`animate ${JSON.stringify(spec)} ${opts.duration}`);
        done = opts.complete;
      },
      removeStyle: (k: string) => log.push(`removeStyle ${k}`),
    };
    return { c: c as unknown as cytoscape.Collection, log, finish: () => done?.() };
  };

  it("starts transparent, fades to opaque, and gives opacity back to the classes afterwards", () => {
    const e = eles();
    fadeIn(e.c, 120, false);
    expect(e.log).toEqual(['style opacity=0', 'animate {"style":{"opacity":1}} 120']);
    e.finish();
    expect(e.log.at(-1)).toBe("removeStyle opacity");
  });

  it("does nothing when motion is reduced, when there is no time, or when nothing is new", () => {
    for (const [empty, ms, reduced] of [[false, 120, true], [false, 0, false], [true, 120, false]] as const) {
      const e = eles(empty);
      fadeIn(e.c, ms, reduced);
      expect(e.log).toEqual([]);
    }
  });
});

describe("newIds", () => {
  it("is what a step adds, in the order given, and nothing for a first frame", () => {
    expect(newIds(new Set(["a", "b"]), ["a", "b", "c", "d"])).toEqual(["c", "d"]);
    expect(newIds(new Set(["a"]), ["a"])).toEqual([]);
    expect(newIds(null, ["a", "b"])).toEqual([]);
    expect(newIds(new Set(["a", "b"]), [])).toEqual([]);
  });
});
