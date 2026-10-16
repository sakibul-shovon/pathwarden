import { describe, expect, it } from "vitest";
import type { ApplyResult, Candidate, CapNode, RemediationSummary } from "../../../api/types";
import { agentRows, appliedSentence, applyBlockedReason, cheapestVerified, costBars, optimumSentence, pathText, reviewRows, revokeLabel, toxicCount, witnessRows } from "./remediateLogic";

const cand = (over: Partial<Candidate> & { id: string }): Candidate => ({
  name: "cut", cap_ids: ["a->b"], edges: [{ cap_id: "a->b", src: "a", dst: "b", cost: 3 }], total_cost: 3, max_flow: 3, invalid_reason: null, needs_cut: true, verified: true, description: "", ...over,
});

describe("cheapestVerified", () => {
  it("takes the lowest cost among the verified candidates, ignoring a cheaper one that failed verification", () => {
    const list = [cand({ id: "C1", total_cost: 17 }), cand({ id: "C2", total_cost: 9, verified: false, invalid_reason: "toxic agent remains" }), cand({ id: "C3", total_cost: 16 })];
    expect(cheapestVerified(list)?.id).toBe("C3");
  });

  it("goes to the first candidate on a tie, in the order the API returned them, and does not reorder its input", () => {
    const list = [cand({ id: "C1", total_cost: 5 }), cand({ id: "C2", total_cost: 5 })];
    expect(cheapestVerified(list)?.id).toBe("C1");
    expect(list.map((c) => c.id)).toEqual(["C1", "C2"]);
  });

  it("is undefined when nothing was verified or nothing was returned", () => {
    expect(cheapestVerified([cand({ id: "C1", verified: false })])).toBeUndefined();
    expect(cheapestVerified([])).toBeUndefined();
  });
});

describe("applyBlockedReason", () => {
  it("lets a verified candidate that needs a cut through", () => {
    expect(applyBlockedReason(cand({ id: "C1" }))).toBeNull();
  });

  it("says why in words: the API's reason when it was not verified, or that no agent is toxic", () => {
    expect(applyBlockedReason(cand({ id: "C1", verified: false, invalid_reason: "toxic agent remains: billing_agent" }))).toBe("Not verified: toxic agent remains: billing_agent");
    expect(applyBlockedReason(cand({ id: "C1", verified: false }))).toBe("Not verified on the temporary copy.");
    expect(applyBlockedReason(cand({ id: "C1", needs_cut: false }))).toBe("Nothing to cut: no agent is toxic.");
  });
});

describe("costBars", () => {
  it("scales to the dearest candidate and keeps a visible sliver for a cheap one", () => {
    const bars = costBars([cand({ id: "C1", total_cost: 20 }), cand({ id: "C2", total_cost: 10 }), cand({ id: "C3", total_cost: 0 })]);
    expect(bars.get("C1")).toBe(100);
    expect(bars.get("C2")).toBe(50);
    expect(bars.get("C3")).toBe(4);
  });

  it("is all zero when every cost is zero, and empty without candidates", () => {
    expect([...costBars([cand({ id: "C1", total_cost: 0 })]).values()]).toEqual([0]);
    expect(costBars([]).size).toBe(0);
  });
});

describe("optimumSentence", () => {
  const opt = (over: Partial<RemediationSummary>): RemediationSummary => ({ best_candidate_cost: 16, optimum_cost: 14, gap: 2, optimum_cap_ids: [], toxic_agents_before: [], candidates: [], ...over });

  it("names the gap when a cheaper mixed cut exists, and says the candidate is optimal otherwise", () => {
    expect(optimumSentence(opt({}))).toBe("Exhaustive optimum from the last make eval: 14; best candidate 16. A cheaper mixed cut exists that no single candidate finds (gap 2).");
    expect(optimumSentence(opt({ gap: 0, optimum_cost: 16 }))).toContain("The best candidate is optimal.");
    expect(optimumSentence(opt({ gap: null, optimum_cost: 16 }))).toContain("The best candidate is optimal.");
  });

  it("says no optimum was computed instead of inventing one, and nothing when there is no summary", () => {
    expect(optimumSentence(opt({ optimum_cost: null, gap: null }))).toContain("no exhaustive optimum was computed");
    expect(optimumSentence(undefined)).toBeNull();
  });
});

describe("result and review wording", () => {
  const applied: ApplyResult = { topology: "enterprise12", cap_ids: ["a->b", "c->d"], revoked: 2, toxic_before: ["billing", "hr"], toxic_after: [] };

  it("reports the revoked flows and the toxic agents before and after, from the API's lists", () => {
    expect(appliedSentence(applied)).toBe("Revoked 2 flows. Toxic agents before: 2 (billing, hr) · after: 0 (none).");
    expect(appliedSentence({ ...applied, revoked: 1, toxic_before: ["x"] })).toContain("Revoked 1 flow.");
  });

  it("lists every flow the cut would revoke with its cost, and names the button by the count", () => {
    const c = cand({ id: "C3", cap_ids: ["a->b", "c->d"], edges: [{ cap_id: "a->b", src: "a", dst: "b", cost: 3 }, { cap_id: "c->d", src: "c", dst: "d", cost: 5 }] });
    expect(reviewRows(c).map((r) => r.text)).toEqual(["a → b (cost 3)", "c → d (cost 5)"]);
    expect(revokeLabel(c)).toBe("Revoke 2 flows");
    expect(revokeLabel(cand({ id: "C1" }))).toBe("Revoke 1 flow");
  });

  it("counts toxic agents with the right plural", () => {
    expect(toxicCount({ topology: "t", nodes: [], edges: [], toxic_agents: ["a"] })).toBe("1 toxic agent");
    expect(toxicCount({ topology: "t", nodes: [], edges: [], toxic_agents: [] })).toBe("0 toxic agents");
  });
});

describe("agent inspector and table", () => {
  it("words the three reachability paths of an agent and writes a path on one line", () => {
    const rows = witnessRows({ agent: "billing", toxic: true, from_untrusted: ["inbox", "billing"], from_secret: [], to_external: ["billing", "mail"] });
    expect(rows.map((r) => r.label)).toEqual(["Receives untrusted data from", "Receives secrets from", "Can reach outside through"]);
    expect(pathText(rows[0]!.path)).toBe("inbox → billing");
    expect(pathText(rows[1]!.path)).toBe("none");
  });

  it("gives every node a row, with the toxic flag as a word for agents only", () => {
    const nodes: CapNode[] = [
      { name: "inbox", kind: "source", trust: "untrusted", external: null, toxic: false },
      { name: "billing", kind: "agent", trust: null, external: null, toxic: true },
      { name: "audit", kind: "agent", trust: null, external: null, toxic: false },
      { name: "mail", kind: "sink", trust: null, external: true, toxic: false },
    ];
    expect(agentRows(nodes)).toEqual([
      { name: "inbox", kind: "source", trust: "untrusted", external: "", toxic: "" },
      { name: "billing", kind: "agent", trust: "", external: "", toxic: "TOXIC" },
      { name: "audit", kind: "agent", trust: "", external: "", toxic: "not toxic" },
      { name: "mail", kind: "sink", trust: "", external: "external", toxic: "" },
    ]);
  });
});
