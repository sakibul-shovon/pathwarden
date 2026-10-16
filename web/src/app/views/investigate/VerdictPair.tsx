import type { ActionDetail } from "../../../api/types";
import { StatusPill } from "../../../shared/components/StatusPill";
import { Term } from "../../../shared/components/Term";
import { verdictsDiffer } from "./caseLogic";

/** "Decided" is the status recorded in the graph; "Gate now" is the verdict computed again when this page was opened. They
 *  are shown apart because they are different things: the original reason is not returned by the API, so it is never invented. */
export function VerdictPair({ action }: { action: ActionDetail }) {
  const g = action.gate;
  const differ = verdictsDiffer(action.status, g.verdict);
  return (
    <section className="pw-verdicts" aria-label="Verdict">
      <div className="pw-verdicts__pair">
        <div className="pw-verdicts__box">
          <p className="pw-eyebrow">Decided</p>
          <StatusPill status={action.status} />
          <p className="pw-muted pw-verdicts__note">The status recorded in the graph.</p>
        </div>
        <div className="pw-verdicts__box">
          <p className="pw-eyebrow">Gate now</p>
          <p className="pw-verdicts__now">
            <StatusPill status={g.verdict} />{" "}
            <strong className="pw-mono">{g.reason === "TRIFECTA" ? <Term term="trifecta">TRIFECTA</Term> : g.reason}</strong>
          </p>
          <p className="pw-muted pw-verdicts__note">
            Re-checked in {g.latency_ms.toFixed(1)} ms · {g.llm_calls} LLM calls
          </p>
        </div>
      </div>
      <dl className="pw-facts">
        <div>
          <dt>Target</dt>
          <dd>
            <code>{action.sink_id}</code> ({action.external ? "external" : "internal"})
          </dd>
        </div>
        <div>
          <dt>Payload</dt>
          <dd>
            <code>{action.payload_id}</code>
          </dd>
        </div>
      </dl>
      {differ && (
        <p className="pw-muted pw-prose">
          The two differ because the gate computes the verdict again every time this page opens: after forensics the payload&apos;s
          lineage is quarantined, so the gate would now block it, and an action that ran without the gate was never stopped.
        </p>
      )}
    </section>
  );
}
