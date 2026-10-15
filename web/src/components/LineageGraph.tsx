import cytoscape from "cytoscape";
import { useEffect, useRef } from "react";
import { useThemeTick } from "../hooks";
import type { LineageEdge, LineageNode } from "../api/types";

interface Props {
  nodes: LineageNode[];
  edges: LineageEdge[];
  untrustedWitness: string[];
  secretWitness: string[];
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

function nodeLabel(node: LineageNode): string {
  const name = node.label === "Source" ? node.id : node.key || node.kind || node.id;
  return node.label === "Source" ? name : `${name}\n${node.id}`;
}

/** The lineage of a payload: untrusted/secret witness paths highlighted, sanitized nodes dashed,
 *  quarantined nodes greyed, sources as diamonds. Information is never carried by colour alone. */
export function LineageGraph({ nodes, edges, untrustedWitness, secretWitness }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const theme = useThemeTick();

  useEffect(() => {
    if (!container.current) return;
    const c = palette();
    const uNodes = new Set(untrustedWitness);
    const sNodes = new Set(secretWitness);
    const uPairs = pairsOf(untrustedWitness);
    const sPairs = pairsOf(secretWitness);

    const elements: cytoscape.ElementDefinition[] = [
      ...nodes.map((n) => ({
        data: { id: n.id, label: nodeLabel(n) },
        classes: [
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
      layout: { name: "breadthfirst", directed: true, padding: 12, spacingFactor: 1.15 },
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
  }, [nodes, edges, untrustedWitness, secretWitness, theme]);

  return (
    <div>
      <div ref={container} className="graph" role="img" aria-label="Lineage graph of the held payload" />
      <ul className="legend" aria-label="Graph legend">
        <li><span className="swatch sw-u" /> untrusted witness (solid, thick)</li>
        <li><span className="swatch sw-s" /> secret witness (dotted, thick)</li>
        <li><span className="swatch sw-sanitized" /> sanitized artifact (dashed border)</li>
        <li><span className="swatch sw-quarantined" /> quarantined (greyed)</li>
        <li><span className="swatch sw-source" /> source (diamond)</li>
      </ul>
    </div>
  );
}
