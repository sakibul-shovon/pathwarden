import { describe, expect, it } from "vitest";
import type { LineageEdge, LineageNode } from "../../api/types";
import { chooseLayout, LANES, lanesLayout } from "./lanes";

const node = (over: Partial<LineageNode> & { id: string }): LineageNode => ({
  label: "Artifact", kind: "raw", trust: null, sanitized: null, approved: null, quarantined: null, agent_id: null, session_id: null, key: null, created_at: null, ...over,
});
const src = (id: string, trust: string): LineageNode => node({ id, label: "Source", kind: null, trust });
const edge = (a: string, b: string, rel = "DERIVED_FROM"): LineageEdge => ({ src: a, dst: b, rel });

/** The attack: triage reads the issue on Monday, fixer drafts on Monday with the memory and the env value. */
const nodes: LineageNode[] = [
  node({ id: "a-0001", session_id: "s-0001", agent_id: "triage", created_at: 1 }),
  node({ id: "a-0002", kind: "sanitized", session_id: "s-0001", agent_id: "triage", created_at: 2 }),
  node({ id: "a-0003", kind: "memory", session_id: "s-0001", agent_id: "triage", created_at: 3 }),
  node({ id: "a-0004", kind: "memory", session_id: "s-0001", agent_id: "triage", created_at: 3 }),
  node({ id: "a-0008", session_id: "s-0002", agent_id: "fixer", created_at: 5 }),
  node({ id: "a-0010", kind: "draft", session_id: "s-0002", agent_id: "fixer", created_at: 6 }),
  src("src:issue:42", "untrusted"),
  src("src:env:PORT", "internal"),
  src("src:env:DEPLOY_TOKEN", "secret"),
];
const edges: LineageEdge[] = [
  edge("a-0001", "src:issue:42", "ORIGINATES_FROM"),
  edge("a-0008", "src:env:DEPLOY_TOKEN", "ORIGINATES_FROM"),
  edge("a-0002", "a-0001"),
  edge("a-0010", "a-0004"),
];

