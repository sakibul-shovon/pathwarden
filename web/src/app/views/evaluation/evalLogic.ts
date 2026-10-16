import type { DefenseSummary, EvalSummary, LlmJudgesSummary, Proportion, RemediationSummary } from "../../../api/types";

/** Pure helpers for the Evaluation report (ui-redesign.md §13.9). Every number and sentence comes from `summary.json`, which
 *  `make eval` wrote; nothing here computes a rate, an interval or a criterion. The words only arrange what was generated. */

export const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

/** `0.0% [0.0%, 6.0%] (0/60)`: the rate, its Wilson 95% interval and the counts, as the tooltip and the table say them. */
export const rateText = (p: Proportion): string => `${pct(p.rate)} [${pct(p.lo)}, ${pct(p.hi)}] (${p.k}/${p.n})`;

export interface DefenseRow {
  name: string;
  run: boolean;
  asr: Proportion | null;
  fhr: Proportion | null;
}

/** The defenses in the order of the file. A defense that was not run says so generically ("not run"), never with a hard-coded reason. */
export function defenseRows(s: EvalSummary): DefenseRow[] {
  return Object.entries(s.defenses).map(([name, d]: [string, DefenseSummary]) => (d.status === "run" ? { name, run: true, asr: d.asr, fhr: d.fhr } : { name, run: false, asr: null, fhr: null }));
}

// ------------------------------------------------------------------ interval chart
export const CHART = { label: 92, plot: 220, right: 64, row: 26, top: 22, bottom: 20 } as const;
export const chartWidth = CHART.label + CHART.plot + CHART.right;
export const chartHeight = (rows: number): number => CHART.top + rows * CHART.row + CHART.bottom;

export interface IntervalMark {
  name: string;
  y: number;
  x: { lo: number; rate: number; hi: number } | null;
  /** The tooltip and the accessible text of the mark. */
  text: string;
}

const xOf = (rate: number): number => CHART.label + Math.min(1, Math.max(0, rate)) * CHART.plot;

/** One row per defense: the dot at the rate and the line from the lower to the upper end of the interval, on a 0–100% scale. */
export function intervalMarks(rows: DefenseRow[], which: "asr" | "fhr"): IntervalMark[] {
  return rows.map((r, i) => {
    const p = r[which];
    const y = CHART.top + i * CHART.row + CHART.row / 2;
    const label = which === "asr" ? "ASR" : "FHR";
    return p === null
      ? { name: r.name, y, x: null, text: `${r.name} ${label}: not run` }
      : { name: r.name, y, x: { lo: xOf(p.lo), rate: xOf(p.rate), hi: xOf(p.hi) }, text: `${r.name} ${label}: ${rateText(p)}` };
  });
}

export const CHART_TICKS = [0, 0.5, 1].map((v) => ({ label: `${v * 100}%`, x: xOf(v) }));

// ------------------------------------------------------------------ criteria
export type CriterionChip = "triggered" | "not triggered" | "not evaluable" | "met";

/** The chip is read from explicit keywords in the generated status string only; with none of them there is no chip and the string
 *  stands alone. The criterion is never evaluated here. */
export function criterionChip(status: string): CriterionChip | null {
  const t = status.toLowerCase();
  if (/\bnot evaluable\b/.test(t)) return "not evaluable";
  if (/\bnot triggered\b/.test(t)) return "not triggered";
  if (/\btriggered\b/.test(t)) return "triggered";
  if (/\bmet\b/.test(t)) return "met";
  return null;
}

// ------------------------------------------------------------------ per family
export interface FamilyCell {
  kind: "attack" | "benign" | "not_run";
  text: string;
  /** 0–1 for the tiny bar: the share released (attacks) or held (benign). */
  fraction: number;
}

type RawCell = NonNullable<EvalSummary["per_family"][string][string]>;

export function familyCell(cell: RawCell | undefined): FamilyCell {
  if (!cell || cell.status === "not_run") return { kind: "not_run", text: "not run", fraction: 0 };
  if (cell.attacks !== undefined) {
    const released = cell.released ?? 0;
    return { kind: "attack", text: `${released}/${cell.attacks} released`, fraction: cell.attacks === 0 ? 0 : released / cell.attacks };
  }
  const held = cell.held ?? 0;
  const benign = cell.benign ?? 0;
  return { kind: "benign", text: `${held}/${benign} held`, fraction: benign === 0 ? 0 : held / benign };
}

// ------------------------------------------------------------------ judges and remediation
/** Which model judged B1 and B3, from `llm_judges`; `null` when the file has none. */
export function judgeNote(j: LlmJudgesSummary | null | undefined, defense: string): string | null {
  if (!j || !(defense in j.judgements)) return null;
  return `LLM judge: ${j.model}, temperature ${j.temperature}`;
}

export function judgeSummary(j: LlmJudgesSummary): string[] {
  const per = (m: Record<string, number>): string =>
    Object.entries(m)
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
  return [
    `Model ${j.model}, temperature ${j.temperature}.`,
    `${j.calls} calls (${j.prompt_tokens} prompt tokens, ${j.completion_tokens} completion tokens).`,
    `Judgements: ${per(j.judgements)}. Answers that were not valid JSON: ${per(j.invalid_json)}.`,
  ];
}

export interface RemediationRow {
  topology: string;
  candidates: string;
  best: number;
  optimum: string;
  gap: string;
}

export function remediationRows(r: Record<string, RemediationSummary> | undefined): RemediationRow[] {
  return Object.entries(r ?? {}).map(([topology, x]) => ({
    topology,
    candidates: x.candidates.map((c) => `${c.id}=${c.total_cost}`).join(", "),
    best: x.best_candidate_cost,
    optimum: x.optimum_cost === null ? "none (more than 6 edges)" : String(x.optimum_cost),
    gap: x.gap === null ? "—" : String(x.gap),
  }));
}
