import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from "react";
import type { LineageEdge, LineageNode } from "../../api/types";
import { Button } from "../../shared/components/Button";
import { Notice } from "../../shared/components/Notice";
import { SegmentedControl } from "../../shared/components/SegmentedControl";
import { Skeleton } from "../../shared/components/Skeleton";
import { CanvasToolbar } from "./CanvasToolbar";
import { graphCaption } from "./graphModel";
import { GraphLegend, lineageLegend } from "./GraphLegend";
import { readPrefs, writePrefs, type GraphPrefs } from "./graphPrefs";
import { GraphTable } from "./GraphTable";
import { chooseLayout } from "./lanes";
import type { CanvasHandle } from "./LineageCanvas";
import "./graph.css";

// Cytoscape is large and only graph views need it: it is fetched when a canvas first mounts
const LineageCanvas = lazy(() => import("./LineageCanvas"));

interface LineageFigureProps {
  /** Keeps this view's Graph/Table and Lanes/Tree choice apart from other views'. */
  scope: string;
  /** What the lineage belongs to, for the caption ("act-0001"). */
  subject: string;
  nodes: LineageNode[];
  edges: LineageEdge[];
  untrustedWitness: string[];
  secretWitness: string[];
  payloadId?: string | null;
  /** The node whose neighbourhood stays at full strength; set by a hovered or focused chip, row or canvas node. */
  highlight: string | null;
  onHover: (id: string | null) => void;
  onOpen: (id: string) => void;
  /** The node whose drawer is open. */
  selected: string | null;
  /** The witness trace plays once for each new value; `null` shows the final state at once. */
  traceKey: string | null;
  tainted?: string[];
  marked?: string[];
  layoutFrom?: { nodes: LineageNode[]; edges: LineageEdge[] };
  /** Where the data came from, shown under the figure. */
  source: string;
}

/** The lineage as a figure: a canvas (lanes by default) or the same data as tables, with filters, the witness trace, a legend
 *  and a generated caption (ui-redesign.md §15). It draws what the API returned; it never decides a verdict or a taint. */
export function LineageFigure(props: LineageFigureProps) {
  const { scope, subject, nodes, edges, untrustedWitness, secretWitness, payloadId, highlight, onHover, onOpen, selected, traceKey, tainted, marked, layoutFrom, source } = props;
  const [prefs, setPrefs] = useState<GraphPrefs>(() => readPrefs(scope));
  const [fullscreen, setFullscreen] = useState(false);
  const [witnessOnly, setWitnessOnly] = useState(false);
  const [focusOn, setFocusOn] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  const canvas = useRef<CanvasHandle>(null);
  const captionId = useId();

  const choice = chooseLayout(nodes.length);
  const layout = choice.layout === "tree" ? "tree" : prefs.layout;
  const choose = useCallback(
    (next: Partial<GraphPrefs>) =>
      setPrefs((p) => {
        const merged = { ...p, ...next };
        writePrefs(scope, merged);
        return merged;
      }),
    [scope],
  );

  // Esc leaves full screen (the native dialogs handle their own Esc)
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && !document.querySelector("dialog[open]")) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);
  // the canvas has a new size: let it refit
  useEffect(() => {
    const t = window.setTimeout(() => canvas.current?.fit(), 60);
    return () => window.clearTimeout(t);
  }, [fullscreen]);
  // a different graph resets the filters
  useEffect(() => {
    setWitnessOnly(false);
    setFocusOn(null);
  }, [nodes, edges]);

  const caption = graphCaption(subject, nodes, edges, untrustedWitness, secretWitness);
  const hasWitness = untrustedWitness.length > 1 || secretWitness.length > 1;
  const effectiveTrace = traceKey === null ? null : `${traceKey}:${replay}`;

  return (
    <figure className={fullscreen ? "pw-graphfig pw-graphfig--full" : "pw-graphfig"}>
      <div className="pw-graphfig__controls">
        <SegmentedControl
          legend="Show as"
          value={prefs.view}
          onChange={(view) => choose({ view })}
          options={[
            { value: "graph", label: "Graph" },
            { value: "table", label: "Table" },
          ]}
        />
        {prefs.view === "graph" && (
          <SegmentedControl
            legend="Layout"
            value={layout}
            onChange={(next) => choose({ layout: next })}
            options={[
              { value: "lanes", label: "Lanes", disabled: choice.layout === "tree", hint: choice.reason ?? undefined },
              { value: "tree", label: "Tree" },
            ]}
          />
        )}
      </div>
      {prefs.view === "graph" && choice.reason && <Notice variant="info">{choice.reason}</Notice>}

      {prefs.view === "graph" ? (
        <>
          <CanvasToolbar canvas={canvas} fullscreen={fullscreen} onFullscreen={() => setFullscreen((f) => !f)}>
            <span className="pw-canvasbar__filters">
              <Button size="sm" aria-pressed={witnessOnly} onClick={() => setWitnessOnly((v) => !v)} disabled={!hasWitness}>
                Only witness paths
              </Button>
              <Button size="sm" aria-pressed={focusOn !== null} onClick={() => setFocusOn((f) => (f === null ? selected : null))} disabled={focusOn === null && selected === null}>
                {focusOn === null ? "Focus on the selected node" : "Show everything again"}
              </Button>
              <Button size="sm" onClick={() => setReplay((n) => n + 1)} disabled={!hasWitness || traceKey === null}>
                Replay trace
              </Button>
            </span>
          </CanvasToolbar>
          <Suspense fallback={<Skeleton lines={1} height={320} />}>
            <LineageCanvas
              ref={canvas}
              nodes={nodes}
              edges={edges}
              untrustedWitness={untrustedWitness}
              secretWitness={secretWitness}
              layout={layout}
              payloadId={payloadId}
              tainted={tainted}
              marked={marked}
              layoutFrom={layoutFrom}
              highlight={highlight}
              selected={selected}
              focusOn={focusOn}
              witnessOnly={witnessOnly}
              traceKey={effectiveTrace}
              onHover={onHover}
              onOpen={onOpen}
              ariaLabel={`Lineage graph of ${subject}: ${caption}`}
              describedBy={captionId}
            />
          </Suspense>
          {(witnessOnly || focusOn !== null) && (
            <p className="pw-muted" role="status">
              Display filter: {witnessOnly && "only the witness paths"}
              {witnessOnly && focusOn !== null && " and "}
              {focusOn !== null && `only ancestors and descendants of ${focusOn}`}. It hides drawn elements of the returned graph; it is not a security computation.
            </p>
          )}
          <GraphLegend items={lineageLegend({ witness: hasWitness, payload: Boolean(payloadId), marked: Boolean(marked && marked.length > 0), tainted: Boolean(tainted && tainted.length > 0) })} label="Graph legend" />
        </>
      ) : (
        <GraphTable nodes={nodes} edges={edges} untrustedWitness={untrustedWitness} secretWitness={secretWitness} onOpen={onOpen} onHover={onHover} />
      )}
      <figcaption id={captionId} className="pw-graphfig__caption">
        {caption} <span className="pw-figure__source">Source: {source}</span>
      </figcaption>
    </figure>
  );
}
