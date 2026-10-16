import type { GraphAt } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { StatusPill } from "../../../shared/components/StatusPill";
import { Icon } from "../../../shared/icons/Icon";
import { frameSummary, taintedSummary, writtenAt } from "./timeLogic";

interface FactsPanelProps {
  /** The frame on screen; it may be an earlier time while the requested one loads. */
  graph: GraphAt;
  /** The time being fetched, when it differs from the frame on screen. */
  loadingT: number | null;
  onOpenNode: (id: string) => void;
  onOpenCase: (actionId: string) => void;
}

/** What the graph at this moment says in words: counts, the doubly tainted draft, what was written now, the actions (with their
 *  status as it is now) and the caveat that flags are current values, not history. */
export function FactsPanel({ graph, loadingT, onOpenNode, onOpenCase }: FactsPanelProps) {
  const written = writtenAt(graph);
  const tainted = taintedSummary(graph);
  return (
    <aside className="pw-facts-panel" aria-label={`The workspace at t = ${graph.t}`}>
      <h2 className="pw-facts-panel__title">
        At t = {graph.t}
        {loadingT !== null && (
          <span className="pw-facts-panel__loading" role="status">
            Loading t = {loadingT}…
          </span>
        )}
      </h2>
      <p>{frameSummary(graph)}</p>
      {tainted && (
        <p className="pw-facts-panel__tainted">
          <Icon name="warning" size={16} /> <strong>{tainted}</strong>
        </p>
      )}

      <h3 className="pw-facts-panel__h">Written at this moment</h3>
      {written.length === 0 ? (
        <p className="pw-muted">Nothing: the clock ticks on other events too.</p>
      ) : (
        <ul className="pw-facts-panel__list">
          {written.map((n) => (
            <li key={n.id}>
              <button type="button" className="pw-gtable__open" onClick={() => onOpenNode(n.id)}>
                <strong>{n.key || n.kind || n.id}</strong> <code>{n.id}</code>
              </button>{" "}
              <span className="pw-muted">
                {n.kind}
                {n.agent_id ? ` · by ${n.agent_id}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      {graph.actions.length > 0 && (
        <>
          <h3 className="pw-facts-panel__h">Actions proposed by now</h3>
          <ul className="pw-facts-panel__list">
            {graph.actions.map((a) => (
              <li key={a.action_id}>
                <code>{a.action_id}</code> <StatusPill status={a.status} /> <span className="pw-muted">now</span>{" "}
                <Button variant="quiet" size="sm" onClick={() => onOpenCase(a.action_id)}>
                  Open case
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="pw-muted pw-facts-panel__note">
        <Icon name="info" size={14} />
        <span>
          Quarantine, approval and action status show their values <em>now</em>, not as they were at this time: they are flags, not history.
        </span>
      </p>
    </aside>
  );
}
