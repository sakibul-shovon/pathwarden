import { describe, expect, it } from "vitest";
import type { LineageEdge, LineageNode } from "../../api/types";
import { canvasLabel, edgeRows, filterRows, focusSet, graphCaption, graphCounts, incidentEdges, neighbourhood, nodeRows, relationMeaning, sortRows, traceFrames, witnessNodes, witnessPairs } from "./graphModel";

const node = (over: Partial<LineageNode> & { id: string }): LineageNode => ({
  label: "Artifact", kind: "raw", trust: null, sanitized: null, approved: null, quarantined: null, agent_id: null, session_id: null, key: null, created_at: null, ...over,
});
const edge = (src: string, dst: string, rel = "DERIVED_FROM"): LineageEdge => ({ src, dst, rel });

// draft -> memory -> raw -> source(untrusted); draft -> env raw -> source(secret); sanitized task -> raw
const edges: LineageEdge[] = [
  edge("a-0010", "a-0004"),
  edge("a-0004", "a-0001"),
  edge("a-0001", "src:issue:42", "ORIGINATES_FROM"),
  edge("a-0010", "a-0008"),
  edge("a-0008", "src:env:T", "ORIGINATES_FROM"),
  edge("a-0002", "a-0001"),
  edge("a-0010", "a-0002"),
];
const untrusted = ["a-0010", "a-0004", "a-0001", "src:issue:42"];
const secret = ["a-0010", "a-0008", "src:env:T"];

describe("glossary and incident edges", () => {
  it("explains the two relationship types and admits an unknown one", () => {
    expect(relationMeaning("DERIVED_FROM")).toContain("in the agent's context");
    expect(relationMeaning("ORIGINATES_FROM")).toContain("read from this source");
    expect(relationMeaning("MYSTERY")).toContain("no description");
  });

  it("separates what a node was made from (outgoing) from what was made from it (incoming)", () => {
    const i = incidentEdges("a-0001", edges);
    expect(i.outgoing.map((e) => e.dst)).toEqual(["src:issue:42"]);
    expect(i.incoming.map((e) => e.src).sort()).toEqual(["a-0002", "a-0004"]);
  });
});

describe("neighbourhood (hover and focus keep these at full strength)", () => {
  it("keeps the node, its edges and the nodes at their ends, and nothing else", () => {
    const n = neighbourhood("a-0001", edges);
    expect([...n.nodes].sort()).toEqual(["a-0001", "a-0002", "a-0004", "src:issue:42"]);
    expect([...n.edges].sort()).toEqual([1, 2, 5]);
  });

  it("is just the node for one that has no edges", () => {
    const n = neighbourhood("lonely", edges);
    expect([...n.nodes]).toEqual(["lonely"]);
    expect(n.edges.size).toBe(0);
  });
});

describe("focusSet (ancestors and descendants within the returned edges)", () => {
  it("follows both directions transitively", () => {
    expect([...focusSet("a-0004", edges)].sort()).toEqual(["a-0001", "a-0004", "a-0010", "src:issue:42"]);
  });

  it("does not leak into a sibling branch", () => {
    expect(focusSet("a-0008", edges).has("a-0004")).toBe(false);
  });

  it("terminates on a cycle", () => {
    expect(focusSet("a", [edge("a", "b"), edge("b", "a")]).size).toBe(2);
  });
});

describe("witness helpers", () => {
  it("lists the consecutive pairs of a path and the nodes of both paths", () => {
    expect([...witnessPairs(["x", "y", "z"])]).toEqual(["x>y", "y>z"]);
    expect(witnessPairs(["x"]).size).toBe(0);
    expect(witnessNodes(untrusted, secret).size).toBe(6);
  });

  it("reveals both paths in lockstep from the payload towards the source", () => {
    const frames = traceFrames(untrusted, secret);
    expect(frames).toHaveLength(3);
    expect(frames[0]).toEqual([
      { kind: "untrusted", from: "a-0010", to: "a-0004" },
      { kind: "secret", from: "a-0010", to: "a-0008" },
    ]);
    expect(frames[2]).toEqual([{ kind: "untrusted", from: "a-0001", to: "src:issue:42" }]);
  });

  it("has no frames without a path", () => {
    expect(traceFrames([], [])).toEqual([]);
    expect(traceFrames(["only"], [])).toEqual([]);
  });
});

