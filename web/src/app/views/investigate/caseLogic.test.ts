import { describe, expect, it } from "vitest";
import type { ActionListItem, ForensicReport, LaunderingMemory, LineageNode } from "../../../api/types";
import { canRelease, carryingMemory, diffLines, forensicSteps, initialSelection, needsDecision, nodeLabel, queueGroups, stepCount, verdictsDiffer, whySentence, witnessSteps, type WhyInput } from "./caseLogic";

const node = (over: Partial<LineageNode> & { id: string }): LineageNode => ({
  label: "Artifact", kind: null, trust: null, sanitized: null, approved: null, quarantined: null, agent_id: null, session_id: null, key: null, created_at: null, ...over,
});
const nodes: LineageNode[] = [
  node({ id: "a-0010", kind: "draft", key: "changelog:42", agent_id: "fixer" }),
  node({ id: "a-0004", kind: "memory", key: "team_convention:42", agent_id: "triage" }),
  node({ id: "a-0001", kind: "raw", agent_id: "triage", quarantined: true }),
  node({ id: "a-0002", kind: "sanitized", key: "task:42", sanitized: true }),
  node({ id: "src:issue:42", label: "Source", trust: "untrusted" }),
  node({ id: "src:env:DEPLOY_TOKEN", label: "Source", trust: "secret" }),
];
const memory = (id: string, key: string, by = "triage", on = "Mon"): LaunderingMemory => ({ memory_id: id, memory_key: key, written_in_session: "s-0001", written_by: by, written_on: on, untrusted_source: "src:issue:42" });
const U = ["a-0010", "a-0004", "a-0001", "src:issue:42"];
const S = ["a-0010", "a-0008", "src:env:DEPLOY_TOKEN"];
const why = (over: Partial<WhyInput> = {}): WhyInput => ({
  reason: "TRIFECTA", status: "held", untrustedWitness: U, secretWitness: S, quarantinedAncestors: [], payloadId: "a-0010", nodes, laundering: [memory("a-0004", "team_convention:42")], ...over,
});

describe("queue", () => {
  const actions: ActionListItem[] = [
    { id: "act-0001", status: "superseded", payload_id: "a-0010" },
    { id: "act-0002", status: "held", payload_id: "a-0020" },
    { id: "act-0003", status: "blocked", payload_id: "a-0030" },
    { id: "act-0004", status: "executed", payload_id: "a-0040" },
  ];

  it("splits held and blocked from everything else, keeping the order", () => {
    const g = queueGroups(actions);
    expect(g.needs.map((a) => a.id)).toEqual(["act-0002", "act-0003"]);
    expect(g.resolved.map((a) => a.id)).toEqual(["act-0001", "act-0004"]);
    expect(needsDecision("held") && needsDecision("blocked") && !needsDecision("executed")).toBe(true);
  });

  it("opens the requested action, else the first that needs a decision, else the first", () => {
    expect(initialSelection(actions, "act-0004")).toBe("act-0004");
    expect(initialSelection(actions, "act-9999")).toBe("act-0002");
    expect(initialSelection(actions, null)).toBe("act-0002");
    expect(initialSelection([actions[3] as ActionListItem], null)).toBe("act-0004");
    expect(initialSelection([], "act-0001")).toBeNull();
  });
});

describe("labels", () => {
  it("names an artifact by its key, then its kind, then its id, and a source by its id", () => {
    expect(nodeLabel(nodes, "a-0004")).toBe("team_convention:42");
    expect(nodeLabel(nodes, "a-0001")).toBe("raw");
    expect(nodeLabel(nodes, "a-9999")).toBe("a-9999");
    expect(nodeLabel(nodes, "src:issue:42")).toBe("src:issue:42");
  });

  it("counts the steps of a path, never negative", () => {
    expect(stepCount(U)).toBe(3);
    expect(stepCount(["a"])).toBe(0);
    expect(stepCount([])).toBe(0);
  });
});

