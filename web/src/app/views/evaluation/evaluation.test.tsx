import { existsSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EvalSummary } from "../../../api/types";
import { defenseRows, intervalMarks, remediationRows } from "./evalLogic";
import { IntervalChart } from "./IntervalChart";
import { CriteriaList, DefenseTable, FamilyTable, JudgeMeta, Limitations, RemediationTable, WitnessAccuracy } from "./Report";

const decode = (s: string): string => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const text = (html: string): string => decode(html.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
const p = (k: number, n: number, lo: number, hi: number) => ({ k, n, rate: k / n, lo, hi });

const summary: EvalSummary = {
  dataset: { seed: 7, scenarios: 120, attacks: 60, benign: 60, families: { "ATK-sleeper": 15 } },
  defenses: {
    B0: { status: "run", asr: p(60, 60, 0.94, 1), fhr: p(0, 60, 0, 0.06) },
    B1: { status: "run", asr: p(0, 60, 0, 0.06), fhr: p(24, 60, 0.286, 0.526) },
    PW: { status: "run", asr: p(0, 60, 0, 0.06), fhr: p(0, 60, 0, 0.06) },
    BX: { status: "not_run" },
  },
  per_family: {
    "ATK-sleeper": { B0: { attacks: 15, released: 15 }, B1: { attacks: 15, released: 0 }, PW: { attacks: 15, released: 0 }, BX: { status: "not_run" } },
    "BEN-clean": { B0: { benign: 12, held: 0 }, B1: { benign: 12, held: 5 } },
  },
  witness_accuracy: { n: 60, correct: 60, rate: 1 },
  falsification_criteria: [
    { text: "If PW's FHR exceeds 20%, the approach is too conservative.", status: "PW FHR = 0.0%: not triggered" },
    { text: "If B1/B3 are unaffected by disguises, drop the claim.", status: "B1 released 0/15 (criterion triggered: the claim is dropped)" },
    { text: "If B3 matches PW, drop the detection claim.", status: "B3 does not match PW on both" },
  ],
  limitations: ["Synthetic scenarios only.", "Judges are probabilistic."],
  remediation: { enterprise12: { best_candidate_cost: 16, optimum_cost: 14, gap: 2, optimum_cap_ids: [], toxic_agents_before: [], candidates: [{ id: "C1", total_cost: 17, flows: 4, verified: true }] } },
  llm_judges: { model: "m/x", temperature: 0, calls: 4, prompt_tokens: 10, completion_tokens: 5, judgements: { B1: 2, B3: 2 }, invalid_json: { B1: 0, B3: 0 } },
};

describe("DefenseTable", () => {
  const html = renderToStaticMarkup(<DefenseTable s={summary} />);

  it("is the primary form of the chart: every defense with rate, interval and counts", () => {
    expect(text(html)).toContain("0.0% [0.0%, 6.0%] (0/60)");
    expect(text(html)).toContain("100.0% [94.0%, 100.0%] (60/60)");
    expect(html).toContain("Defenses with attack success rate and false hold rate");
  });

  it("says not run generically, with no phase or reason written into the page", () => {
    expect(text(html)).toContain("BX not run");
    expect(text(html)).not.toMatch(/phase P8|needs the live LLM/i);
  });

  it("shows the judge model and temperature next to B1 only when the file has llm_judges", () => {
    expect(text(html)).toContain("B1 LLM judge: m/x, temperature 0");
    expect(text(html)).not.toContain("B0 LLM judge");
    const without = renderToStaticMarkup(<DefenseTable s={{ ...summary, llm_judges: null }} />);
    expect(text(without)).not.toContain("LLM judge");
  });

  it("marks the PW row", () => {
    expect(html).toContain('class="pw-etable__pw"');
  });
});

describe("CriteriaList", () => {
  const html = renderToStaticMarkup(<CriteriaList s={summary} />);

  it("shows the generated status string in full for every criterion", () => {
    for (const c of summary.falsification_criteria) expect(text(html)).toContain(c.status);
  });

  it("adds a chip only where the string itself says triggered or not triggered", () => {
    expect(html.match(/pw-status /g)).toHaveLength(2);
    expect(text(html)).toContain("NOT TRIGGERED");
    expect(html).toContain("pw-status--hold");
    expect(html).toContain("pw-status--allow");
  });
});

describe("FamilyTable", () => {
  const html = renderToStaticMarkup(<FamilyTable s={summary} />);

  it("reads attack rows as released and benign rows as held, with a tiny bar for each", () => {
    expect(text(html)).toContain("15/15 released");
    expect(text(html)).toContain("5/12 held");
    expect(html.match(/pw-etable__bar/g)?.length).toBeGreaterThan(0);
  });

  it("says not run for a missing or not-run cell", () => {
    expect(text(html)).toContain("not run");
  });
});

describe("the other sections", () => {
  it("states witness accuracy from the file", () => {
    expect(text(renderToStaticMarkup(<WitnessAccuracy s={summary} />))).toContain("60/60 (100.0%)");
  });

  it("lists the limitations as written and the judge metadata", () => {
    expect(text(renderToStaticMarkup(<Limitations s={summary} />))).toContain("Synthetic scenarios only. Judges are probabilistic.");
    expect(text(renderToStaticMarkup(<JudgeMeta s={summary} />))).toContain("Model m/x, temperature 0.");
    expect(renderToStaticMarkup(<JudgeMeta s={{ ...summary, llm_judges: undefined }} />)).toBe("");
  });

  it("shows the remediation optimum and gap, and nothing without remediation data", () => {
    expect(text(renderToStaticMarkup(<RemediationTable s={summary} />))).toContain("enterprise12 C1=17 16 14 2");
    expect(renderToStaticMarkup(<RemediationTable s={{ ...summary, remediation: undefined }} />)).toBe("");
  });
});

describe("IntervalChart", () => {
  const html = renderToStaticMarkup(<IntervalChart rows={defenseRows(summary)} />);

  it("is two small multiples, each an image with a title and a description naming every value", () => {
    expect(html.match(/<svg /g)).toHaveLength(2);
    expect(html.match(/role="img" aria-labelledby/g)).toHaveLength(2);
    expect(html).toContain("<desc");
    expect(text(html)).toContain("B1 FHR: 40.0% [28.6%, 52.6%] (24/60)");
    expect(text(html)).toContain("BX ASR: not run");
  });

  it("makes each row focusable with its numbers as the accessible name", () => {
    expect(html).toContain('tabindex="0"');
    expect(html).toContain('aria-label="PW ASR: 0.0% [0.0%, 6.0%] (0/60)"');
  });

  it("draws the proposed defense as a different shape, not only a different colour", () => {
    expect(html).toContain("pw-chart__dot--pw");
    expect(html).toContain("<circle");
    expect(html).toContain("<rect");
  });
});

describe("the real summary.json", () => {
  const path = new URL("../../../../../eval/results/summary.json", import.meta.url);

  it.skipIf(!existsSync(path))("matches the shape the report reads: every section renders from it without throwing", () => {
    const real = JSON.parse(readFileSync(path, "utf8")) as EvalSummary;
    const rows = defenseRows(real);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.run)).toBe(true);
    for (const which of ["asr", "fhr"] as const) {
      for (const m of intervalMarks(rows, which)) {
        if (m.x) {
          expect(m.x.lo).toBeLessThanOrEqual(m.x.rate + 1e-6);
          expect(m.x.rate).toBeLessThanOrEqual(m.x.hi + 1e-6);
        }
      }
    }
    for (const part of [DefenseTable, CriteriaList, FamilyTable, RemediationTable, Limitations, WitnessAccuracy, JudgeMeta]) {
      expect(() => renderToStaticMarkup(<>{part({ s: real })}</>)).not.toThrow();
    }
    expect(remediationRows(real.remediation).length).toBe(Object.keys(real.remediation ?? {}).length);
    if (real.llm_judges) {
      expect(typeof real.llm_judges.model).toBe("string");
      expect(typeof real.llm_judges.temperature).toBe("number");
    }
  });

  it("reads the criteria exactly as generated: no chip is invented for a string without a keyword", () => {
    if (!existsSync(path)) return;
    const real = JSON.parse(readFileSync(path, "utf8")) as EvalSummary;
    const html = renderToStaticMarkup(<CriteriaList s={real} />);
    for (const c of real.falsification_criteria) expect(text(html)).toContain(c.status);
  });
});
