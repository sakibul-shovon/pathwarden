import { useMemo, useState } from "react";
import type { SessionView, TimelineRow } from "../../../api/types";
import { Icon } from "../../../shared/icons/Icon";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { filterRows, groupBySession, verbOf, type LogFilter } from "./runLogic";
import { Scroll } from "../../../shared/components/Scroll";

interface EventLogProps {
  rows: TimelineRow[];
  sessions: SessionView[];
}

/** Everything the run recorded, in order (`RunResult.timeline`). Grouped by session by default; the table view lists the
 *  same rows with the same count. A filter narrows what is shown but the heading always says how many of how many. */
export function EventLog({ rows, sessions }: EventLogProps) {
  const [filter, setFilter] = useState<LogFilter>("all");
  const [view, setView] = useState<"grouped" | "table">("grouped");
  const shown = useMemo(() => filterRows(rows, filter), [rows, filter]);
  const groups = useMemo(() => groupBySession(shown, sessions), [shown, sessions]);
  return (
    <section aria-labelledby="pw-log-title">
      <h2 id="pw-log-title" className="pw-run__h">
        Event log
      </h2>
      <p className="pw-muted" aria-live="polite">
        {shown.length} of {rows.length} events recorded by the runtime.
      </p>
      <div className="pw-log__controls">
        <SegmentedControl
          legend="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "reads", label: "Reads" },
            { value: "writes", label: "Writes" },
            { value: "gate", label: "Gate" },
          ]}
        />
        <SegmentedControl
          legend="View"
          value={view}
          onChange={setView}
          options={[
            { value: "grouped", label: "By session" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <p className="pw-muted">No events match this filter.</p>
      ) : view === "table" ? (
        <Scroll label="Event log">
          <table className="pw-log__table">
            <caption className="pw-visually-hidden">Events recorded during the run</caption>
            <thead>
              <tr>
                <th scope="col">t</th>
                <th scope="col">agent</th>
                <th scope="col">operation</th>
                <th scope="col">detail</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.t} className={r.op === "gate" ? "pw-log__gate" : undefined}>
                  <td>{r.t}</td>
                  <td>{r.agent}</td>
                  <td>{verbOf(r.op)}</td>
                  <td>
                    <code>{r.detail}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      ) : (
        groups.map((g) => (
          <div key={g.session ?? "none"} className="pw-log__group">
            <h3 className="pw-log__session">{g.label}</h3>
            <ol className="pw-log__rows">
              {g.rows.map((r) => (
                <li key={r.t} className={r.op === "gate" ? "pw-log__row pw-log__row--gate" : "pw-log__row"}>
                  <span className="pw-log__t">{r.t}</span>
                  <span className="pw-log__verb">
                    {r.op === "gate" && <Icon name="gate" size={14} />} {verbOf(r.op)}
                  </span>
                  <code className="pw-log__detail">{r.detail}</code>
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
    </section>
  );
}
