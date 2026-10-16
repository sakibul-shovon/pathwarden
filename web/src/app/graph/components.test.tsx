import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LineageEdge, LineageNode } from "../../api/types";
import { CAPABILITY_LEGEND, GraphLegend, LINEAGE_LEGEND } from "./GraphLegend";
import { GraphTable } from "./GraphTable";
import { NodeDrawer } from "./NodeDrawer";

const noop = (): void => undefined;
const text = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const node = (over: Partial<LineageNode> & { id: string }): LineageNode => ({
  label: "Artifact", kind: "raw", trust: null, sanitized: null, approved: null, quarantined: null, agent_id: null, session_id: null, key: null, created_at: null, ...over,
});
const edge = (src: string, dst: string, rel = "DERIVED_FROM"): LineageEdge => ({ src, dst, rel });

const nodes: LineageNode[] = [
  node({ id: "a-0010", kind: "draft", key: "changelog:42", agent_id: "fixer", session_id: "s-0002", created_at: 12 }),
  node({ id: "a-0004", kind: "memory", key: "team_convention:42", agent_id: "triage", session_id: "s-0001", created_at: 3, quarantined: true }),
  node({ id: "a-0001", agent_id: "triage", session_id: "s-0001", created_at: 1 }),
  node({ id: "src:issue:42", label: "Source", kind: null, trust: "untrusted" }),
];
const edges: LineageEdge[] = [edge("a-0010", "a-0004"), edge("a-0004", "a-0001"), edge("a-0001", "src:issue:42", "ORIGINATES_FROM")];
const untrusted = ["a-0010", "a-0004", "a-0001", "src:issue:42"];

describe("GraphTable", () => {
  const html = renderToStaticMarkup(<GraphTable nodes={nodes} edges={edges} untrustedWitness={untrusted} secretWitness={[]} onOpen={noop} />);

  it("is the same data as the canvas, as two named tables", () => {
    expect(html).toContain("Nodes of the graph");
    expect(html).toContain("Edges of the graph");
    expect(text(html)).toContain("4 of 4 nodes · 3 of 3 edges");
    expect(html.match(/<tbody>/g)).toHaveLength(2);
    expect(html.match(/<tr>/g)).toHaveLength(2 + 4 + 3);
  });

  it("says which rows are on a witness path in words, not by colour", () => {
    expect(text(html)).toContain("untrusted");
    expect(html).toContain("<strong>untrusted</strong>");
  });

  it("makes every header a sort button with an aria-sort state, and labels the filter", () => {
    expect(html.match(/aria-sort="none"/g)?.length).toBeGreaterThanOrEqual(13);
    expect(html).toContain('class="pw-gtable__sort"');
    expect(html).toContain(">Filter rows<");
    expect(html).toContain('type="search"');
  });

  it("opens the drawer from an id, and from both ends of an edge", () => {
    expect(html.match(/pw-gtable__open/g)?.length).toBe(4 + 3 * 2);
  });
});

describe("NodeDrawer", () => {
  const draw = (id: string | null, over: Partial<Parameters<typeof NodeDrawer>[0]> = {}): string =>
    renderToStaticMarkup(
      <NodeDrawer
        node={id === null ? null : (nodes.find((n) => n.id === id) ?? null)}
        nodes={nodes}
        edges={edges}
        untrustedWitness={untrusted}
        secretWitness={[]}
        loadContent={() => Promise.reject(new Error("must not be called while rendering"))}
        onClose={noop}
        onOpenNode={noop}
        {...over}
      />,
    );

  it("stays closed and empty without a node", () => {
    expect(draw(null)).not.toContain("pw-drawer");
  });

  it("names the node by its key, with its id, kind, writer and time", () => {
    const t = text(draw("a-0004"));
    expect(t).toContain("team_convention:42");
    expect(t).toContain("a-0004");
    expect(t).toContain("artifact · memory");
    expect(t).toContain("triage · s-0001 · t=3");
  });

  it("states the flags and the witness path in words", () => {
    const t = text(draw("a-0004"));
    expect(t).toContain("quarantined");
    expect(t).toContain("on the untrusted path");
    expect(t).not.toContain("on the secret path");
  });

  it("lists what it was made from and what was made from it, with the meaning of each relationship", () => {
    const t = text(draw("a-0004"));
    expect(t).toContain("Made from");
    expect(t).toContain("Used to make");
    expect(t).toContain("DERIVED_FROM");
    expect(t).toContain("in the agent's context");
    expect(t).toContain("Edges point from the newer artifact");
  });

  it("offers Show content for an artifact but not for a source, and does not fetch it while rendering", () => {
    expect(draw("a-0001")).toContain("Show content");
    expect(draw("src:issue:42")).not.toContain("Show content");
    expect(text(draw("src:issue:42"))).toContain("source");
    expect(text(draw("src:issue:42"))).toContain("untrusted");
  });

  it("says where the lineage ends instead of showing an empty list", () => {
    expect(text(draw("src:issue:42"))).toContain("Nothing: this is where the lineage ends.");
  });
});

describe("GraphLegend", () => {
  it("pairs every glyph with words, for both graphs", () => {
    for (const items of [LINEAGE_LEGEND, CAPABILITY_LEGEND]) {
      const html = renderToStaticMarkup(<GraphLegend items={items} label="Legend" />);
      expect(html.match(/<li>/g)).toHaveLength(items.length);
      for (const i of items) expect(i.text.split(" ").length).toBeGreaterThanOrEqual(2);
      expect(html).toContain('aria-hidden="true"');
    }
  });

  it("explains witness paths by line style and quarantine by hatching", () => {
    const t = LINEAGE_LEGEND.map((i) => i.text).join(" | ");
    expect(t).toContain("solid");
    expect(t).toContain("dotted");
    expect(t).toContain("hatched");
  });
});

describe("graph.css", () => {
  const css = readFileSync(new URL("./graph.css", import.meta.url), "utf8");

  it("draws a glyph for every legend entry", () => {
    for (const i of [...LINEAGE_LEGEND, ...CAPABILITY_LEGEND]) expect(css).toContain(`.pw-key--${i.glyph}`);
  });

  it("gives lanes more height than the tree and stays within the viewport on a phone", () => {
    expect(css).toMatch(/\.pw-canvas\[data-layout="lanes"\]\s*\{[^}]*height: clamp\(/);
    expect(css).toMatch(/@media \(max-width: 767px\)[^{]*\{[^}]*\.pw-canvas[^}]*height: 420px/);
  });

  it("lets the page scroll over the canvas on touch screens", () => {
    expect(css).toContain("touch-action: pan-y");
  });
});
