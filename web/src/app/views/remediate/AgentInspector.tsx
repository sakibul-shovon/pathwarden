import type { AgentWitness } from "../../../api/types";
import { StatusPill } from "../../../shared/components/StatusPill";
import { pathText, witnessRows } from "./remediateLogic";

interface AgentInspectorProps {
  selected: string | null;
  /** The witness of the selected agent; it may still be the previous agent's while the new one loads. */
  witness: AgentWitness | null;
}

/** Why an agent is (or is not) toxic: the three paths from the API's witness query (r7), each as one line of names. */
export function AgentInspector({ selected, witness }: AgentInspectorProps) {
  const ready = witness !== null && witness.agent === selected;
  return (
    <aside className="pw-inspector" aria-label="Agent inspector" aria-live="polite">
      {selected === null && <p className="pw-muted">Select an agent in the graph or the table to see why it is, or is not, toxic.</p>}
      {selected !== null && !ready && <p role="status">Loading the witness for {selected}…</p>}
      {selected !== null && ready && witness && (
        <>
          <h3 className="pw-inspector__title">
            <code>{witness.agent}</code>{" "}
            {witness.toxic ? <StatusPill status="TOXIC" family="hold" /> : <StatusPill status="not toxic" family="allow" />}
          </h3>
          <p className="pw-muted">
            An agent is toxic when it can receive untrusted data, can receive secrets and can reach an external sink.
          </p>
          <dl className="pw-inspector__paths">
            {witnessRows(witness).map((r) => (
              <div key={r.label}>
                <dt>{r.label}</dt>
                <dd className={r.path.length === 0 ? "pw-muted" : undefined}>{pathText(r.path)}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </aside>
  );
}
