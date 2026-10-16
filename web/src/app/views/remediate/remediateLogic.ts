import type { AgentWitness, ApplyResult, Candidate, CapNode, CapState, RemediationSummary } from "../../../api/types";

/** Pure helpers for Remediate (ui-redesign.md §13.8). Toxicity, costs, max flow and verification all come from the API
 *  (`algo.maxFlow` and the r-queries); nothing here decides them. The page orders, labels and words what was returned. */

const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The cheapest candidate that was verified on a temporary copy, from the returned `verified` and `total_cost` only. A tie goes to the first
 *  in the order the API returned. */
export function cheapestVerified(candidates: Candidate[]): Candidate | undefined {
  let best: Candidate | undefined;
  for (const c of candidates) {
    if (c.verified && (best === undefined || c.total_cost < best.total_cost)) best = c;
  }
  return best;
}

/** Why Apply is disabled, in words that are shown without hovering; `null` when it can be pressed. */
export function applyBlockedReason(c: Candidate): string | null {
  if (!c.verified) return c.invalid_reason ? `Not verified: ${c.invalid_reason}` : "Not verified on the temporary copy.";
  if (!c.needs_cut) return "Nothing to cut: no agent is toxic.";
  return null;
}

/** Bar width in percent, relative to the dearest candidate, so the bars compare the candidates and carry no meaning of their own. */
export function costBars(candidates: Candidate[]): Map<string, number> {
  const top = Math.max(0, ...candidates.map((c) => c.total_cost));
  return new Map(candidates.map((c) => [c.id, top === 0 ? 0 : Math.max(4, Math.round((c.total_cost / top) * 100))]));
}

/** The exhaustive optimum of the last `make eval` (read from `summary.json`), never computed by the page. */
export function optimumSentence(opt: RemediationSummary | undefined): string | null {
  if (!opt) return null;
  if (opt.optimum_cost === null) return `From the last make eval: best candidate ${opt.best_candidate_cost}; no exhaustive optimum was computed (the search is limited to 6 edges).`;
  const head = `Exhaustive optimum from the last make eval: ${opt.optimum_cost}; best candidate ${opt.best_candidate_cost}`;
  return opt.gap ? `${head}. A cheaper mixed cut exists that no single candidate finds (gap ${opt.gap}).` : `${head}. The best candidate is optimal.`;
}

const names = (items: string[]): string => (items.length === 0 ? "none" : items.join(", "));

export function appliedSentence(r: ApplyResult): string {
  return `Revoked ${plural(r.revoked, "flow")}. Toxic agents before: ${r.toxic_before.length} (${names(r.toxic_before)}) · after: ${r.toxic_after.length} (${names(r.toxic_after)}).`;
}

export const toxicCount = (state: CapState): string => `${state.toxic_agents.length} toxic ${state.toxic_agents.length === 1 ? "agent" : "agents"}`;

/** The lines of the apply review: every flow that would be revoked, from the candidate's own edges. */
export function reviewRows(c: Candidate): { id: string; text: string }[] {
  return c.edges.map((e) => ({ id: e.cap_id, text: `${e.src} → ${e.dst} (cost ${e.cost})` }));
}

export const revokeLabel = (c: Candidate): string => `Revoke ${plural(c.cap_ids.length, "flow")}`;

/** A path as one line (`inbound_email → crm → billing_agent`), or `none`. */
export const pathText = (path: string[]): string => (path.length === 0 ? "none" : path.join(" → "));

export function witnessRows(w: AgentWitness): { label: string; path: string[] }[] {
  return [
    { label: "Receives untrusted data from", path: w.from_untrusted },
    { label: "Receives secrets from", path: w.from_secret },
    { label: "Can reach outside through", path: w.to_external },
  ];
}

export interface AgentRow {
  name: string;
  kind: string;
  trust: string;
  external: string;
  toxic: string;
}

/** The accessible form of the capability graph: one row per node, the toxic flag as a word. */
export function agentRows(nodes: CapNode[]): AgentRow[] {
  return nodes.map((n) => ({
    name: n.name,
    kind: n.kind,
    trust: n.trust ?? "",
    external: n.kind === "sink" ? (n.external ? "external" : "internal") : "",
    toxic: n.kind === "agent" ? (n.toxic ? "TOXIC" : "not toxic") : "",
  }));
}
