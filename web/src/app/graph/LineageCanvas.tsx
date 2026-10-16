import cytoscape from "cytoscape";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { LineageEdge, LineageNode } from "../../api/types";
import { useThemeTick } from "../../hooks";
import { lineageStyle, readPalette } from "./canvasStyle";
import { canvasLabel, focusSet, neighbourhood, traceFrames, witnessNodes, witnessPairs } from "./graphModel";
import { lanesLayout } from "./lanes";

export interface CanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
}

export interface LineageCanvasProps {
  nodes: LineageNode[];
  edges: LineageEdge[];
  untrustedWitness: string[];
  secretWitness: string[];
  layout: "lanes" | "tree";
  /** The action's payload artifact: drawn with a heavy border and the word "payload". */
  payloadId?: string | null;
  /** Time travel: artifacts that are doubly tainted / that carry a marker of the moment shown (from the API, never computed here). */
  tainted?: string[];
  marked?: string[];
  /** Time travel: lay out this (final) graph and keep the same positions for every earlier time. */
  layoutFrom?: { nodes: LineageNode[]; edges: LineageEdge[] };
  /** The node whose neighbourhood stays at full strength (a hovered or focused chip, node or row). */
  highlight: string | null;
  /** The node whose drawer is open. */
  selected: string | null;
  /** Focus mode: show only this node's ancestors and descendants (a display filter). */
  focusOn: string | null;
  witnessOnly: boolean;
  /** Play the witness trace once for each new value (it is skipped under reduced motion). */
  traceKey: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
  ariaLabel: string;
  describedBy: string;
}

// lower than the spec's 0.4: a graph with many sessions must still be able to fit the canvas
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const FIT_PADDING = 24;

const none: string[] = [];

