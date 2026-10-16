import type { Candidate } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Scroll } from "../../../shared/components/Scroll";
import { Icon } from "../../../shared/icons/Icon";
import { applyBlockedReason, costBars } from "./remediateLogic";

interface CutComparisonProps {
  /** `null` before cuts were suggested. */
  candidates: Candidate[] | null;
  best: Candidate | undefined;
  preview: string | null;
  busy: boolean;
  /** The sentence about the exhaustive optimum of the last `make eval`, or null. */
  optimum: string | null;
  onPreview: (id: string | null) => void;
  onApply: (candidate: Candidate) => void;
}

/** The candidate cuts exactly as the API returned them, each with its cost as a bar and as a number, whether it was verified on a
 *  temporary copy, and why it cannot be applied when it cannot. Preview draws the cut on the graph; Apply opens a review. */
export function CutComparison({ candidates, best, preview, busy, optimum, onPreview, onApply }: CutComparisonProps) {
  if (candidates === null) return <p className="pw-muted">Suggest cuts to compare four complete fixes.</p>;
  if (candidates.length === 0) return <p className="pw-muted">The API returned no candidate cut.</p>;
  const bars = costBars(candidates);
  return (
    <div className="pw-cuts">
      <Scroll label="Candidate cuts">
      <table className="pw-cuts__table">
        <caption className="pw-visually-hidden">Candidate cuts, each verified on a temporary copy of the graph</caption>
        <thead>
          <tr>
            <th scope="col">Candidate</th>
            <th scope="col">Cost</th>
            <th scope="col">Flows</th>
            <th scope="col">Verified</th>
            <th scope="col">
              <span className="pw-visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => {
            const blocked = applyBlockedReason(c);
            const isBest = best?.id === c.id;
            return (
              <tr key={c.id} className={isBest ? "pw-cuts__row pw-cuts__row--best" : "pw-cuts__row"}>
                <td data-label="Candidate">
                  <strong>
                    {c.id} · {c.name}
                  </strong>
                  {isBest && <span className="pw-cuts__best">Cheapest verified</span>}
                  {c.description && <p className="pw-muted">{c.description}</p>}
                  <p className="pw-cuts__caps">
                    Revokes: <code>{c.cap_ids.join(", ") || "nothing"}</code>
                  </p>
                </td>
                <td data-label="Cost">
                  <span className="pw-cuts__bar" aria-hidden="true">
                    <span style={{ width: `${bars.get(c.id) ?? 0}%` }} />
                  </span>
                  <strong>{c.total_cost}</strong> <span className="pw-muted">max flow {c.max_flow}</span>
                </td>
                <td data-label="Flows">{c.cap_ids.length}</td>
                <td data-label="Verified">
                  {c.verified ? (
                    <span className="pw-status pw-status--allow">
                      <Icon name="check" size={14} />
                      <span>VERIFIED</span>
                    </span>
                  ) : (
                    <span className="pw-status pw-status--block">
                      <Icon name="block" size={14} />
                      <span>NOT VERIFIED</span>
                    </span>
                  )}
                </td>
                <td data-label="Actions">
                  <div className="pw-cuts__actions">
                    <Button size="sm" aria-pressed={preview === c.id} onClick={() => onPreview(preview === c.id ? null : c.id)}>
                      {preview === c.id ? "Hide cut" : "Preview cut"}
                    </Button>
                    <Button size="sm" variant="danger" disabled={blocked !== null || busy} onClick={() => onApply(c)}>
                      Apply…
                    </Button>
                  </div>
                  {blocked && <p className="pw-cuts__why">{blocked}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </Scroll>
      {optimum && <p className="pw-muted">{optimum}</p>}
    </div>
  );
}
