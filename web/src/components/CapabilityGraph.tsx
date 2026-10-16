import cytoscape from "cytoscape";
import { useEffect, useRef } from "react";
import { reducedMotion } from "../gsap";
import { Icon } from "../ui/Icon";
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
    fg: read("--ink", "#0e1116"),
    card: read("--surface", "#ffffff"),
    edge: read("--graph-edge", "#6b7482"),
    untrusted: read("--untrusted-line", "#c2620a"),
    secret: read("--secret", "#b0175e"),
    red: read("--hold", "#b42318"),
    accent: read("--ink", "#0e1116"),
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
  const cyRef = useRef<cytoscape.Core | null>(null);
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
            "text-max-width": "124px",
            "font-size": 12,
            "font-family": "Atkinson Hyperlegible Next, system-ui, sans-serif",
            color: c.fg,
            "text-valign": "center",
            "text-halign": "center",
            shape: "round-rectangle",
            width: 134,
            height: 40,
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
            "font-size": 11,
            "font-family": "Atkinson Hyperlegible Next, system-ui, sans-serif",
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
    cyRef.current = cy;
    return () => {
      cyRef.current = null;
      cy.destroy();
    };
  }, [nodes, edges, selected, cut, theme]);

  const zoom = (factor: number): void => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: { level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: reducedMotion() ? 0 : 240 });
  };
  const toxic = nodes.filter((n) => n.toxic).length;

  return (
    <div className="graph-wrap">
      <div className="graph-toolbar" role="toolbar" aria-label="Graph controls">
        <span className="graph-zoom">
          <button type="button" className="icon-btn" onClick={() => zoom(1.25)} aria-label="Zoom in"><Icon name="plus" /></button>
          <button type="button" className="icon-btn" onClick={() => zoom(0.8)} aria-label="Zoom out"><Icon name="minus" /></button>
          <button type="button" className="icon-btn" onClick={() => cyRef.current?.animate({ fit: { eles: cyRef.current.elements(), padding: 16 } }, { duration: reducedMotion() ? 0 : 360 })} aria-label="Fit graph to view"><Icon name="fit" /></button>
        </span>
      </div>
      <div ref={container} className="graph cap-graph" role="img" aria-label={`Capability graph: ${nodes.filter((n) => n.kind === "agent").length} agents, ${toxic} toxic. The agents are also listed as buttons above the graph.`} />
      <ul className="legend" aria-label="Capability graph legend">
        <li><span className="swatch sw-source" /> source: U untrusted, S secret, I internal</li>
        <li>⚠ toxic agent (double red border): reads untrusted and secret data and can reach outside</li>
        <li>agents are rounded boxes (click one for its witness); stores are tagged [store]; sinks are tag-shaped</li>
        <li>edge label = cost; dashed and faded = revoked; thick red = previewed cut</li>
      </ul>
    </div>
  );
}