describe("lanesLayout", () => {
  const layout = lanesLayout(nodes, edges);
  const at = (id: string) => layout.positions.get(id) ?? { x: NaN, y: NaN };

  it("places every node, never dropping one", () => {
    expect(layout.positions.size).toBe(nodes.length);
    for (const n of nodes) expect(layout.bandOf.has(n.id)).toBe(true);
  });

  it("is deterministic: the order of the input does not change a single position", () => {
    const shuffled = lanesLayout([...nodes].reverse(), [...edges].reverse());
    for (const n of nodes) expect(shuffled.positions.get(n.id)).toEqual(layout.positions.get(n.id));
    expect(shuffled.bands).toEqual(layout.bands);
  });

  it("makes one lane per session, earliest first, labelled with the agent and the session, and the sources last", () => {
    expect(layout.bands.filter((b) => b.kind === "session").map((b) => b.label)).toEqual(["triage · s-0001", "fixer · s-0002"]);
    expect(layout.bands.at(-1)?.kind).toBe("sources");
    expect(layout.bands.map((b) => b.left)).toEqual([...layout.bands.map((b) => b.left)].sort((a, b) => a - b));
  });

  it("keeps lanes narrow whatever the number of events: the width depends on sessions, not on time steps", () => {
    const many = Array.from({ length: 40 }, (_, i) => node({ id: `a-${String(i).padStart(4, "0")}`, session_id: "s-1", agent_id: "x", created_at: i }));
    const wide = lanesLayout(many, []);
    expect(wide.width).toBe(LANES.pad * 2 + LANES.lane);
    expect(wide.height).toBeGreaterThan(40 * LANES.row);
  });

  it("puts logical time downward: later is lower, the same time shares a row", () => {
    expect(at("a-0002").y).toBeGreaterThan(at("a-0001").y);
    expect(at("a-0010").y).toBeGreaterThan(at("a-0008").y);
    expect(at("a-0003").y).not.toBe(at("a-0004").y);
    expect(at("a-0001").x).toBe(at("a-0002").x);
    expect(at("a-0008").x).toBeGreaterThan(at("a-0001").x);
  });

  it("makes a row as tall as its tallest stack, so nodes sharing a time never touch the next time", () => {
    // a-0003 and a-0004 share time 3 in one lane: both sit in the row, and the next time starts below both
    const next = layout.positions.get("a-0008")!;
    expect(next.y - at("a-0004").y).toBeGreaterThanOrEqual(LANES.row);
    expect(at("a-0004").y - at("a-0003").y).toBe(LANES.row);
  });

  it("keeps every node inside its lane and the lanes apart", () => {
    for (const n of nodes) {
      const band = layout.bands.find((b) => b.id === layout.bandOf.get(n.id));
      expect(band).toBeDefined();
      expect(at(n.id).x).toBeGreaterThan(band!.left);
      expect(at(n.id).x).toBeLessThan(band!.left + band!.width);
      expect(at(n.id).y).toBeLessThan(layout.height);
    }
    for (let i = 1; i < layout.bands.length; i++) {
      expect(layout.bands[i]!.left).toBeGreaterThanOrEqual(layout.bands[i - 1]!.left + layout.bands[i - 1]!.width);
    }
  });

  it("puts each source in the last lane, level with the first artifact that was read from it", () => {
    expect(at("src:issue:42").y).toBe(at("a-0001").y);
    expect(at("src:env:DEPLOY_TOKEN").y).toBe(at("a-0008").y);
    expect(at("src:issue:42").x).toBe(at("src:env:DEPLOY_TOKEN").x);
  });

  it("never lets two sources overlap: a source with no origin or a tied one is nudged down in steps of 60 px", () => {
    const two = lanesLayout(
      [node({ id: "a-1", session_id: "s-1", agent_id: "x", created_at: 1 }), src("src:a", "untrusted"), src("src:b", "secret"), src("src:c", "internal")],
      [edge("a-1", "src:a", "ORIGINATES_FROM"), edge("a-1", "src:b", "ORIGINATES_FROM")],
    );
    const ys = ["src:a", "src:b", "src:c"].map((id) => two.positions.get(id)!.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(LANES.sourceGap);
      expect((ys[i]! - ys[i - 1]!) % LANES.nudge).toBe(0);
    }
    // a tie is broken by trust: untrusted before secret
    expect(two.positions.get("src:a")!.y).toBeLessThan(two.positions.get("src:b")!.y);
  });

  it("shows artifacts without a session in an Other lane, and one without a time in a last row", () => {
    const odd = lanesLayout(
      [node({ id: "a-1", session_id: "s-1", agent_id: "x", created_at: 1 }), node({ id: "a-2" }), node({ id: "a-3", session_id: "s-1", agent_id: "x" })],
      [],
    );
    expect(odd.positions.size).toBe(3);
    expect(odd.bands.find((b) => b.kind === "other")?.label).toContain("no session");
    expect(odd.positions.get("a-3")!.y).toBeGreaterThan(odd.positions.get("a-1")!.y);
  });

  it("copes with an empty graph and with a graph of sources only", () => {
    expect(lanesLayout([], []).positions.size).toBe(0);
    expect(lanesLayout([], []).width).toBe(0);
    const only = lanesLayout([src("src:a", "secret")], []);
    expect(only.positions.get("src:a")).toBeDefined();
    expect(only.bands.map((b) => b.kind)).toEqual(["sources"]);
  });
});

describe("chooseLayout", () => {
  it("uses lanes up to 150 nodes and the tree above, and says why", () => {
    expect(chooseLayout(150)).toEqual({ layout: "lanes", reason: null });
    const big = chooseLayout(151);
    expect(big.layout).toBe("tree");
    expect(big.reason).toContain("151 nodes");
  });
});
