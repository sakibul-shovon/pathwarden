import { lazy, Suspense, useId, useRef, useState } from "react";
import type { CapEdge, CapNode } from "../../api/types";
import { Skeleton } from "../../shared/components/Skeleton";
import { CanvasToolbar } from "./CanvasToolbar";
import { CAPABILITY_LEGEND, GraphLegend } from "./GraphLegend";
import type { CanvasHandle } from "./LineageCanvas";
import "./graph.css";

const CapabilityCanvas = lazy(() => import("./CapabilityCanvas"));

interface CapabilityFigureProps {
  nodes: CapNode[];
  edges: CapEdge[];
  selected: string | null;
  /** cap ids of the candidate being previewed (drawn as a thick cut) */
  cut: string[];
  onSelect: (agent: string) => void;
  source: string;
}

/** The capability graph as a figure with zoom controls, a legend and a generated caption. Toxic agents, costs and cuts all come
 *  from the API; nothing here decides toxicity. */
export function CapabilityFigure({ nodes, edges, selected, cut, onSelect, source }: CapabilityFigureProps) {
  const canvas = useRef<CanvasHandle>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const captionId = useId();
  const toxic = nodes.filter((n) => n.toxic).length;
  const revoked = edges.filter((e) => e.revoked).length;
  const caption =
    `Capability graph: ${nodes.length} nodes, ${edges.length} flows (${revoked} revoked); ` +
    `${toxic === 0 ? "no toxic agent" : `${toxic} toxic ${toxic === 1 ? "agent" : "agents"}`}. Select an agent for its witness.`;
  return (
    <figure className={fullscreen ? "pw-graphfig pw-graphfig--full" : "pw-graphfig"}>
      <CanvasToolbar canvas={canvas} fullscreen={fullscreen} onFullscreen={() => setFullscreen((f) => !f)} />
      <Suspense fallback={<Skeleton lines={1} height={320} />}>
        <CapabilityCanvas ref={canvas} nodes={nodes} edges={edges} selected={selected} cut={cut} onSelect={onSelect} ariaLabel={caption} describedBy={captionId} />
      </Suspense>
      <GraphLegend items={CAPABILITY_LEGEND} label="Capability graph legend" />
      <figcaption id={captionId} className="pw-graphfig__caption">
        {caption} <span className="pw-figure__source">Source: {source}</span>
      </figcaption>
    </figure>
  );
}
