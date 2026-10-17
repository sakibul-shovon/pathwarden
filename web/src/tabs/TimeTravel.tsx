import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { GraphAt, TimeMarker } from "../api/types";
import { LineageGraph } from "../components/LineageGraph";
import { errorText, usePoll } from "../hooks";
import { useNav } from "../nav";
import { ViewHeader } from "../shell/AppShell";
import { StatusChip } from "../ui/Chip";
import { Icon } from "../ui/Icon";

const DEBOUNCE_MS = 120;
const PLAY_MS = 700;
const NO_IDS: string[] = [];

function MarkerButton({ label, marker, t, onJump }: { label: string; marker: TimeMarker | null; t: number; onJump: (t: number) => void }) {
  if (marker === null) {
    return <button type="button" className="marker" disabled title="this run has no such moment"><Icon name="info" size={14} /> {label}: none</button>;
  }
  return (
    <button type="button" className={marker.t === t ? "marker here" : "marker"} aria-pressed={marker.t === t} onClick={() => onJump(marker.t)}>
      <Icon name="source" size={14} /> {label}: t={marker.t} <code>{marker.key}</code>
    </button>
  );
}

/** Replays the attack: the graph as it was at logical time t. The UI only renders what the API
 *  returns (including the two markers); it never computes taint itself. */
export function TimeTravelTab({ initialT }: { initialT: number | null }) {
  const { go } = useNav();
  const max = usePoll(api.timelineMax, 3000);
  const maxT = max.data?.t ?? 0;
  const [t, setT] = useState<number | null>(initialT);
  const [graph, setGraph] = useState<GraphAt | null>(null);
  const [full, setFull] = useState<GraphAt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

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

  // Play: advance one logical step at a time through the same debounced fetch (no new endpoint)
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setT((cur) => {
        const next = (cur ?? 0) + 1;
        if (next >= maxT) setPlaying(false);
        return Math.min(next, maxT);
      });
    }, PLAY_MS);
    return () => window.clearInterval(timer);
  }, [playing, maxT]);

  const layoutFrom = useMemo(() => (full ? { nodes: full.nodes, edges: full.edges } : undefined), [full]);
  const marked = useMemo(() => {
    const m = graph?.markers;
    return [m?.poisoned_memory_written?.artifact_id, m?.draft_doubly_tainted?.artifact_id].filter(
      (id): id is string => id !== undefined,
    );
  }, [graph]);

  const current = t ?? 0;
  const shown = graph !== null && graph.t === current ? graph : null;
  const written = useMemo(() => (shown ? shown.nodes.filter((n) => n.created_at === shown.t) : []), [shown]);
  const fresh = useMemo(() => written.map((n) => n.id), [written]);

  const jump = (to: number): void => {
    setPlaying(false);
    setT(to);
  };
  const play = (): void => {
    if (current >= maxT) setT(0);
    setPlaying(!playing);
  };

  if (max.data && maxT === 0) {
    return (
      <section aria-label="Time travel">
        <ViewHeader id="time" />
        <div className="empty">
          <p><strong>Nothing has been recorded yet.</strong></p>
          <p className="muted">Run a scenario on the Run tab (for the story use <code>attack_sleeper_44</code>) and come back here.</p>
          <button type="button" className="btn btn-solid" onClick={() => go("run")}>Go to Run</button>
        </div>
      </section>
    );
  }

  const m1 = graph?.markers.poisoned_memory_written ?? null;
  const m2 = graph?.markers.draft_doubly_tainted ?? null;
  const pos = (v: number): string => `${maxT > 0 ? (v / maxT) * 100 : 0}%`;

  return (
    <section aria-label="Time travel" className="tt">
      <ViewHeader id="time" />
      {error && <div className="notice notice-hold" role="alert"><Icon name="alert" /> {error}</div>}

      <div className="panel">
        <div className="panel-head">
          <h2>Lineage graph at t = {current}</h2>
          {shown && (
            <span className="muted">
              {shown.nodes.length} nodes, {shown.edges.length} edges, {shown.actions.length} proposed action{shown.actions.length === 1 ? "" : "s"}
              {shown.doubly_tainted.length > 0 && <> · <strong className="tainted-note">⚠ {shown.doubly_tainted.length} doubly tainted draft{shown.doubly_tainted.length === 1 ? "" : "s"}</strong></>}
            </span>
          )}
        </div>
        {shown === null ? (
          <div aria-busy="true"><span className="skeleton sk-graph" /><span className="sr-only">Loading t = {current}…</span></div>
        ) : (
          <>
            <LineageGraph
              nodes={shown.nodes}
              edges={shown.edges}
              untrustedWitness={NO_IDS}
              secretWitness={NO_IDS}
              tainted={shown.doubly_tainted}
              marked={marked}
              layoutFrom={layoutFrom}
              fresh={fresh}
              summary={`Lineage graph at logical time ${shown.t}: ${shown.nodes.length} nodes and ${shown.edges.length} edges.`}
            />
            <p className="written" role="status">
              <strong>Written at t = {current}:</strong>{" "}
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
            {shown.actions.length > 0 && (
              <div className="scroll">
                <table>
                  <thead><tr><th>action</th><th>payload</th><th>status (now)</th></tr></thead>
                  <tbody>
                    {shown.actions.map((a) => (
                      <tr key={a.action_id}><td><code>{a.action_id}</code></td><td><code>{a.payload_id}</code></td><td><StatusChip status={a.status} /></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
        <p className="info-row"><Icon name="info" size={16} /> Quarantine, approval and action status are shown as they are <em>now</em>, not as they were at time t (they are mutable flags, not history).</p>
      </div>

      <div className="scrubber" role="group" aria-label="Time controls">
        <div className="scrubber-buttons">
          <button type="button" className="icon-btn" disabled={current <= 0} onClick={() => jump(Math.max(0, current - 1))} aria-label="Previous step"><Icon name="back" /></button>
          <button type="button" className="btn btn-solid btn-play" onClick={play} aria-pressed={playing}><Icon name={playing ? "pause" : "play"} /> {playing ? "Pause" : "Play"}</button>
          <button type="button" className="icon-btn" disabled={current >= maxT} onClick={() => jump(Math.min(maxT, current + 1))} aria-label="Next step"><Icon name="forward" /></button>
        </div>
        <div className="scrubber-track">
          <div className="flags" aria-hidden="true">
            {m1 && <span className="flag" style={{ left: pos(m1.t) }}>poisoned memory</span>}
            {m2 && <span className="flag flag-2" style={{ left: pos(m2.t) }}>draft doubly tainted</span>}
          </div>
          <input
            type="range"
            min={0}
            max={maxT}
            step={1}
            value={Math.min(current, maxT)}
            onChange={(e) => jump(Number(e.target.value))}
            aria-label="Logical time"
            aria-valuetext={`t ${current} of ${maxT}${m1?.t === current ? ", poisoned memory written" : ""}${m2?.t === current ? ", draft doubly tainted" : ""}`}
          />
        </div>
        <span className="clock">t = {current} / {maxT}</span>
        <div className="markers" aria-label="Markers">
          <MarkerButton label="Poisoned memory written" marker={m1} t={current} onJump={jump} />
          <MarkerButton label="Draft doubly tainted" marker={m2} t={current} onJump={jump} />
        </div>
      </div>
    </section>
  );
}
