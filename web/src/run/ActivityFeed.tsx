import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { TimelineRow } from "../api/types";
import { Icon } from "../ui/Icon";

const VERB: Record<string, string> = {
  start_session: "started a session",
  read_source: "read a source",
  sanitize: "sanitized the input into a task",
  write: "wrote",
  load: "loaded",
  propose: "proposed an external action",
  approve: "approved",
  gate: "gate decision",
};

const AGENT_LABEL: Record<string, string> = { triage: "Triage", fixer: "Fixer", release: "Release", gate: "Gate" };

function Entry({ row }: { row: TimelineRow }) {
  const isGate = row.op === "gate";
  return (
    <m.li
      className={isGate ? "feed-item feed-gate" : "feed-item"}
      layout="position"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <span className="feed-t">t {row.t}</span>
      <span className={`feed-agent feed-agent-${row.agent}`}>{AGENT_LABEL[row.agent] ?? row.agent}</span>
      <span className="feed-verb">{VERB[row.op] ?? row.op}</span>
      <code>{row.detail}</code>
    </m.li>
  );
}

/** The recorded events as an activity feed (newest at the bottom) with the full table one click away. */
export function ActivityFeed({ rows, step, playing }: { rows: TimelineRow[]; step: number; playing: boolean }) {
  const [asTable, setAsTable] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const shown = rows.slice(0, step);

  useEffect(() => {
    const el = box.current;
    if (el && playing) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [step, playing]);

  return (
    <div className="panel">
      <div className="panel-head">
        <h2>Agent activity</h2>
        <button type="button" className="btn btn-quiet" onClick={() => setAsTable(!asTable)} aria-pressed={asTable}>
          <Icon name="route" /> {asTable ? "View as feed" : "View as table"}
        </button>
      </div>
      {asTable ? (
        <div className="scroll">
          <table>
            <caption className="sr-only">Recorded timeline of the run</caption>
            <thead><tr><th>t</th><th>agent</th><th>operation</th><th>detail</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.t} className={row.op === "gate" ? "gate-row" : undefined}>
                  <td>{row.t}</td><td>{row.agent}</td><td>{row.op}</td><td><code>{row.detail}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="feed" ref={box} tabIndex={0} aria-label="Agent activity feed">
          <ol>
            <AnimatePresence initial={false}>
              {shown.map((row) => <Entry key={row.t} row={row} />)}
            </AnimatePresence>
          </ol>
          {shown.length === 0 && <p className="muted">Waiting for the first event…</p>}
        </div>
      )}
    </div>
  );
}