describe("whySentence", () => {
  it("names the payload, both sources, the step counts, and the memory that carried the instruction", () => {
    expect(whySentence(why())).toBe(
      "changelog:42 descends from src:issue:42 through 3 steps, via team_convention:42 (written by triage on Mon) and from src:env:DEPLOY_TOKEN through 2 steps.",
    );
  });

  it("says how many other memories were involved", () => {
    const s = whySentence(why({ laundering: [memory("a-0004", "team_convention:42"), memory("a-0003", "issue_summary:42"), memory("a-0005", "x")] }));
    expect(s).toContain("and 2 more memories");
  });

  it("prefers the memory that is on the untrusted path", () => {
    const via = carryingMemory(U, [memory("a-0003", "issue_summary:42"), memory("a-0004", "team_convention:42")]);
    expect(via?.memory.memory_key).toBe("team_convention:42");
    expect(via?.others).toBe(1);
    expect(carryingMemory(U, [])).toBeNull();
  });

  it("omits the memory clause when no memory was involved and uses singular wording for one step", () => {
    const s = whySentence(why({ laundering: [], untrustedWitness: ["a-0010", "src:issue:42"] }));
    expect(s).toBe("changelog:42 descends from src:issue:42 through 1 step and from src:env:DEPLOY_TOKEN through 2 steps.");
  });

  it("does not claim a path it was not given", () => {
    expect(whySentence(why({ untrustedWitness: [] }))).toContain("reaches both an untrusted source and a secret");
  });

  it("says an executed action ran without the gate", () => {
    expect(whySentence(why({ status: "executed" }))).toContain("executed anyway: it ran without the gate");
  });

  it.each([
    ["QUARANTINED_LINEAGE", "Blocked: part of this payload's lineage is quarantined (a-0001, a-0003)."],
    ["MISSING_PROVENANCE", "Held: the payload or its target has no recorded provenance, so the gate fails closed."],
    ["SECRET_EGRESS_WARNING", "Allowed with a warning: the payload descends from a secret but from no untrusted input (a documented non-goal)."],
    ["CLEAN", "Allowed: the gate found no complete untrusted-and-secret pair of paths."],
  ])("has a fixed sentence for %s", (reason, sentence) => {
    expect(whySentence(why({ reason, quarantinedAncestors: ["a-0001", "a-0003"] }))).toBe(sentence);
  });

  it("returns null for an unknown reason so the raw code is shown", () => {
    expect(whySentence(why({ reason: "SOMETHING_NEW" }))).toBeNull();
  });
});

describe("verdictsDiffer: decided vs now", () => {
  it("agree for held + HOLD and executed + ALLOW", () => {
    expect(verdictsDiffer("held", "HOLD")).toBe(false);
    expect(verdictsDiffer("executed", "ALLOW")).toBe(false);
  });

  it("differ after forensics (held, now BLOCK) and for an action that ran without the gate (executed, now HOLD)", () => {
    expect(verdictsDiffer("held", "BLOCK")).toBe(true);
    expect(verdictsDiffer("executed", "HOLD")).toBe(true);
    expect(verdictsDiffer("superseded", "BLOCK")).toBe(true);
  });
});

describe("witnessSteps", () => {
  it("labels steps by key and tags them with kind, writer and day for a memory, and with the trust for a source", () => {
    const steps = witnessSteps(U, nodes, [memory("a-0004", "team_convention:42")]);
    expect(steps.map((s) => s.label)).toEqual(["changelog:42", "team_convention:42", "raw", "src:issue:42"]);
    expect(steps[1]?.tags).toEqual(["memory", "triage", "Mon"]);
    expect(steps[2]?.tags).toEqual(["raw", "triage", "quarantined"]);
    expect(steps[3]).toMatchObject({ isSource: true, tags: ["untrusted"] });
  });

  it("keeps an id the subgraph does not know instead of dropping it", () => {
    expect(witnessSteps(["a-9999"], nodes, [])).toEqual([{ id: "a-9999", label: "a-9999", isSource: false, tags: [] }]);
  });

  it("tags a sanitized artifact", () => {
    expect(witnessSteps(["a-0002"], nodes, [])[0]?.tags).toContain("sanitized");
  });
});

