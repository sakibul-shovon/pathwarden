import type { EvalSummary } from "../../api/types";
import { remediationLines } from "../landingLogic";
import { Section } from "./Section";
import { Scroll } from "../../shared/components/Scroll";

/** Prevention: the numbers are the generated remediation table, and the "cheaper mixed cut" sentence appears only where the file's gap is above zero. */
export function Remediate({ summary }: { summary: EvalSummary }) {
  const lines = remediationLines(summary);
  const gaps = lines.filter((l) => l.sentence);
  return (
    <Section
      id="remediate"
      eyebrow="Before the next one"
      title="Remove the permission, not just the post"
      lead={
        <p>
          An agent is <em>toxic</em> when it can receive untrusted data, can receive secrets and can reach an external sink. Four candidate cuts are each a complete fix by construction,
          computed with FalkorDB&apos;s <code>algo.maxFlow</code> and verified on a temporary copy of the graph.
        </p>
      }
    >
      {lines.length > 0 && (
        <Scroll label="Remediation candidates">
          <table className="pw-etable">
            <caption className="pw-visually-hidden">Remediation candidates against the exhaustive optimum, from the generated evaluation</caption>
            <thead>
              <tr>
                <th scope="col">Topology</th>
                <th scope="col">Toxic agents</th>
                <th scope="col">Candidate costs</th>
                <th scope="col">Best candidate</th>
                <th scope="col">Exhaustive optimum</th>
                <th scope="col">Gap</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.topology}>
                  <th scope="row">{l.topology}</th>
                  <td>{l.toxic}</td>
                  <td>{l.candidates}</td>
                  <td>{l.best}</td>
                  <td>{l.optimum}</td>
                  <td>{l.gap ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Scroll>
      )}
      {gaps.map((g) => (
        <p key={g.topology} className="pw-prose">
          {g.sentence}
        </p>
      ))}
      <p className="pw-muted">Numbers from the last <code>make eval</code> (<code>eval/results/summary.json</code>).</p>
    </Section>
  );
}
