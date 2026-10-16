import type { EvalSummary } from "../../api/types";
import { defenseRows } from "../../app/views/evaluation/evalLogic";
import { IntervalChart } from "../../app/views/evaluation/IntervalChart";
import { CriteriaList, DefenseTable, Limitations, WitnessAccuracy } from "../../app/views/evaluation/Report";
import { resultsTitle } from "../landingLogic";
import { Section } from "./Section";

/** Honest evidence: the generated chart and table, the criteria with their generated status (a triggered criterion shows as triggered), and the limitations verbatim. */
export function Results({ summary }: { summary: EvalSummary }) {
  const j = summary.llm_judges;
  return (
    <Section
      id="results"
      eyebrow="Results"
      title={resultsTitle(summary)}
      lead={
        <p>
          ASR is attacks released over attacks; FHR is benign actions held or blocked over benign actions; the interval is the Wilson 95% interval. Every number below is read from{" "}
          <code>eval/results/summary.json</code>, which <code>make eval</code> writes.
        </p>
      }
    >
      <IntervalChart rows={defenseRows(summary)} />
      <DefenseTable s={summary} />
      <WitnessAccuracy s={summary} />
      {j && (
        <p className="pw-muted pw-prose">
          B1 and B3 are LLM judges ({j.model}, temperature {j.temperature}). A model&apos;s answers can differ between runs, so those two rows are a recorded measurement, not a deterministic one.
        </p>
      )}
      <h3 className="pw-lsec__sub">Falsification criteria</h3>
      <CriteriaList s={summary} />
      <h3 className="pw-lsec__sub">Limitations</h3>
      <Limitations s={summary} />
    </Section>
  );
}
