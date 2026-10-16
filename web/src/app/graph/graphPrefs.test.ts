import { describe, expect, it } from "vitest";
import type { CapEdge, CapNode } from "../../api/types";
import { capEdgeClasses, capEdgeText, capLabel, capNodeClasses, capRoots } from "./capModel";
import { DEFAULT_PREFS, parsePrefs, prefsKey } from "./graphPrefs";

const cap = (over: Partial<CapNode> & { name: string }): CapNode => ({ kind: "agent", trust: null, external: null, toxic: false, ...over });
const flow = (over: Partial<CapEdge> = {}): CapEdge => ({ src: "a", dst: "b", cap_id: "a->b", cost: 3, revoked: false, ...over });

describe("graph preferences", () => {
  it("round-trips a stored choice and falls back to graph and lanes for anything else", () => {
    expect(parsePrefs(JSON.stringify({ view: "table", layout: "tree" }))).toEqual({ view: "table", layout: "tree" });
    expect(parsePrefs(JSON.stringify({ view: "table" }))).toEqual({ view: "table", layout: "lanes" });
    for (const bad of [null, undefined, "", "not json", "42", { view: 3 }]) expect(parsePrefs(bad)).toEqual(DEFAULT_PREFS);
  });

  it("keeps each view's choice under its own key", () => {
    expect(prefsKey("investigate")).not.toBe(prefsKey("time"));
  });
});

describe("capability canvas model", () => {
  it("names a source by its trust and flags a toxic agent in words", () => {
    expect(capLabel(cap({ name: "src:issue", kind: "source", trust: "untrusted" }))).toBe("◆ src:issue\nuntrusted");
    expect(capLabel(cap({ name: "fixer", toxic: true }))).toBe("⚠ toxic fixer\nagent");
    expect(capLabel(cap({ name: "pages", kind: "sink", external: true }))).toBe("pages\nexternal sink");
    expect(capLabel(cap({ name: "memory", kind: "store" }))).toBe("memory\nstore");
  });

  it("classes a node by kind, trust, toxicity and selection", () => {
    expect(capNodeClasses(cap({ name: "s", kind: "source", trust: "secret" }), null)).toBe("source secret");
    expect(capNodeClasses(cap({ name: "fixer", toxic: true }), "fixer")).toBe("agent toxic selected");
  });

  it("words an edge by its cost, revoked or previewed cut", () => {
    const cut = new Set(["a->b"]);
    expect(capEdgeText(flow(), new Set())).toBe("3");
    expect(capEdgeText(flow({ revoked: true }), cut)).toBe("3 revoked");
    expect(capEdgeText(flow(), cut)).toBe("3 cut");
    expect(capEdgeClasses(flow(), cut)).toBe("cut");
    expect(capEdgeClasses(flow({ revoked: true }), new Set())).toBe("revoked");
  });

  it("roots the layout at the sources", () => {
    expect(capRoots([cap({ name: "s1", kind: "source" }), cap({ name: "a" }), cap({ name: "s2", kind: "source" })])).toEqual(["s1", "s2"]);
  });
});
