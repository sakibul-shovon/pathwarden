import { describe, expect, it } from "vitest";
import type { EvalSummary, LlmJudgesSummary, Proportion } from "../../../api/types";
import { CHART, chartHeight, criterionChip, defenseRows, familyCell, intervalMarks, judgeNote, judgeSummary, pct, rateText, remediationRows } from "./evalLogic";

const prop = (k: number, n: number, lo: number, hi: number): Proportion => ({ k, n, rate: k / n, lo, hi });
const summary = (): EvalSummary => ({
  dataset: { seed: 1, scenarios: 120, attacks: 60, benign: 60, families: {} },
  defenses: {
    B0: { status: "run", asr: prop(60, 60, 0.94, 1), fhr: prop(0, 60, 0, 0.06) },
    PW: { status: "run", asr: prop(0, 60, 0, 0.06), fhr: prop(0, 60, 0, 0.06) },
    B5: { status: "not_run" },
  },
  per_family: {},
  witness_accuracy: { n: 60, correct: 60, rate: 1 },
  falsification_criteria: [],
  limitations: [],
});

describe("formatting", () => {
  it("writes a rate with one decimal and its interval and counts", () => {
    expect(pct(0.16666)).toBe("16.7%");
    expect(rateText(prop(24, 60, 0.2857, 0.5263))).toBe("40.0% [28.6%, 52.6%] (24/60)");
    expect(rateText(prop(0, 60, 0, 0.0602))).toBe("0.0% [0.0%, 6.0%] (0/60)");
  });
});

describe("defenseRows", () => {
  it("keeps the order of the file and says a defense was not run without giving a reason", () => {
    const rows = defenseRows(summary());
    expect(rows.map((r) => r.name)).toEqual(["B0", "PW", "B5"]);
    expect(rows.map((r) => r.run)).toEqual([true, true, false]);
    expect(rows[2]).toEqual({ name: "B5", run: false, asr: null, fhr: null });
  });
});

describe("intervalMarks", () => {
  const rows = defenseRows(summary());

  it("places the dot and both ends of the interval on a 0-100% scale, one row per defense", () => {
    const marks = intervalMarks(rows, "asr");
    expect(marks).toHaveLength(3);
    const b0 = marks[0]!;
    expect(b0.x?.rate).toBeCloseTo(CHART.label + CHART.plot);
    expect(b0.x?.lo).toBeCloseTo(CHART.label + 0.94 * CHART.plot);
    expect(marks[1]!.x?.rate).toBeCloseTo(CHART.label);
    expect(marks[1]!.y - marks[0]!.y).toBe(CHART.row);
  });

  it("describes every mark in words, including one that was not run", () => {
    const marks = intervalMarks(rows, "fhr");
    expect(marks[0]!.text).toBe("B0 FHR: 0.0% [0.0%, 6.0%] (0/60)");
    expect(marks[2]!.text).toBe("B5 FHR: not run");
    expect(marks[2]!.x).toBeNull();
  });

  it("keeps a value outside 0-1 on the plot, and sizes the chart to its rows", () => {
    const odd = intervalMarks([{ name: "X", run: true, asr: { k: 1, n: 1, rate: 1.0000000002, lo: -0.1, hi: 1.2 }, fhr: null }], "asr")[0]!;
    expect(odd.x!.hi).toBeLessThanOrEqual(CHART.label + CHART.plot);
    expect(odd.x!.lo).toBeGreaterThanOrEqual(CHART.label);
    expect(chartHeight(3)).toBe(CHART.top + 3 * CHART.row + CHART.bottom);
  });
});

describe("criterionChip (explicit keywords of the generated status only)", () => {
  it.each([
    ["PW FHR = 0.0%: not triggered", "not triggered"],
    ["the judges are UNAFFECTED by the disguises (criterion triggered: the claim is dropped)", "triggered"],
    ["criterion not evaluable on this dataset", "not evaluable"],
    ["The target was met", "met"],
  ])("reads %j as %j", (status, chip) => {
    expect(criterionChip(status)).toBe(chip);
  });

  it("gives no chip when no keyword is present, and never evaluates the criterion itself", () => {
    expect(criterionChip("B3 ASR = 0.0% and FHR = 40.0% against PW 0.0% and 0.0%: B3 does not match PW on both")).toBeNull();
    expect(criterionChip("B2 ASR = 100.0% on this dataset")).toBeNull();
    expect(criterionChip("")).toBeNull();
  });

  it("does not take part of a word for a keyword", () => {
    expect(criterionChip("the triggering condition was unmet")).toBeNull();
  });
});

describe("familyCell", () => {
  it("reads an attack family as released out of attacks, a benign one as held out of benign", () => {
    expect(familyCell({ attacks: 15, released: 4 })).toEqual({ kind: "attack", text: "4/15 released", fraction: 4 / 15 });
    expect(familyCell({ benign: 12, held: 0 })).toEqual({ kind: "benign", text: "0/12 held", fraction: 0 });
  });

  it("says not run generically for a missing cell or one marked not_run", () => {
    expect(familyCell(undefined)).toEqual({ kind: "not_run", text: "not run", fraction: 0 });
    expect(familyCell({ status: "not_run" })).toEqual({ kind: "not_run", text: "not run", fraction: 0 });
  });

  it("does not divide by zero", () => {
    expect(familyCell({ attacks: 0, released: 0 }).fraction).toBe(0);
    expect(familyCell({ benign: 0, held: 0 }).fraction).toBe(0);
  });
});

describe("judges and remediation", () => {
  const j: LlmJudgesSummary = { model: "groq/qwen/qwen3.8-27b", temperature: 0, calls: 240, prompt_tokens: 122914, completion_tokens: 10183, judgements: { B1: 120, B3: 120 }, invalid_json: { B1: 0, B3: 0 } };

  it("names the judge model and temperature next to B1 and B3 only", () => {
    expect(judgeNote(j, "B1")).toBe("LLM judge: groq/qwen/qwen3.8-27b, temperature 0");
    expect(judgeNote(j, "B3")).toContain("temperature 0");
    expect(judgeNote(j, "PW")).toBeNull();
    expect(judgeNote(null, "B1")).toBeNull();
    expect(judgeNote(undefined, "B1")).toBeNull();
  });

  it("summarises the judge metadata from the file", () => {
    expect(judgeSummary(j)).toEqual([
      "Model groq/qwen/qwen3.8-27b, temperature 0.",
      "240 calls (122914 prompt tokens, 10183 completion tokens).",
      "Judgements: B1 120, B3 120. Answers that were not valid JSON: B1 0, B3 0.",
    ]);
  });

  it("flattens the remediation rows and says plainly when no optimum was computed", () => {
    const rows = remediationRows({
      enterprise12: { best_candidate_cost: 16, optimum_cost: 14, gap: 2, optimum_cap_ids: [], toxic_agents_before: [], candidates: [{ id: "C1", total_cost: 17, flows: 4, verified: true }, { id: "C3", total_cost: 16, flows: 4, verified: true }] },
      big: { best_candidate_cost: 30, optimum_cost: null, gap: null, optimum_cap_ids: [], toxic_agents_before: [], candidates: [] },
    });
    expect(rows[0]).toEqual({ topology: "enterprise12", candidates: "C1=17, C3=16", best: 16, optimum: "14", gap: "2" });
    expect(rows[1]).toMatchObject({ optimum: "none (more than 6 edges)", gap: "—" });
    expect(remediationRows(undefined)).toEqual([]);
  });
});
