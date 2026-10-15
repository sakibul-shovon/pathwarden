import cytoscape from "cytoscape";
import { useEffect, useRef } from "react";
import { useThemeTick } from "../hooks";
import type { CapEdge, CapNode } from "../api/types";

interface Props {
  nodes: CapNode[];
  edges: CapEdge[];
  selected: string | null;
  /** cap ids of the candidate being previewed (drawn as a thick cut) */
  cut: string[];
  onSelect: (agent: string) => void;
}

const TRUST_TAG: Record<string, string> = { untrusted: "U", secret: "S", internal: "I" };

function palette(): Record<string, string> {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  return {
    fg: read("--fg", "#1d2330"),
    card: read("--card", "#ffffff"),
    edge: read("--edge", "#8b93a5"),
    untrusted: read("--untrusted", "#d9730d"),
    secret: read("--secret", "#c2185b"),
    red: read("--red", "#b3261e"),
    accent: read("--accent", "#2456d3"),
  };
}

function label(n: CapNode): string {
  const tag = n.kind === "source" ? ` [${TRUST_TAG[n.trust ?? ""] ?? "?"}]` : n.kind === "sink" ? (n.external ? " [external]" : " [internal]") : n.kind === "store" ? " [store]" : "";
  return `${n.toxic ? "⚠ " : ""}${n.name}${tag}`;
}

/** The capability graph: sources are diamonds (U untrusted, S secret, I internal), stores barrels,
 *  sinks tags, agents rounded boxes; a toxic agent gets a warning sign and a double red border,
 *  a revoked flow is dashed and faded, the previewed cut is thick. Colour is never the only cue. */
export function CapabilityGraph({ nodes, edges, selected, cut, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const theme = useThemeTick();

  useEffect(() => {
    if (!container.current) return;
    const c = palette();
    const cutSet = new Set(cut);
    const cy = cytoscape({
      container: container.current,
      elements: [
        ...nodes.map((n) => ({
          data: { id: n.name, label: label(n) },
          classes: [n.kind, n.toxic ? "toxic" : "", n.external ? "external" : "", n.name === selected ? "selected" : ""]
            .filter(Boolean)
            .join(" "),
        })),
        ...edges.map((e) => ({
          data: { id: e.cap_id, source: e.src, target: e.dst, text: e.revoked ? `${e.cost} revoked` : cutSet.has(e.cap_id) ? `${e.cost} cut` : String(e.cost) },
          classes: [e.revoked ? "revoked" : "", cutSet.has(e.cap_id) ? "cut" : ""].filter(Boolean).join(" "),
        })),
      ],
      layout: { name: "breadthfirst", directed: true, padding: 12, spacingFactor: 1.05 },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-wrap": "wrap",
            "text-max-width": "110px",
            "font-size": 9,
            color: c.fg,
            "text-valign": "center",
            "text-halign": "center",
            shape: "round-rectangle",
            width: 116,
            height: 34,
            "background-color": c.card,
            "border-width": 2,
            "border-color": c.edge,
          },
        },
        { selector: "node.source", style: { shape: "diamond", width: 130, height: 60 } },
        { selector: "node.source.untrusted", style: { "border-color": c.untrusted } },
        { selector: "node.store", style: { shape: "barrel" } },
        { selector: "node.sink", style: { shape: "tag" } },
        { selector: "node.sink.external", style: { "border-width": 4 } },
        { selector: "node.toxic", style: { "border-color": c.red, "border-width": 6, "border-style": "double" } },
        { selector: "node.selected", style: { "underlay-color": c.accent, "underlay-opacity": 0.35, "underlay-padding": 8 } },
        {
          selector: "edge",
          style: {
            width: 1.4,
            "line-color": c.edge,
            "target-arrow-color": c.edge,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(text)",
            "font-size": 8,
            color: c.fg,
            "text-background-color": c.card,
            "text-background-opacity": 0.8,
          },
        },
        { selector: "edge.revoked", style: { "line-style": "dashed", opacity: 0.35 } },
        { selector: "edge.cut", style: { width: 4, "line-color": c.red, "target-arrow-color": c.red } },
      ],
    });
    cy.on("tap", "node.agent", (event) => select.current(event.target.id() as string));
    return () => cy.destroy();
  }, [nodes, edges, selected, cut, theme]);

  return (
    <div>
      <div ref={container} className="graph cap-graph" role="img" aria-label="Capability graph" />
      <ul className="legend" aria-label="Capability graph legend">
        <li><span className="swatch sw-source" /> source: U untrusted, S secret, I internal</li>
        <li>⚠ toxic agent (double red border): reads untrusted and secret data and can reach outside</li>
        <li>agents are rounded boxes (click one for its witness); stores are tagged [store]; sinks are tag-shaped</li>
        <li>edge label = cost; dashed and faded = revoked; thick red = previewed cut</li>
      </ul>
    </div>
  );
}