describe("words", () => {
  const nodes = [node({ id: "a-0010" }), node({ id: "a-0001" }), node({ id: "src:issue:42", label: "Source", trust: "untrusted" })];

  it("counts artifacts, sources and edges", () => {
    expect(graphCounts(nodes, edges)).toEqual({ artifacts: 2, sources: 1, edges: 7 });
  });

  it("writes the caption from the same numbers and says 1 step in the singular", () => {
    expect(graphCaption("act-0001", nodes, edges, untrusted, ["a", "b"])).toBe(
      "Lineage of act-0001: 2 artifacts, 1 source, 7 edges. Untrusted path 3 steps, secret path 1 step.",
    );
  });

  it("labels a source with its trust and an artifact with its key, id and facts", () => {
    expect(canvasLabel(node({ id: "src:issue:42", label: "Source", trust: "untrusted" }))).toBe("◆ src:issue:42\nuntrusted");
    expect(canvasLabel(node({ id: "a-0004", kind: "memory", key: "team_convention:42" }))).toBe("team_convention:42\na-0004 · memory");
    expect(canvasLabel(node({ id: "a-0002", kind: "sanitized", sanitized: true, approved: true }))).toBe("sanitized\na-0002\napproved");
    expect(canvasLabel(node({ id: "a-0003", kind: "raw", sanitized: true }))).toBe("raw\na-0003\nsanitized");
  });

  it("prefixes the payload, a quarantined node and a doubly tainted one in words, not only styling", () => {
    expect(canvasLabel(node({ id: "a-0010", kind: "draft", key: "changelog:42" }), { payload: true })).toBe("payload changelog:42\na-0010 · draft");
    expect(canvasLabel(node({ id: "a-0001", quarantined: true })).split("\n")[0]).toBe("Q raw");
    expect(canvasLabel(node({ id: "a-0010", kind: "draft" }), { tainted: true }).split("\n")[0]).toBe("⚠ 2× tainted draft");
  });
});

describe("table rows", () => {
  const nodes = [
    node({ id: "a-0010", kind: "draft", key: "changelog:42", agent_id: "fixer", session_id: "s-0002", created_at: 6 }),
    node({ id: "a-0002", kind: "sanitized", sanitized: true, agent_id: "triage", session_id: "s-0001", created_at: 2 }),
    node({ id: "src:issue:42", label: "Source", kind: null, trust: "untrusted" }),
  ];

  it("marks which witness a node and an edge are on, and both when it is on both", () => {
    const rows = nodeRows(nodes, untrusted, ["a-0010", "a-0002"]);
    expect(rows.map((r) => r.witness)).toEqual(["both", "secret", "untrusted"]);
    const e = edgeRows([edge("a-0010", "a-0004"), edge("a-0010", "a-0008"), edge("a-0002", "a-0001")], untrusted, secret);
    expect(e.map((r) => r.witness)).toEqual(["untrusted", "secret", ""]);
  });

  it("sorts ids naturally and keeps an empty cell last whichever way it sorts", () => {
    const rows = nodeRows([node({ id: "a-0010" }), node({ id: "a-0002" }), node({ id: "a-0001" })], [], []);
    expect(sortRows(rows, "id", "asc").map((r) => r.id)).toEqual(["a-0001", "a-0002", "a-0010"]);
    expect(sortRows(rows, "id", "desc").map((r) => r.id)).toEqual(["a-0010", "a-0002", "a-0001"]);
    const timed = nodeRows(nodes, [], []);
    expect(sortRows(timed, "t", "asc").map((r) => r.id)).toEqual(["a-0002", "a-0010", "src:issue:42"]);
    expect(sortRows(timed, "t", "desc").map((r) => r.id)).toEqual(["a-0010", "a-0002", "src:issue:42"]);
  });

  it("keeps the order of equal rows (a stable sort) and does not change its input", () => {
    const rows = nodeRows([node({ id: "b", agent_id: "x" }), node({ id: "a", agent_id: "x" })], [], []);
    const before = rows.map((r) => r.id);
    expect(sortRows(rows, "agent", "asc").map((r) => r.id)).toEqual(["b", "a"]);
    expect(rows.map((r) => r.id)).toEqual(before);
  });

  it("filters on any cell, ignoring case, and returns everything for an empty filter", () => {
    const rows = nodeRows(nodes, untrusted, secret);
    expect(filterRows(rows, "FIXER").map((r) => r.id)).toEqual(["a-0010"]);
    expect(filterRows(rows, "  ")).toHaveLength(3);
    expect(filterRows(rows, "zzz")).toHaveLength(0);
  });
});