const report = (over: Partial<ForensicReport> = {}): ForensicReport => ({
  action_id: "act-0001",
  untrusted_source: "src:issue:42",
  laundering_memories: [{ memory_id: "a-0004", memory_key: "team_convention:42", written_by: "triage", written_in_session: "s-0001", written_on: "Mon" }],
  quarantine_id: "q-0001",
  quarantined_artifacts: ["a-0001", "a-0003", "a-0004", "a-0009", "a-0010"],
  affected_actions: ["act-0001"],
  sandbox: { graph: "pw_tinyqueue__sbx", new_action_id: "act-sbx-0001", verdict: "ALLOW", reason: "CLEAN" },
  diff: { held_payload_id: "a-0010", held_graph: "main", healed_payload_id: "a-sbx-0003", healed_graph: "sandbox" },
  recommendation: "APPROVE_HEALED_RELEASE",
  mode: "scripted",
  fallback_used: false,
  llm_calls: 0,
  ...over,
});

describe("forensicSteps", () => {
  it("reports each step of the plan from the report's own fields", () => {
    const steps = forensicSteps(report());
    expect(steps).toHaveLength(5);
    expect(steps[0]?.result).toBe("untrusted source src:issue:42");
    expect(steps[1]?.result).toBe("1 memory: team_convention:42");
    expect(steps[2]?.result).toBe("q-0001 covers 5 artifacts; affected actions: act-0001");
    expect(steps[3]?.result).toBe("pw_tinyqueue__sbx → act-sbx-0001");
    expect(steps[4]?.result).toBe("ALLOW · CLEAN");
  });

  it("says nothing new was quarantined on a repeated run", () => {
    expect(forensicSteps(report({ quarantine_id: null, quarantined_artifacts: [] }))[2]?.result).toBe("nothing new to quarantine");
  });

  it("marks the steps that were not reached when no untrusted source was found", () => {
    const steps = forensicSteps(report({ untrusted_source: "", laundering_memories: [], quarantine_id: null, sandbox: null, diff: null, recommendation: "ESCALATE_TO_HUMAN" }));
    expect(steps.map((s) => s.result)).toEqual([null, null, null, null, null]);
  });
});

describe("canRelease", () => {
  it("is offered only for a recommended report on an action still waiting for a decision", () => {
    expect(canRelease(report(), "held", false)).toBe(true);
    expect(canRelease(report(), "blocked", false)).toBe(true);
  });

  it("is not offered when escalating, after release, for a resolved action, or without a report", () => {
    expect(canRelease(report({ recommendation: "ESCALATE_TO_HUMAN" }), "held", false)).toBe(false);
    expect(canRelease(report(), "held", true)).toBe(false);
    expect(canRelease(report(), "superseded", false)).toBe(false);
    expect(canRelease(report(), "executed", false)).toBe(false);
    expect(canRelease(null, "held", false)).toBe(false);
  });
});

describe("diffLines", () => {
  it("marks lines that exist only on one side", () => {
    const held = "## Release notes\n- Fixed: x\n### Deployment diagnostics\nPORT=8080";
    const healed = "## Release notes\n- Fixed: x";
    const d = diffLines(held, healed);
    expect(d.held.map((l) => l.mark)).toEqual(["same", "same", "removed", "removed"]);
    expect(d.healed.map((l) => l.mark)).toEqual(["same", "same"]);
  });

  it("marks added lines on the healed side and keeps every line", () => {
    const d = diffLines("a\nb", "a\nc\nd");
    expect(d.healed.map((l) => l.mark)).toEqual(["same", "added", "added"]);
    expect(d.held).toHaveLength(2);
  });
});
