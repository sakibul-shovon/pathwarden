import cytoscape from "cytoscape";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { CapEdge, CapNode } from "../../api/types";
import { useThemeTick } from "../../hooks";
import { capabilityStyle, readPalette } from "./canvasStyle";
import { fitView, zoomTo } from "./canvasMotion";
import { capEdgeClasses, capEdgeText, capLabel, capNodeClasses, capRoots } from "./capModel";
import type { CanvasHandle } from "./LineageCanvas";

export interface CapabilityCanvasProps {
  nodes: CapNode[];
  edges: CapEdge[];
  selected: string | null;
  /** cap ids of the candidate being previewed (drawn as a thick cut) */
  cut: string[];
  onSelect: (agent: string) => void;
  ariaLabel: string;
  describedBy: string;
}

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const FIT_PADDING = 24;

/** The capability graph, laid out breadth-first from the sources so data flows left to right (top to bottom) towards the sinks.
 *  Toxic, cost and cut come from the API (`GET /remediation/{topology}`); this canvas only draws them. The canvas is built once per
 *  graph structure; previewing a cut, selecting an agent and applying a cut update classes and labels in place, so the width, the colour
 *  and the fade of an edge can transition instead of jumping (§17.4). */
const CapabilityCanvas = forwardRef<CanvasHandle, CapabilityCanvasProps>(function CapabilityCanvas({ nodes, edges, selected, cut, onSelect, ariaLabel, describedBy }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  const theme = useThemeTick();
  const [built, setBuilt] = useState(0);
  // the parent may pass new arrays each render: only the ids decide whether the canvas is rebuilt, the contents are applied in place
  const cutKey = cut.join("|");
  const structure = useMemo(() => `${nodes.map((n) => n.name).join("|")}#${edges.map((e) => e.cap_id).join("|")}`, [nodes, edges]);
  const latest = useRef({ nodes, edges, selected, cutKey });
  latest.current = { nodes, edges, selected, cutKey };

  useImperativeHandle(ref, () => {
    const zoomBy = (factor: number): void => {
      const cy = cyRef.current;
      const el = container.current;
      if (!cy || !el) return;
      zoomTo(cy, Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, cy.zoom() * factor)), { x: el.clientWidth / 2, y: el.clientHeight / 2 });
    };
    return {
      zoomIn: () => zoomBy(1.25),
      zoomOut: () => zoomBy(0.8),
      fit: () => {
        if (cyRef.current) fitView(cyRef.current, FIT_PADDING);
      },
    };
  }, []);

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
        await document.fonts.ready;
      } catch {
        // measured with the fallback face
      }
      if (cancelled) return;
      const now = latest.current;
      const cutSet = new Set(now.cutKey === "" ? [] : now.cutKey.split("|"));
      cy = cytoscape({
        container: el,
        elements: [
          ...now.nodes.map((n) => ({ group: "nodes" as const, data: { id: n.name, label: capLabel(n) }, classes: capNodeClasses(n, now.selected) })),
          ...now.edges.map((e) => ({ group: "edges" as const, data: { id: e.cap_id, source: e.src, target: e.dst, text: capEdgeText(e, cutSet) }, classes: capEdgeClasses(e, cutSet) })),
        ],
        style: capabilityStyle(readPalette()),
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        autoungrabify: true,
        boxSelectionEnabled: false,
      });
      cy.layout({ name: "breadthfirst", directed: true, padding: FIT_PADDING, spacingFactor: 1.05, roots: capRoots(now.nodes) }).run();
      cy.on("tap", "node.agent", (event) => {
        el.focus();
        select.current(event.target.id() as string);
      });
      cy.on("mouseover", "node.agent", () => {
        el.style.cursor = "pointer";
      });
      cy.on("mouseout", "node.agent", () => {
        el.style.cursor = "";
      });
      cy.on("viewport", () => {
        el.dataset.zoom = (cy?.zoom() ?? 1).toFixed(2);
      });
      el.dataset.zoom = cy.zoom().toFixed(2);
      el.dataset.builds = String(Number(el.dataset.builds ?? "0") + 1);
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
  }, [structure, theme]);

  // the contents change, the canvas stays: classes and labels are set in place and the style sheet's transitions do the rest
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    const cutSet = new Set(cutKey === "" ? [] : cutKey.split("|"));
    cy.batch(() => {
      for (const n of nodes) {
        const node = cy.getElementById(n.name);
        node.data("label", capLabel(n));
        node.classes(capNodeClasses(n, selected));
      }
      for (const e of edges) {
        const edge = cy.getElementById(e.cap_id);
        edge.data("text", capEdgeText(e, cutSet));
        edge.classes(capEdgeClasses(e, cutSet));
      }
    });
  }, [built, nodes, edges, selected, cutKey]);

  useEffect(() => {
    const wrapper = container.current?.parentElement;
    if (!wrapper) return;
    const guard = (event: WheelEvent): void => {
      if (!event.ctrlKey && !event.metaKey) event.stopPropagation();
    };
    wrapper.addEventListener("wheel", guard, { capture: true, passive: true });
    return () => wrapper.removeEventListener("wheel", guard, { capture: true });
  }, []);

  return (
    <div className="pw-canvas__wrap">
      <div ref={container} className="pw-canvas" role="img" aria-label={ariaLabel} aria-describedby={describedBy} tabIndex={-1} data-roots={capRoots(nodes).length} />
    </div>
  );
});

export default CapabilityCanvas;
