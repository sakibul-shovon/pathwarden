import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import type { GraphAt } from "../../../api/types";
import { usePoll } from "../../../hooks";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorPanel } from "../../../shared/components/ErrorPanel";
import { Skeleton } from "../../../shared/components/Skeleton";
import { useMediaQuery } from "../../../shared/lib/useMediaQuery";
import { describeError } from "../../errorCatalogue";
import { LineageFigure } from "../../graph/LineageFigure";
import { NodeDrawer } from "../../graph/NodeDrawer";
import { completeStep } from "../../guideStore";
import type { TabId, UrlState } from "../../url";
import { FactsPanel } from "./FactsPanel";
import { Scrubber } from "./Scrubber";
import { clampT, FETCH_DEBOUNCE_MS, markedIds, markerViews, nextReplayT, REPLAY_STEP_MS } from "./timeLogic";
import "./time.css";

const NONE: string[] = [];

interface TimeViewProps {
  /** The time named in the URL (`?t=`), or `null` to start at the end of the story. */
  initialT: number | null;
  onNavigate: (tab: TabId, patch?: Partial<UrlState>) => void;
  /** Reflect the time in the address bar (replaces the history entry). */
  onChangeT: (t: number) => void;
}

/** Replays the attack: the graph as it was at logical time t. The page renders what the API returns, including the two story
 *  markers and the doubly tainted drafts; it never computes a taint itself. */
export function TimeView({ initialT, onNavigate, onChangeT }: TimeViewProps) {
  const max = usePoll(api.timelineMax, 3000);
  const maxT = max.data?.t ?? 0;
  const narrow = useMediaQuery("(max-width: 767px)");
  const [wantGraph, setWantGraph] = useState(false);
  const [t, setTState] = useState<number | null>(initialT);
  const [graph, setGraph] = useState<GraphAt | null>(null);
  const [full, setFull] = useState<GraphAt | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [playing, setPlaying] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const [openNode, setOpenNode] = useState<string | null>(null);

  const setT = useCallback(
    (next: number) => {
      const value = clampT(next, maxT);
      setTState(value);
      onChangeT(value);
    },
    [maxT, onChangeT],
  );

  // the clock is known for the first time: start at the end of the story (or at the deep-linked time, kept inside the clock)
  useEffect(() => {
    if (!max.data) return;
    if (t === null) setTState(max.data.t);
    else if (t > max.data.t) setTState(max.data.t);
  }, [t, max.data]);

  // the whole graph fixes the layout, so nodes keep their place while time moves
  useEffect(() => {
    if (!max.data) return;
    let cancelled = false;
    api
      .graphAt(max.data.t)
      .then((g) => {
        if (!cancelled) setFull(g);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [max.data?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  // debounced, cancellable fetch of the requested time: a superseded answer is never rendered
  useEffect(() => {
    if (t === null) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api
        .graphAt(t, controller.signal)
        .then((g) => {
          setGraph(g);
          setError(null);
        })
        .catch((err: unknown) => {
          if (!controller.signal.aborted) setError(err);
        });
    }, FETCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [t]);

  const current = t ?? 0;

  // the replay advances one step at a time and stops at the last time
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      const next = nextReplayT(current, maxT);
      if (next === null) {
        setPlaying(false);
        setAnnounce(`Replay finished at t = ${current}.`);
      } else {
        setT(next);
      }
    }, REPLAY_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [playing, current, maxT, setT]);

  const markers = (graph ?? full)?.markers ?? null;
  const views = useMemo(() => markerViews(markers, current, maxT), [markers, current, maxT]);
  const marked = useMemo(() => markedIds(graph?.markers ?? null), [graph]);
  const layoutFrom = useMemo(() => (full ? { nodes: full.nodes, edges: full.edges } : undefined), [full]);
  const loadContent = useCallback((id: string) => api.artifact(id, "main").then((a) => a.content), []);
  const closeDrawer = useCallback(() => setOpenNode(null), []);

  // story step 5 is done when the person is on the moment the poisoned memory was written
  useEffect(() => {
    if (markers?.poisoned_memory_written && markers.poisoned_memory_written.t === current) completeStep("sleeper");
  }, [markers, current]);

  const replay = (): void => {
    if (playing) {
      setPlaying(false);
      setAnnounce(`Replay paused at t = ${current}.`);
      return;
    }
    setAnnounce("");
    if (current >= maxT) setT(0);
    setPlaying(true);
  };
  const scrub = (value: number): void => {
    setPlaying(false);
    setT(value);
  };

  if (max.data && maxT === 0) {
    return (
      <EmptyState
        action={
          <Button variant="primary" onClick={() => onNavigate("run", { scenario: "attack_sleeper_44", guard: true })}>
            Open Run with attack_sleeper_44
          </Button>
        }
      >
        Nothing has been recorded yet. Run a scenario (for the story use attack_sleeper_44) and come back here.
      </EmptyState>
    );
  }

  const failure = error ? describeError(error) : null;
  const openNodeData = graph?.nodes.find((n) => n.id === openNode) ?? null;
  const graphVisible = !narrow || wantGraph;

  return (
    <div className="pw-time">
      <Scrubber t={current} max={maxT} markers={views} playing={playing} onChange={scrub} onJump={scrub} onReplay={replay} />
      <p className="pw-visually-hidden" role="status">
        {announce}
      </p>
      {max.error && !max.data && <ErrorPanel title="Could not read the clock" code="load_error">{max.error}</ErrorPanel>}
      {failure && (
        <ErrorPanel title={failure.title} code={failure.code}>
          {failure.hint && <p>{failure.hint}</p>}
          {failure.detail && <p className="pw-muted">{failure.detail}</p>}
          {graph && <p className="pw-muted">The last frame (t = {graph.t}) is still shown.</p>}
        </ErrorPanel>
      )}

      {graph === null ? (
        <Skeleton lines={1} height={360} />
      ) : (
        <div className="pw-time__body">
          <div className="pw-time__graph">
            {graphVisible ? (
              <LineageFigure
                scope="time"
                subject={`the workspace at t = ${graph.t}`}
                nodes={graph.nodes}
                edges={graph.edges}
                untrustedWitness={NONE}
                secretWitness={NONE}
                tainted={graph.doubly_tainted}
                marked={marked}
                layoutFrom={layoutFrom}
                highlight={highlight}
                onHover={setHighlight}
                onOpen={setOpenNode}
                selected={openNode}
                traceKey={null}
                fadeNew={!playing}
                source={`GET /graph-at?t=${graph.t}`}
              />
            ) : (
              <Button onClick={() => setWantGraph(true)}>Show graph</Button>
            )}
          </div>
          <FactsPanel
            graph={graph}
            loadingT={graph.t === current ? null : current}
            onOpenNode={setOpenNode}
            onOpenCase={(id) => onNavigate("investigate", { action: id })}
          />
        </div>
      )}

      <NodeDrawer
        node={openNodeData}
        nodes={graph?.nodes ?? []}
        edges={graph?.edges ?? []}
        untrustedWitness={NONE}
        secretWitness={NONE}
        loadContent={loadContent}
        onClose={closeDrawer}
        onOpenNode={setOpenNode}
      />
    </div>
  );
}
