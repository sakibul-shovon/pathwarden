import { describe, expect, it } from "vitest";
import type { GraphAt, LineageNode } from "../../../api/types";
import { clampT, frameSummary, isCurrentFrame, markedIds, markerViews, nextReplayT, scrubberText, taintedSummary, writtenAt } from "./timeLogic";

const node = (over: Partial<LineageNode> & { id: string }): LineageNode => ({
  label: "Artifact", kind: "raw", trust: null, sanitized: null, approved: null, quarantined: null, agent_id: null, session_id: null, key: null, created_at: null, ...over,
});
const graph = (over: Partial<GraphAt> = {}): GraphAt => ({
  t: 4, max_t: 18, nodes: [], edges: [], actions: [], doubly_tainted: [],
  markers: { poisoned_memory_written: { t: 4, artifact_id: "a-0003", key: "issue_summary:42" }, draft_doubly_tainted: { t: 16, artifact_id: "a-0013", key: "changelog:44" } },
  ...over,
});

describe("replay", () => {
  it("advances one step at a time and stops at the end instead of wrapping", () => {
    expect(nextReplayT(0, 18)).toBe(1);
    expect(nextReplayT(17, 18)).toBe(18);
    expect(nextReplayT(18, 18)).toBeNull();
    expect(nextReplayT(19, 18)).toBeNull();
    expect(nextReplayT(0, 0)).toBeNull();
  });

  it("keeps the scrubber inside 0 and the last time, whatever it is given", () => {
    expect(clampT(-3, 18)).toBe(0);
    expect(clampT(99, 18)).toBe(18);
    expect(clampT(7.9, 18)).toBe(7);
    expect(clampT(5, 0)).toBe(0);
  });

  it("reads the scrubber as a sentence", () => {
    expect(scrubberText(16, 18)).toBe("t = 16 of 18");
  });
});

describe("markers", () => {
  it("is a button with full words, placed by its time, and says when this run has no such moment", () => {
    const [poisoned, tainted] = markerViews(graph().markers, 4, 18);
    expect(poisoned?.text).toBe("Poisoned memory written · t=4 · issue_summary:42");
    expect(poisoned?.here).toBe(true);
    expect(tainted?.here).toBe(false);
    expect(poisoned?.percent).toBeCloseTo((4 / 18) * 100);
    expect(tainted?.percent).toBeCloseTo((16 / 18) * 100);
    const none = markerViews({ poisoned_memory_written: null, draft_doubly_tainted: null }, 0, 18);
    expect(none.map((m) => m.text)).toEqual(["Poisoned memory written: this run has no such moment", "Draft doubly tainted: this run has no such moment"]);
    expect(none.every((m) => m.marker === null && !m.here)).toBe(true);
  });

  it("copes with no frame yet and with an empty clock", () => {
    expect(markerViews(null, 0, 0).map((m) => m.marker)).toEqual([null, null]);
    expect(markerViews(graph().markers, 0, 0).map((m) => m.percent)).toEqual([0, 0]);
  });

  it("lists the artifacts that carry a marker, from the API's markers only", () => {
    expect(markedIds(graph().markers)).toEqual(["a-0003", "a-0013"]);
    expect(markedIds({ poisoned_memory_written: null, draft_doubly_tainted: null })).toEqual([]);
    expect(markedIds(null)).toEqual([]);
  });
});

describe("a frame", () => {
  it("lists what was written exactly at this moment, which may be nothing", () => {
    const g = graph({ nodes: [node({ id: "a-0003", created_at: 4 }), node({ id: "a-0002", created_at: 2 }), node({ id: "src:x", label: "Source" })] });
    expect(writtenAt(g).map((n) => n.id)).toEqual(["a-0003"]);
    expect(writtenAt(graph({ t: 1, nodes: g.nodes }))).toEqual([]);
  });

  it("is summarised with the right plurals", () => {
    expect(frameSummary(graph({ nodes: [node({ id: "a" })], edges: [], actions: [{ action_id: "act-1", status: "held", payload_id: "a" }] }))).toBe("1 node · 0 edges · 1 proposed action");
    expect(frameSummary(graph({ nodes: [node({ id: "a" }), node({ id: "b" })], edges: [{ src: "a", dst: "b", rel: "DERIVED_FROM" }] }))).toBe("2 nodes · 1 edge · 0 proposed actions");
  });

  it("warns about a doubly tainted draft only when the API returned one", () => {
    expect(taintedSummary(graph())).toBeNull();
    expect(taintedSummary(graph({ doubly_tainted: ["a-0013"] }))).toContain("1 doubly tainted draft");
    expect(taintedSummary(graph({ doubly_tainted: ["a", "b"] }))).toContain("2 doubly tainted drafts");
  });

  it("is current only when it is the frame that was asked for (a stale answer is never drawn as current)", () => {
    expect(isCurrentFrame(graph({ t: 7 }), 7)).toBe(true);
    expect(isCurrentFrame(graph({ t: 7 }), 8)).toBe(false);
    expect(isCurrentFrame(null, 0)).toBe(false);
  });
});
