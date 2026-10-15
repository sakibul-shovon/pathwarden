import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { GraphAt, TimeMarker } from "../api/types";
import { LineageGraph } from "../components/LineageGraph";
import { errorText, usePoll } from "../hooks";

const DEBOUNCE_MS = 120;
const NO_IDS: string[] = [];

function MarkerButton({ label, marker, t, onJump }: { label: string; marker: TimeMarker | null; t: number; onJump: (t: number) => void }) {
  if (marker === null) {
    return <button type="button" disabled title="this run has no such moment">{label}: none</button>;
  }
  return (
    <button type="button" className={marker.t === t ? "here" : undefined} onClick={() => onJump(marker.t)}>
      {marker.t === t ? "● " : ""}{label}: t={marker.t} <code>{marker.key}</code>
    </button>
  );
}

/** Replays the attack: the graph as it was at logical time t. The UI only renders what the API
 *  returns (including the two markers); it never computes taint itself. */
export function TimeTravelTab({ initialT }: { initialT: number | null }) {
  const max = usePoll(api.timelineMax, 3000);
  const maxT = max.data?.t ?? 0;
  const [t, setT] = useState<number | null>(initialT);
  const [graph, setGraph] = useState<GraphAt | null>(null);
  const [full, setFull] = useState<GraphAt | null>(null);
  const [error, setError] = useState<string | null>(null);

  // first time the clock is known: start at the end of the story (or at the deep-linked time)
  useEffect(() => {
    if (t === null && max.data) setT(max.data.t);
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
        if (!cancelled) setError(errorText(err));
      });
    return () => {
      cancelled = true;
    };
  }, [max.data?.t]); // eslint-disable-line react-hooks/exhaustive-deps

  // debounced, cancellable fetch of the requested time: a stale answer is never rendered
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
          if (!controller.signal.aborted) setError(errorText(err));
        });
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [t]);

  const layoutFrom = useMemo(() => (full ? { nodes: full.nodes, edges: full.edges } : undefined), [full]);
  const marked = useMemo(() => {
    const m = graph?.markers;
    return [m?.poisoned_memory_written?.artifact_id, m?.draft_doubly_tainted?.artifact_id].filter(
      (id): id is string => id !== undefined,
    );
  }, [graph]);

  const current = t ?? 0;
  const shown = graph !== null && graph.t === current ? graph : null;
  const written = shown ? shown.nodes.filter((n) => n.created_at === shown.t) : [];

  if (max.data && maxT === 0) {
    return (
      <div className="card">
        <p>
          Nothing has been recorded yet. Run a scenario on the <strong>Run</strong> tab (for the story use{" "}
          <code>attack_sleeper_44</code>) and come back here.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="card">
        <div className="slider-row">
          <button type="button" className="step" disabled={current <= 0} onClick={() => setT(Math.max(0, current - 1))} aria-label="Previous step">◀</button>
          <input
            type="range"
            min={0}
            max={maxT}
            step={1}
            value={Math.min(current, maxT)}
            onChange={(e) => setT(Number(e.target.value))}
            aria-label="Logical time"
          />
          <button type="button" className="step" disabled={current >= maxT} onClick={() => setT(Math.min(maxT, current + 1))} aria-label="Next step">▶</button>
          <span className="clock">t = {current} / {maxT}</span>
        </div>
        <div className="markers" aria-label="Markers">
          <MarkerButton label="Poisoned memory written" marker={graph?.markers.poisoned_memory_written ?? null} t={current} onJump={setT} />
          <MarkerButton label="Draft doubly tainted" marker={graph?.markers.draft_doubly_tainted ?? null} t={current} onJump={setT} />
        </div>
        <p className="muted">
          Quarantine, approval and action status are shown as they are <em>now</em>, not as they were at time t
          (they are mutable flags, not history).
        </p>
      </div>

      {error && <div className="banner red">{error}</div>}

      <div className="card">
        <h3>Lineage graph at t = {current}</h3>
        {shown === null ? (
          <p className="muted">Loading t = {current}…</p>
        ) : (
          <>
            <p>
              {shown.nodes.length} nodes, {shown.edges.length} edges, {shown.actions.length} proposed action
              {shown.actions.length === 1 ? "" : "s"}
              {shown.doubly_tainted.length > 0 && (
                <> · <strong>⚠ {shown.doubly_tainted.length} doubly tainted draft{shown.doubly_tainted.length === 1 ? "" : "s"}</strong></>
              )}
            </p>
            <p>
              Written at this moment:{" "}
              {written.length === 0 ? (
                <span className="muted">nothing (the clock ticks on other events too)</span>
              ) : (
                written.map((n) => (
                  <span key={n.id} className="inline">
                    <code>{n.id}</code> {n.key || n.kind} ({n.kind}{n.agent_id ? `, by ${n.agent_id}` : ""})
                  </span>
                ))
              )}
            </p>
            <LineageGraph
              nodes={shown.nodes}
              edges={shown.edges}
              untrustedWitness={NO_IDS}
              secretWitness={NO_IDS}
              tainted={shown.doubly_tainted}
              marked={marked}
              layoutFrom={layoutFrom}
            />
            {shown.actions.length > 0 && (
              <table>
                <thead><tr><th>action</th><th>payload</th><th>status (now)</th></tr></thead>
                <tbody>
                  {shown.actions.map((a) => (
                    <tr key={a.action_id}><td><code>{a.action_id}</code></td><td><code>{a.payload_id}</code></td><td>{a.status}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </>
  );
}