/** The lineage as a Cytoscape canvas. Cytoscape is imported only by this module, which the view loads lazily. */
const LineageCanvas = forwardRef<CanvasHandle, LineageCanvasProps>(function LineageCanvas(props, ref) {
  const { nodes, edges, untrustedWitness, secretWitness, layout, payloadId, layoutFrom, highlight, selected, focusOn, witnessOnly, traceKey, ariaLabel, describedBy } = props;
  const tainted = props.tainted ?? none;
  const marked = props.marked ?? none;
  const container = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [built, setBuilt] = useState(0);
  const theme = useThemeTick();
  const handlers = useRef({ onHover: props.onHover, onOpen: props.onOpen });
  handlers.current = { onHover: props.onHover, onOpen: props.onOpen };
  const played = useRef<string | null>(null);
  const labels = useRef<HTMLDivElement>(null);
  const lanes = useMemo(() => (layout === "lanes" ? lanesLayout((layoutFrom ?? { nodes, edges }).nodes, (layoutFrom ?? { nodes, edges }).edges) : null), [layout, layoutFrom, nodes, edges]);

  useImperativeHandle(ref, () => {
    const zoomBy = (factor: number): void => {
      const cy = cyRef.current;
      const el = container.current;
      if (!cy || !el) return;
      const level = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cy.zoom() * factor));
      cy.zoom({ level, renderedPosition: { x: el.clientWidth / 2, y: el.clientHeight / 2 } });
    };
    return {
      zoomIn: () => zoomBy(1.25),
      zoomOut: () => zoomBy(0.8),
      fit: () => cyRef.current?.fit(undefined, FIT_PADDING),
    };
  }, []);

  // build the canvas only when the graph, the layout or the theme changes; everything else goes through classes below
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    let cancelled = false;
    let cy: cytoscape.Core | null = null;
    const observer = new ResizeObserver(() => {
      cy?.resize();
    });

    void (async () => {
      try {
        // the canvas measures text with the face that is loaded, so wait for the fonts
        await document.fonts.ready;
      } catch {
        // an old browser without the Font Loading API just measures with the fallback face
      }
      if (cancelled) return;
      const palette = readPalette();
      const uNodes = new Set(untrustedWitness);
      const sNodes = new Set(secretWitness);
      const taintedIds = new Set(tainted);
      const markedIds = new Set(marked);
      const uPairs = witnessPairs(untrustedWitness);
      const sPairs = witnessPairs(secretWitness);

      const elements: cytoscape.ElementDefinition[] = [];
      if (lanes) {
        // lane bands are compound parents; two invisible anchors give each band its full height
        for (const band of lanes.bands) {
          elements.push({ group: "nodes", data: { id: band.id }, classes: "lane" });
          elements.push({ group: "nodes", data: { id: `${band.id}:t`, parent: band.id }, position: { x: band.left, y: 0 }, classes: "anchor" });
          elements.push({ group: "nodes", data: { id: `${band.id}:b`, parent: band.id }, position: { x: band.left + band.width, y: lanes.height }, classes: "anchor" });
        }
      }
      for (const n of nodes) {
        const at = lanes?.positions.get(n.id);
        const parent = lanes?.bandOf.get(n.id);
        elements.push({
          group: "nodes",
          data: { id: n.id, label: canvasLabel(n, { payload: n.id === payloadId, tainted: taintedIds.has(n.id) }), ...(parent ? { parent } : {}) },
          ...(at ? { position: { ...at } } : {}),
          classes: [
            n.label === "Source" ? "source" : n.kind === "memory" || n.kind === "draft" ? n.kind : "artifact",
            n.id === payloadId ? "payload" : "",
            uNodes.has(n.id) ? "u" : "",
            sNodes.has(n.id) ? "s" : "",
            n.sanitized ? "sanitized" : "",
            n.approved ? "approved" : "",
            n.quarantined ? "quarantined" : "",
            taintedIds.has(n.id) ? "tainted" : "",
            markedIds.has(n.id) ? "marked" : "",
          ]
            .filter(Boolean)
            .join(" "),
        });
      }
      edges.forEach((e, i) => {
        const key = `${e.src}>${e.dst}`;
        const u = uPairs.has(key);
        const s = sPairs.has(key);
        elements.push({
          group: "edges",
          data: { id: `e${i}`, source: e.src, target: e.dst, text: u ? "untrusted" : s ? "secret" : "" },
          classes: [lanes ? "taxi" : "", u ? "u" : "", s ? "s" : ""].filter(Boolean).join(" "),
        });
      });

      cy = cytoscape({
        container: el,
        elements,
        style: lineageStyle(palette),
        layout: lanes ? { name: "preset", fit: true, padding: FIT_PADDING } : { name: "breadthfirst", directed: true, padding: FIT_PADDING, spacingFactor: 1.15 },
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        autoungrabify: true,
        boxSelectionEnabled: false,
        // the page scrolls with the wheel; zooming with it needs Ctrl or Cmd (see the wheel guard below)
      });
      cy.on("mouseover", "node:childless", (event) => {
        el.style.cursor = "pointer";
        handlers.current.onHover(event.target.id() as string);
      });
      cy.on("mouseout", "node:childless", () => {
        el.style.cursor = "";
        handlers.current.onHover(null);
      });
      cy.on("tap", "node:childless", (event) => {
        // the drawer returns focus to whatever had it: give it the canvas, not the page
        el.focus();
        handlers.current.onOpen(event.target.id() as string);
      });
      // the lane names sit in a strip above the canvas and follow the horizontal pan and zoom
      const placeLabels = (): void => {
        const box = labels.current;
        if (!box || !cy || !lanes) return;
        const z = cy.zoom();
        const pan = cy.pan();
        for (const band of lanes.bands) {
          const label = box.querySelector<HTMLElement>(`[data-band="${band.id}"]`);
          if (label) {
            label.style.left = `${band.left * z + pan.x}px`;
            label.style.width = `${band.width * z}px`;
          }
        }
      };
      cy.on("viewport", () => {
        el.dataset.zoom = (cy?.zoom() ?? 1).toFixed(2);
        placeLabels();
      });
      el.dataset.zoom = cy.zoom().toFixed(2);
      placeLabels();
      cyRef.current = cy;
      observer.observe(el);
      setBuilt((n) => n + 1);
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
      cy?.destroy();
      if (cyRef.current === cy) cyRef.current = null;
    };
  }, [nodes, edges, untrustedWitness, secretWitness, layout, lanes, payloadId, tainted, marked, theme]);

  // a plain wheel scrolls the page; only Ctrl or Cmd (which is also what a trackpad pinch sends) zooms the canvas
  useEffect(() => {
    const wrapper = container.current?.parentElement;
    if (!wrapper) return;
    const guard = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    wrapper.addEventListener("wheel", guard, { capture: true, passive: true });
    return () => wrapper.removeEventListener("wheel", guard, { capture: true });
  }, []);

  // hover and focus dim what is unrelated; the two filters hide; the open node is marked
  useEffect(() => {
    const cy = cyRef.current;
    const el = container.current;
    if (!cy || !el) return;
    cy.batch(() => {
      cy.elements().removeClass("dim gone picked");
      const real = cy.nodes(":childless").not(".anchor");
      const keep = (ids: Set<string>): void => {
        real.forEach((n) => {
          if (!ids.has(n.id())) n.addClass("gone");
        });
      };
      if (witnessOnly) {
        keep(witnessNodes(untrustedWitness, secretWitness));
        const pairs = new Set([...witnessPairs(untrustedWitness), ...witnessPairs(secretWitness)]);
        cy.edges().forEach((e) => {
          if (!pairs.has(`${e.source().id()}>${e.target().id()}`)) e.addClass("gone");
        });
      }
      if (focusOn) keep(focusSet(focusOn, edges));
      if (highlight && cy.getElementById(highlight).nonempty()) {
        const near = neighbourhood(highlight, edges);
        real.forEach((n) => {
          if (!near.nodes.has(n.id())) n.addClass("dim");
        });
        cy.edges().forEach((e) => {
          if (!near.edges.has(Number(e.id().slice(1)))) e.addClass("dim");
        });
      }
      if (selected) cy.getElementById(selected).addClass("picked");
    });
    el.dataset.dimmed = String(cy.elements(".dim").length);
    el.dataset.hidden = String(cy.elements(".gone").length);
  }, [built, highlight, selected, focusOn, witnessOnly, edges, untrustedWitness, secretWitness]);

  // the witness trace: each witness edge is drawn in order from the payload towards the source, then stays
  useEffect(() => {
    const cy = cyRef.current;
    const el = container.current;
    if (!cy || !el || traceKey === null || played.current === traceKey) return;
    const step = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dur-trace-step"));
    const frames = traceFrames(untrustedWitness, secretWitness);
    if (!(step > 0) || frames.length === 0) {
      played.current = traceKey;
      el.dataset.trace = frames.length === 0 ? "none" : "skipped";
      return;
    }
    el.dataset.trace = "playing";
    const edgeBetween = (from: string, to: string): cytoscape.EdgeCollection => cy.edges().filter((e) => e.source().id() === from && e.target().id() === to);
    const all = frames.flat().map((t) => edgeBetween(t.from, t.to));
    all.forEach((e) => e.addClass("untraced"));
    const timers = frames.map((frame, i) =>
      window.setTimeout(() => {
        frame.forEach((t) => edgeBetween(t.from, t.to).removeClass("untraced"));
        if (i === frames.length - 1) {
          played.current = traceKey;
          el.dataset.trace = "done";
        }
      }, (i + 1) * step),
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      cy.edges().removeClass("untraced");
    };
  }, [built, traceKey, untrustedWitness, secretWitness]);

  return (
    <div className="pw-canvas__wrap">
      {lanes && (
        <div ref={labels} className="pw-lanelabels" aria-hidden="true">
          {lanes.bands.map((b) => (
            <span key={b.id} data-band={b.id} className={`pw-lanelabel pw-lanelabel--${b.kind}`}>
              {b.label}
            </span>
          ))}
        </div>
      )}
      <div
        ref={container}
        className="pw-canvas"
        role="img"
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        tabIndex={-1}
        data-layout={layout}
        data-nodes={nodes.length}
      />
    </div>
  );
});

export default LineageCanvas;
