import type { ActionListItem, ForensicReport, LaunderingMemory, LineageNode } from "../../../api/types";

/** Pure logic of the case file (ui-redesign.md §13.5): the one-sentence "why", the steps of a witness path, the
 *  forensic step list, the diff markers, the review queue. Everything is a function of what the API returned, and where the
 *  API did not say something (the reason recorded at decision time, the order of an LLM's tool calls) nothing is invented. */

// ------------------------------------------------------------------ queue
export const needsDecision = (status: string): boolean => status === "held" || status === "blocked";

export interface QueueGroups {
  needs: ActionListItem[];
  resolved: ActionListItem[];
}

/** "Needs a decision" = held or blocked; everything else (executed, allowed, superseded, rejected, proposed) is resolved. */
export function queueGroups(actions: ActionListItem[]): QueueGroups {
  return { needs: actions.filter((a) => needsDecision(a.status)), resolved: actions.filter((a) => !needsDecision(a.status)) };
}

/** The action to open: the one asked for in the URL, else the first that needs a decision, else the first, else none. */
export function initialSelection(actions: ActionListItem[], requested: string | null): string | null {
  if (requested !== null && actions.some((a) => a.id === requested)) return requested;
  return (actions.find((a) => needsDecision(a.status)) ?? actions[0])?.id ?? null;
}

// ------------------------------------------------------------------ labels
const byId = (nodes: LineageNode[], id: string): LineageNode | undefined => nodes.find((n) => n.id === id);

/** A node as people name it: the key of an artifact (`team_convention:42`), else its kind, else the id; a source is its id. */
export function nodeLabel(nodes: LineageNode[], id: string): string {
  const n = byId(nodes, id);
  if (!n) return id;
  if (n.label === "Source") return id;
  return n.key || n.kind || id;
}

/** Number of steps (edges) of a witness path given as its node ids. */
export const stepCount = (witness: string[]): number => Math.max(0, witness.length - 1);

