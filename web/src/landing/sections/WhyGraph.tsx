import { CodeBlock } from "../../shared/components/CodeBlock";
import { GRAPH_MODEL, Q2A, Q2B, README } from "../landingData";
import { parseReasons, parseSchema } from "../landingLogic";
import { Section } from "./Section";

/** Technical credibility: the reasons come from the README, the schema from docs/graph-model.md and the two queries from the `.cypher` files, all read at build time. */
export function WhyGraph() {
  const reasons = parseReasons(README);
  const schema = parseSchema(GRAPH_MODEL);
  return (
    <Section id="graph" eyebrow="Why a graph database" title="The proof is a path, so the store has to answer path questions">
      <ul className="pw-reasons">
        {reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <figure className="pw-fig">
        <div className="pw-fig__plate pw-schema">
          <p className="pw-eyebrow">Node labels</p>
          <ul className="pw-schema__nodes" aria-label="Node labels">
            {schema.nodes.map((n) => (
              <li key={n}>
                <code>{n}</code>
              </li>
            ))}
          </ul>
          <p className="pw-eyebrow">Relationship types</p>
          <ul className="pw-schema__rels" aria-label="Relationship types">
            {schema.relations.map((r) => (
              <li key={`${r.from}-${r.rel}-${r.to}`}>
                <code>{r.from}</code> <span aria-hidden="true">—</span>
                <code className="pw-schema__rel">{r.rel}</code>
                <span aria-hidden="true">→</span> <code>{r.to}</code>
              </li>
            ))}
          </ul>
        </div>
        <figcaption className="pw-fig__caption">
          The lineage graph: {schema.nodes.length} node labels and {schema.relations.length} relationship types, read from <code>docs/graph-model.md</code>.
        </figcaption>
      </figure>

      <details className="pw-queries">
        <summary>Show the Cypher</summary>
        <p className="pw-muted">
          The two queries the gate runs. Paste one into the{" "}
          <a href="https://docs.falkordb.com/browser/" target="_blank" rel="noreferrer noopener">
            FalkorDB Browser ↗
          </a>{" "}
          with the parameters of an action to run it yourself.
        </p>
        <h3 className="pw-lsec__sub">q2a_untrusted_witness</h3>
        <CodeBlock code={Q2A} label="q2a_untrusted_witness" />
        <h3 className="pw-lsec__sub">q2b_secret_witness</h3>
        <CodeBlock code={Q2B} label="q2b_secret_witness" />
      </details>
    </Section>
  );
}
