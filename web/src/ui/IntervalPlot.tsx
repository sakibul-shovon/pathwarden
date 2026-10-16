import { m, useReducedMotion } from "motion/react";
import type { DefenseSummary, EvalSummary } from "../api/types";

/** Display names for the defenses of plan §20.3. Only the label lives here; every number is the API's. */
export const DEFENSES: { id: string; label: string }[] = [
  { id: "B0", label: "No defense" },
  { id: "B1", label: "Per-action LLM judge" },
  { id: "B2", label: "Per-session Rule of Two" },
  { id: "B3", label: "Full-trace LLM judge" },
  { id: "B4", label: "DLP scanner" },
  { id: "PW-coarse", label: "Pathwarden, coarse ablation" },
  { id: "PW", label: "Pathwarden" },
];

export const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

type Run = Extract<DefenseSummary, { status: "run" }>;
type Pick = (d: Run) => { rate: number; lo: number; hi: number; k: number; n: number };

/** Dot (rate) and whisker (Wilson 95% interval) per defense on a 0-100% axis. Lower is better.
 *  Defenses that were not run are listed, not hidden. */
export function IntervalPlot({ title, pick, defenses }: { title: string; pick: Pick; defenses: EvalSummary["defenses"] }) {
  const reduce = useReducedMotion();
  return (
    <div className="plot">
      <h3>{title}</h3>
      <ul>
        {DEFENSES.map(({ id, label }) => {
          const d = defenses[id];
          if (!d) return null;
          if (d.status !== "run") {
            return (
              <li key={id} className="plot-notrun">
                <span className="plot-name">{label}</span>
                <span className="plot-track plot-hatch" aria-hidden="true" />
                <span className="plot-val muted">not run</span>
              </li>
            );
          }
          const p = pick(d);
          return (
            <li key={id} className={id === "PW" ? "me" : undefined}>
              <span className="plot-name">{label}</span>
              <span className="plot-track" role="img" aria-label={`${label}: ${pct(p.rate)}, interval ${pct(p.lo)} to ${pct(p.hi)}`}>
                <span className="plot-whisk" style={{ left: `${p.lo * 100}%`, width: `${Math.max((p.hi - p.lo) * 100, 0.4)}%` }} />
                <m.span
                  className="plot-dot"
                  initial={reduce ? false : { left: "0%" }}
                  whileInView={{ left: `${p.rate * 100}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
                  style={reduce ? { left: `${p.rate * 100}%` } : undefined}
                />
              </span>
              <span className="plot-val">{pct(p.rate)} <small>({p.k}/{p.n})</small></span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
