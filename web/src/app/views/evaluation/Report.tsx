import type { EvalSummary } from "../../../api/types";
import { StatusPill } from "../../../shared/components/StatusPill";
import type { StatusFamily } from "../../../shared/lib/status";
import { criterionChip, defenseRows, familyCell, judgeNote, judgeSummary, pct, rateText, remediationRows, type CriterionChip } from "./evalLogic";

const CHIP_FAMILY: Record<CriterionChip, StatusFamily> = { triggered: "hold", "not triggered": "allow", "not evaluable": "neutral", met: "allow" };

/** The primary, accessible form of the chart: every defense with ASR and FHR as the rate, the interval and the counts. */
export function DefenseTable({ s }: { s: EvalSummary }) {
  return (
    <div className="pw-scroll">
      <table className="pw-etable">
        <caption className="pw-visually-hidden">Defenses with attack success rate and false hold rate</caption>
        <thead>
          <tr>
            <th scope="col">Defense</th>
            <th scope="col">ASR (lower is better)</th>
            <th scope="col">FHR (lower is better)</th>
          </tr>
        </thead>
        <tbody>
          {defenseRows(s).map((r) => {
            const note = judgeNote(s.llm_judges, r.name);
            return (
              <tr key={r.name} className={r.name === "PW" ? "pw-etable__pw" : undefined}>
                <th scope="row">
                  {r.name}
                  {note && <span className="pw-etable__note">{note}</span>}
                </th>
                {r.run && r.asr && r.fhr ? (
                  <>
                    <td>{rateText(r.asr)}</td>
                    <td>{rateText(r.fhr)}</td>
                  </>
                ) : (
                  <td colSpan={2} className="pw-muted">
                    not run
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function WitnessAccuracy({ s }: { s: EvalSummary }) {
  const w = s.witness_accuracy;
  return (
    <p>
      Witness accuracy (PW): <strong>{w.correct}/{w.n}</strong> ({pct(w.rate)}).
    </p>
  );
}

/** Each criterion as generated. A chip appears only when the generated text itself says triggered, not triggered, not evaluable or met. */
export function CriteriaList({ s }: { s: EvalSummary }) {
  return (
    <ul className="pw-criteria">
      {s.falsification_criteria.map((c) => {
        const chip = criterionChip(c.status);
        return (
          <li key={c.text}>
            <p className="pw-criteria__text">{c.text}</p>
            <p className="pw-criteria__status">
              {chip && <StatusPill status={chip.toUpperCase()} family={CHIP_FAMILY[chip]} />} <span>{c.status}</span>
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export function FamilyTable({ s }: { s: EvalSummary }) {
  const defenses = Object.keys(s.defenses);
  return (
    <div className="pw-scroll">
      <table className="pw-etable">
        <caption className="pw-visually-hidden">Results per scenario family and defense</caption>
        <thead>
          <tr>
            <th scope="col">Family</th>
            {defenses.map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.keys(s.per_family).map((family) => (
            <tr key={family}>
              <th scope="row">{family}</th>
              {defenses.map((d) => {
                const c = familyCell(s.per_family[family]?.[d]);
                return (
                  <td key={d} className={c.kind === "not_run" ? "pw-muted" : undefined}>
                    {c.text}
                    {c.kind !== "not_run" && (
                      <span className="pw-etable__bar" aria-hidden="true">
                        <span style={{ width: `${Math.round(c.fraction * 100)}%` }} />
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RemediationTable({ s }: { s: EvalSummary }) {
  const rows = remediationRows(s.remediation);
  if (rows.length === 0) return null;
  return (
    <div className="pw-scroll">
      <table className="pw-etable">
        <caption className="pw-visually-hidden">Remediation candidates against the exhaustive optimum</caption>
        <thead>
          <tr>
            <th scope="col">Topology</th>
            <th scope="col">Candidates (cost)</th>
            <th scope="col">Best</th>
            <th scope="col">Optimum</th>
            <th scope="col">Gap</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.topology}>
              <th scope="row">{r.topology}</th>
              <td>{r.candidates}</td>
              <td>{r.best}</td>
              <td>{r.optimum}</td>
              <td>{r.gap}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function JudgeMeta({ s }: { s: EvalSummary }) {
  if (!s.llm_judges) return null;
  return (
    <ul className="pw-prose-list">
      {judgeSummary(s.llm_judges).map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}

export function Limitations({ s }: { s: EvalSummary }) {
  return (
    <ul className="pw-prose-list">
      {s.limitations.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  );
}
