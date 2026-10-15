import cytoscape from "cytoscape";
import { useEffect, useRef } from "react";
import { useThemeTick } from "../hooks";
import type { LineageEdge, LineageNode } from "../api/types";

interface Props {
  nodes: LineageNode[];
  edges: LineageEdge[];
  untrustedWitness: string[];
  secretWitness: string[];
  /** Time travel: artifacts that are doubly tainted (marked with a warning sign, not only colour). */
  tainted?: string[];
  /** Time travel: the artifact that carries a marker of the moment being shown. */
  marked?: string[];
  /** Time travel: lay out this (final) graph and keep the same positions for every earlier time. */
  layoutFrom?: { nodes: LineageNode[]; edges: LineageEdge[] };
}

function palette(): Record<string, string> {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  return {
    fg: read("--fg", "#1d2330"),
    card: read("--card", "#ffffff"),
    edge: read("--edge", "#8b93a5"),
    untrusted: read("--untrusted", "#d9730d"),
    secret: read("--secret", "#c2185b"),
    quarantine: read("--quarantine", "#9aa0ac"),
  };
}

const pairsOf = (path: string[]): Set<string> =>
  new Set(path.slice(0, -1).map((id, i) => `${id}>${path[i + 1]}`));

function nodeLabel(node: LineageNode, tainted: boolean): string {
  const name = node.label === "Source" ? node.id : node.key || node.kind || node.id;
  const text = node.label === "Source" ? name : `${name}\n${node.id}`;
  return tainted ? `⚠ ${text}` : text;
}

/** Positions from a headless layout of the whole graph, so nodes do not jump while time changes. */
function stablePositions(source: { nodes: LineageNode[]; edges: LineageEdge[] }): Map<string, cytoscape.Position> {
  const cy = cytoscape({
    headless: true,
    elements: [
      ...source.nodes.map((n) => ({ data: { id: n.id } })),
      ...source.edges.map((e, i) => ({ data: { id: `e${i}`, source: e.src, target: e.dst } })),
    ],
  });
  cy.layout({
    name: "breadthfirst",
    directed: true,
    padding: 12,
    spacingFactor: 1.15,
    animate: false,
    boundingBox: { x1: 0, y1: 0, w: 1100, h: 460 },
  }).run();
  const positions = new Map<string, cytoscape.Position>();
  cy.nodes().forEach((n) => {
    positions.set(n.id(), { ...n.position() });
  });
  cy.destroy();
  return positions;
}

/** The lineage of a payload: untrusted/secret witness paths highlighted, sanitized nodes dashed,
 *  quarantined nodes greyed, sources as diamonds. Information is never carried by colour alone. */
export function LineageGraph({ nodes, edges, untrustedWitness, secretWitness, tainted, marked, layoutFrom }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const theme = useThemeTick();

  useEffect(() => {
    if (!container.current) return;
    const c = palette();
    const uNodes = new Set(untrustedWitness);
    const sNodes = new Set(secretWitness);
    const taintedIds = new Set(tainted ?? []);
    const markedIds = new Set(marked ?? []);
    const fixed = layoutFrom ? stablePositions(layoutFrom) : null;
    const uPairs = pairsOf(untrustedWitness);
    const sPairs = pairsOf(secretWitness);

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => ({
        data: { id: n.id, label: nodeLabel(n, taintedIds.has(n.id)) },
        ...(fixed?.get(n.id) ? { position: fixed.get(n.id) } : {}),
        classes: [
          taintedIds.has(n.id) ? "tainted" : "",
          markedIds.has(n.id) ? "marked" : "",
          n.label === "Source" ? "source" : "artifact",
          uNodes.has(n.id) ? "u" : "",
          sNodes.has(n.id) ? "s" : "",
          n.sanitized ? "sanitized" : "",
          n.quarantined ? "quarantined" : "",
        ]
          .filter(Boolean)
          .join(" "),
      })),
      ...edges.map((e, i) => {
        const key = `${e.src}>${e.dst}`;
        const classes = [uPairs.has(key) ? "u" : "", sPairs.has(key) ? "s" : ""].filter(Boolean);
        return {
          data: { id: `e${i}`, source: e.src, target: e.dst, text: classes.includes("u") ? "untrusted" : classes.includes("s") ? "secret" : "" },
          classes: classes.join(" "),
        };
      }),
    ];

    const cy = cytoscape({
      container: container.current,
      elements,
      layout: fixed
        ? { name: "preset", padding: 12 }
        : { name: "breadthfirst", directed: true, padding: 12, spacingFactor: 1.15 },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-wrap": "wrap",
            "text-max-width": "120px",
            "font-size": 10,
            color: c.fg,
            "text-valign": "center",
            "text-halign": "center",
            shape: "round-rectangle",
            width: 130,
            height: 38,
            "background-color": c.card,
            "border-width": 2,
            "border-color": c.edge,
          },
        },
        { selector: "node.source", style: { shape: "diamond", width: 120, height: 64 } },
        { selector: "node.u", style: { "border-color": c.untrusted, "border-width": 5 } },
        { selector: "node.s", style: { "border-color": c.secret, "border-width": 5 } },
        { selector: "node.u.s", style: { "border-style": "double", "border-width": 7 } },
        { selector: "node.tainted", style: { "border-color": c.secret, "border-width": 6, "border-style": "double" } },
        { selector: "node.marked", style: { "underlay-color": c.untrusted, "underlay-opacity": 0.35, "underlay-padding": 8 } },
        { selector: "node.sanitized", style: { "border-style": "dashed" } },
        { selector: "node.quarantined", style: { "background-color": c.quarantine, opacity: 0.6 } },
        {
          selector: "edge",
          style: {
            width: 1.5,
            "line-color": c.edge,
            "target-arrow-color": c.edge,
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            label: "data(text)",
            "font-size": 9,
            color: c.fg,
          },
        },
        { selector: "edge.u", style: { width: 4, "line-color": c.untrusted, "target-arrow-color": c.untrusted } },
        { selector: "edge.s", style: { width: 4, "line-style": "dotted", "line-color": c.secret, "target-arrow-color": c.secret } },
      ],
    });
    return () => cy.destroy();
  }, [nodes, edges, untrustedWitness, secretWitness, tainted, marked, layoutFrom, theme]);

  return (
    <div>
      <div ref={container} className="graph" role="img" aria-label="Lineage graph of the held payload" />
      <ul className="legend" aria-label="Graph legend">
        <li><span className="swatch sw-u" /> untrusted witness (solid, thick)</li>
        <li><span className="swatch sw-s" /> secret witness (dotted, thick)</li>
        <li><span className="swatch sw-sanitized" /> sanitized artifact (dashed border)</li>
        <li><span className="swatch sw-quarantined" /> quarantined (greyed)</li>
        <li><span className="swatch sw-source" /> source (diamond)</li>
        {tainted !== undefined && <li>⚠ doubly tainted draft (untrusted and secret lineage)</li>}
        {marked !== undefined && <li><span className="swatch sw-marked" /> artifact carrying a marker (halo)</li>}
      </ul>
    </div>
  );
}
