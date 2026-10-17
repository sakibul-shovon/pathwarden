import cytoscape from "cytoscape";
import { useEffect, useRef, useState } from "react";
import { gsap, reducedMotion } from "../gsap";
import { useThemeTick } from "../hooks";
import type { LineageEdge, LineageNode } from "../api/types";
import { Icon } from "../ui/Icon";

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
  /** Time travel: nodes written at the moment being shown; they fade in. */
  fresh?: string[];
  /** Text for assistive technology (the same facts are listed as text next to the graph). */
  summary?: string;
  /** Hide the "full screen" button (used inside the full-screen dialog itself). */
  inDialog?: boolean;
}

function palette(): Record<string, string> {
  const css = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
  return {
    fg: read("--ink", "#0e1116"),
    card: read("--surface", "#ffffff"),
    edge: read("--graph-edge", "#6b7482"),
    untrusted: read("--untrusted-line", "#c2620a"),
    secret: read("--secret", "#b0175e"),
    quarantine: read("--quarantine", "#5b6472"),
    inset: read("--surface-2", "#ecEEF1"),
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

type Trace = "untrusted" | "secret" | null;

/** The lineage of a payload: untrusted/secret witness paths highlighted, sanitized nodes dashed,
 *  quarantined nodes greyed, sources as diamonds. Information is never carried by colour alone.
 *  "Trace" dims everything but one witness route and runs the dashes along it once (GSAP). */
export function LineageGraph({ nodes, edges, untrustedWitness, secretWitness, tainted, marked, layoutFrom, fresh, summary, inDialog }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const theme = useThemeTick();
  const [trace, setTrace] = useState<Trace>(null);
  const [full, setFull] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const c = palette();
    const uNodes = new Set(untrustedWitness);
    const sNodes = new Set(secretWitness);
    const taintedIds = new Set(tainted ?? []);
    const markedIds = new Set(marked ?? []);
    const freshIds = new Set(fresh ?? []);
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
      minZoom: 0.3,
      maxZoom: 2.5,
      layout: fixed
        ? { name: "preset", padding: 12 }
        : { name: "breadthfirst", directed: true, padding: 12, spacingFactor: 1.05 },
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "text-wrap": "wrap",
            "text-max-width": "116px",
            "font-size": 12,
            "font-family": "Atkinson Hyperlegible Next, system-ui, sans-serif",
            color: c.fg,
            "text-valign": "center",
            "text-halign": "center",
            shape: "round-rectangle",
            width: 128,
            height: 44,
            "background-color": c.card,
            "border-width": 2,
            "border-color": c.edge,
            "transition-property": "opacity",
            "transition-duration": 200,
          },
        },
        { selector: "node.source", style: { shape: "diamond", width: 110, height: 64 } },
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
            "font-size": 11,
            "font-family": "Atkinson Hyperlegible Next, system-ui, sans-serif",
            color: c.fg,
            "text-background-color": c.card,
            "text-background-opacity": 0.85,
            "text-background-padding": "2px",
            "transition-property": "opacity",
            "transition-duration": 200,
          },
        },
        { selector: "edge.u", style: { width: 4, "line-color": c.untrusted, "target-arrow-color": c.untrusted } },
        { selector: "edge.s", style: { width: 4, "line-style": "dotted", "line-color": c.secret, "target-arrow-color": c.secret } },
        { selector: ".dim", style: { opacity: 0.18 } },
      ],
    });

    if (freshIds.size > 0 && !reducedMotion()) {
      const added = cy.nodes().filter((n) => freshIds.has(n.id()));
      added.style("opacity", 0);
      added.animate({ style: { opacity: 1 } }, { duration: 420 });
    }
    cyRef.current = cy;
    return () => {
      cyRef.current = null;
      cy.destroy();
    };
  }, [nodes, edges, untrustedWitness, secretWitness, tainted, marked, layoutFrom, fresh, theme]);

  // "Trace": dim everything except one witness route, and march dashes along it once
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().removeClass("dim");
    if (!trace) return;
    const ids = new Set(trace === "untrusted" ? untrustedWitness : secretWitness);
    const pairs = pairsOf(trace === "untrusted" ? untrustedWitness : secretWitness);
    cy.nodes().filter((n) => !ids.has(n.id())).addClass("dim");
    const keep = cy.edges().filter((e) => pairs.has(`${e.data("source") as string}>${e.data("target") as string}`));
    cy.edges().difference(keep).addClass("dim");
    if (reducedMotion() || keep.empty()) return;
    keep.style({ "line-style": "dashed", "line-dash-pattern": [10, 6] });
    const state = { offset: 0 };
    const tween = gsap.to(state, {
      offset: -48,
      duration: 1.3,
      ease: "none",
      onUpdate: () => {
        keep.style("line-dash-offset", state.offset);
      },
      onComplete: () => {
        keep.removeStyle("line-style line-dash-pattern line-dash-offset");
      },
    });
    return () => {
      tween.kill();
    };
  }, [trace, untrustedWitness, secretWitness, nodes, edges, theme]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (full && !el.open) el.showModal();
    if (!full && el.open) el.close();
  }, [full]);

  const zoom = (factor: number): void => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.animate({ zoom: { level: cy.zoom() * factor, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } } }, { duration: reducedMotion() ? 0 : 240 });
  };
  const fit = (): void => {
    cyRef.current?.animate({ fit: { eles: cyRef.current.elements(), padding: 16 } }, { duration: reducedMotion() ? 0 : 360 });
  };

  const hasU = untrustedWitness.length > 0;
  const hasS = secretWitness.length > 0;

  return (
    <div className="graph-wrap">
      <div className="graph-toolbar" role="toolbar" aria-label="Graph controls">
        {(hasU || hasS) && (
          <span className="graph-trace" role="group" aria-label="Trace a witness route">
            {hasU && (
              <button type="button" className="btn btn-quiet trace-u" aria-pressed={trace === "untrusted"} onClick={() => setTrace(trace === "untrusted" ? null : "untrusted")}>
                <Icon name="route" /> Trace untrusted
              </button>
            )}
            {hasS && (
              <button type="button" className="btn btn-quiet trace-s" aria-pressed={trace === "secret"} onClick={() => setTrace(trace === "secret" ? null : "secret")}>
                <Icon name="route" /> Trace secret
              </button>
            )}
          </span>
        )}
        <span className="graph-zoom">
          <button type="button" className="icon-btn" onClick={() => zoom(1.25)} aria-label="Zoom in"><Icon name="plus" /></button>
          <button type="button" className="icon-btn" onClick={() => zoom(0.8)} aria-label="Zoom out"><Icon name="minus" /></button>
          <button type="button" className="icon-btn" onClick={fit} aria-label="Fit graph to view"><Icon name="fit" /></button>
          {!inDialog && <button type="button" className="icon-btn" onClick={() => setFull(true)} aria-label="Full screen"><Icon name="expand" /></button>}
        </span>
      </div>
      <div ref={container} className="graph" role="img" aria-label={summary ?? "Lineage graph of the held payload"} />
      <ul className="legend" aria-label="Graph legend">
        <li><span className="swatch sw-u" /> untrusted witness (solid, thick)</li>
        <li><span className="swatch sw-s" /> secret witness (dotted, thick)</li>
        <li><span className="swatch sw-sanitized" /> sanitized artifact (dashed border)</li>
        <li><span className="swatch sw-quarantined" /> quarantined (greyed)</li>
        <li><span className="swatch sw-source" /> source (diamond)</li>
        {tainted !== undefined && <li>⚠ doubly tainted draft (untrusted and secret lineage)</li>}
        {marked !== undefined && <li><span className="swatch sw-marked" /> artifact carrying a marker (halo)</li>}
      </ul>
      {!inDialog && (
        <dialog ref={dialog} className="dialog dialog-wide" aria-label="Lineage graph, full screen" onCancel={(e) => { e.preventDefault(); setFull(false); }}>
          {full && (
            <div className="dialog-body">
              <div className="dialog-head">
                <h2>Lineage graph</h2>
                <button type="button" className="icon-btn" onClick={() => setFull(false)} aria-label="Close full screen"><Icon name="close" /></button>
              </div>
              <LineageGraph nodes={nodes} edges={edges} untrustedWitness={untrustedWitness} secretWitness={secretWitness} tainted={tainted} marked={marked} layoutFrom={layoutFrom} fresh={fresh} summary={summary} inDialog />
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