// ------------------------------------------------------------------ why
export interface WhyInput {
  reason: string;
  /** The status recorded in the graph (`ActionDetail.status`), not the verdict computed now. */
  status: string;
  untrustedWitness: string[];
  secretWitness: string[];
  quarantinedAncestors: string[];
  payloadId: string;
  nodes: LineageNode[];
  laundering: LaunderingMemory[];
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The memory that carried the instruction: the first laundering memory on the untrusted path, else the first one. */
export function carryingMemory(untrusted: string[], laundering: LaunderingMemory[]): { memory: LaunderingMemory; others: number } | null {
  if (laundering.length === 0) return null;
  const onPath = laundering.find((m) => untrusted.includes(m.memory_id)) ?? laundering[0];
  return onPath ? { memory: onPath, others: laundering.length - 1 } : null;
}

/** One sentence, built only from the gate's own fields. An unknown reason returns null so the screen shows the raw code. */
export function whySentence(w: WhyInput): string | null {
  const payload = nodeLabel(w.nodes, w.payloadId);
  const executedAnyway = w.status === "executed" ? " It was executed anyway: it ran without the gate." : "";
  switch (w.reason) {
    case "TRIFECTA": {
      const u = w.untrustedWitness[w.untrustedWitness.length - 1];
      const s = w.secretWitness[w.secretWitness.length - 1];
      if (!u || !s) return `${payload} was held: its lineage reaches both an untrusted source and a secret.${executedAnyway}`;
      const via = carryingMemory(w.untrustedWitness, w.laundering);
      const viaText = via
        ? `, via ${via.memory.memory_key} (written by ${via.memory.written_by} on ${via.memory.written_on}${via.others > 0 ? `, and ${via.others} more ${via.others === 1 ? "memory" : "memories"}` : ""})`
        : "";
      return `${payload} descends from ${u} through ${plural(stepCount(w.untrustedWitness), "step", "steps")}${viaText} and from ${s} through ${plural(stepCount(w.secretWitness), "step", "steps")}.${executedAnyway}`;
    }
    case "QUARANTINED_LINEAGE":
      return `Blocked: part of this payload's lineage is quarantined (${w.quarantinedAncestors.join(", ") || "no ancestors listed"}).`;
    case "MISSING_PROVENANCE":
      return "Held: the payload or its target has no recorded provenance, so the gate fails closed.";
    case "SECRET_EGRESS_WARNING":
      return "Allowed with a warning: the payload descends from a secret but from no untrusted input (a documented non-goal).";
    case "CLEAN":
      return "Allowed: the gate found no complete untrusted-and-secret pair of paths.";
    default:
      return null;
  }
}

/** The verdict pair of the case: "decided" is the recorded status, "now" is the verdict computed again. They differ after
 *  forensics (the lineage is quarantined, so the gate now blocks) and for an action that ran without the gate. */
export function verdictsDiffer(status: string, verdict: string): boolean {
  const decided = status === "held" ? "HOLD" : status === "blocked" ? "BLOCK" : status === "executed" || status === "allowed" ? "ALLOW" : null;
  return decided === null || decided !== verdict;
}

// ------------------------------------------------------------------ witness path steps
export interface PathStep {
  id: string;
  label: string;
  isSource: boolean;
  /** Short facts: `memory`, `triage`, `Mon`, `sanitized`, `quarantined`, `approved`, `untrusted`/`secret`/`internal`. */
  tags: string[];
}

export function witnessSteps(witness: string[], nodes: LineageNode[], laundering: LaunderingMemory[]): PathStep[] {
  return witness.map((id) => {
    const n = byId(nodes, id);
    const tags: string[] = [];
    if (n?.label === "Source") {
      if (n.trust) tags.push(n.trust);
    } else if (n) {
      if (n.kind) tags.push(n.kind);
      const memory = laundering.find((m) => m.memory_id === id);
      if (memory) tags.push(memory.written_by, memory.written_on);
      else if (n.agent_id) tags.push(n.agent_id);
      if (n.sanitized) tags.push("sanitized");
      if (n.approved) tags.push("approved");
      if (n.quarantined) tags.push("quarantined");
    }
    return { id, label: nodeLabel(nodes, id), isSource: n?.label === "Source", tags };
  });
}

// ------------------------------------------------------------------ forensics
export interface ForensicStep {
  title: string;
  /** What the report says for this step, or null when the step was not reached. */
  result: string | null;
}

/** The scripted plan of the Forensic Agent (plan §13.2) with the result of each step taken from the report. In LLM mode the
 *  order of the tool calls is not recorded, so the same facts are shown without implying a sequence. */
export function forensicSteps(r: ForensicReport): ForensicStep[] {
  const keys = r.laundering_memories.map((m) => m.memory_key);
  return [
    { title: "Get the witness paths", result: r.untrusted_source ? `untrusted source ${r.untrusted_source}` : null },
    {
      title: "Trace the memory that carried it",
      result: r.untrusted_source ? (keys.length > 0 ? `${plural(keys.length, "memory", "memories")}: ${keys.join(", ")}` : "no memory involved") : null,
    },
    {
      title: "Quarantine everything derived from the source",
      result: r.untrusted_source
        ? r.quarantine_id
          ? `${r.quarantine_id} covers ${plural(r.quarantined_artifacts.length, "artifact", "artifacts")}; affected actions: ${r.affected_actions.join(", ") || "none"}`
          : "nothing new to quarantine"
        : null,
    },
    { title: "Replay Fixer and Release in a sandbox copy of the graph", result: r.sandbox ? `${r.sandbox.graph} → ${r.sandbox.new_action_id}` : null },
    { title: "Gate the healed result in the sandbox", result: r.sandbox ? `${r.sandbox.verdict} · ${r.sandbox.reason}` : null },
  ];
}

export const canRelease = (r: ForensicReport | null, status: string, alreadyReleased: boolean): boolean =>
  r !== null && r.recommendation === "APPROVE_HEALED_RELEASE" && needsDecision(status) && !alreadyReleased;

// ------------------------------------------------------------------ diff
export type DiffMark = "same" | "removed" | "added";
export interface DiffLine {
  text: string;
  mark: DiffMark;
}

/** Line-level comparison by presence (the same rule as the old tab): a line missing on the other side is marked. Marks come
 *  with a gutter symbol in the UI, never colour alone. */
export function diffLines(held: string, healed: string): { held: DiffLine[]; healed: DiffLine[] } {
  const a = held.split("\n");
  const b = healed.split("\n");
  const inB = new Set(b);
  const inA = new Set(a);
  return {
    held: a.map((text) => ({ text, mark: inB.has(text) ? "same" : "removed" })),
    healed: b.map((text) => ({ text, mark: inA.has(text) ? "same" : "added" })),
  };
}
