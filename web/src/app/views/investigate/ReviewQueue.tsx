import type { ActionListItem } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { EmptyState } from "../../../shared/components/EmptyState";
import { Skeleton } from "../../../shared/components/Skeleton";
import { StatusPill } from "../../../shared/components/StatusPill";
import { queueGroups } from "./caseLogic";

interface ReviewQueueProps {
  actions: ActionListItem[] | null;
  workspace: string;
  selected: string | null;
  onSelect: (id: string) => void;
  /** Start the demo story: opens Run with the attack scenario and the guard on. */
  onRun: () => void;
}

/** Actions grouped by what they need: a decision from a human, or nothing (resolved). Grouping uses the API status only. */
export function ReviewQueue({ actions, workspace, selected, onSelect, onRun }: ReviewQueueProps) {
  if (actions === null) return <Skeleton lines={3} height={32} />;
  if (actions.length === 0) {
    return (
      <EmptyState action={<Button variant="primary" onClick={onRun}>Run attack_pipeline_42</Button>}>
        No actions in {workspace} yet. Run a scenario to create one.
      </EmptyState>
    );
  }
  const { needs, resolved } = queueGroups(actions);
  const group = (title: string, items: ActionListItem[]) => (
    <section className="pw-queue__group" aria-label={title}>
      <h2 className="pw-queue__title">
        {title} <span className="pw-muted">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="pw-muted pw-queue__none">None.</p>
      ) : (
        <ul>
          {items.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={a.id === selected ? "pw-queue__item pw-queue__item--on" : "pw-queue__item"}
                aria-current={a.id === selected ? "true" : undefined}
                onClick={() => onSelect(a.id)}
              >
                <span className="pw-queue__ids">
                  <code>{a.id}</code>
                  <code className="pw-muted">{a.payload_id}</code>
                </span>
                <StatusPill status={a.status} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
  return (
    <div className="pw-queue">
      {group("Needs a decision", needs)}
      {group("Resolved", resolved)}
    </div>
  );
}
