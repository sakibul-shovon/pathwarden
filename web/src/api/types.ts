// Types mirror the REST API of plan §18 (see api/routes/*). No `any` for API data.

export type Verdict = "ALLOW" | "HOLD" | "BLOCK";

export interface RuleOfTwo {
  A: boolean; // processes untrusted input
  B: boolean; // has access to secrets
  C: boolean; // changes state or communicates externally
  green: boolean; // A + B + C <= 2
}

export interface SessionView {
  id: string;
  agent: string;
  day: string;
  rule_of_two: RuleOfTwo;
}

export interface TimelineRow {
  t: number;
  session: string | null;
  agent: string;
  op: string;
  detail: string;
}

export interface ActionOutcome {
  id: string;
  status: string;
  reason: string;
}

export interface RunResult {
  scenario: string;
  guard: boolean;
  mode: string;
  sessions: SessionView[];
  timeline: TimelineRow[];
  actions: ActionOutcome[];
}

export interface HealResult extends RunResult {
  approver: string;
  superseded: boolean;
}

export interface ScenarioInfo {
  name: string;
  description: string;
  expected: { status: string; reason: string };
}

export interface GateView {
  action_id: string;
  verdict: Verdict;
  reason: string;
  untrusted_witness: string[];
  secret_witness: string[];
  quarantined_ancestors: string[];
  latency_ms: number;
  llm_calls: number;
}

export interface ActionListItem {
  id: string;
  status: string;
  payload_id: string;
}

export interface ActionDetail extends ActionListItem {
  sink_id: string;
  external: boolean;
  gate: GateView;
}

export interface LineageNode {
  id: string;
  label: string; // Artifact | Source
  kind: string | null;
  trust: string | null;
  sanitized: boolean | null;
  approved: boolean | null;
  quarantined: boolean | null;
  agent_id: string | null;
  session_id: string | null;
  key: string | null;
  created_at: number | null;
}

export interface LineageEdge {
  src: string;
  dst: string;
  rel: string;
}

export interface LaunderingMemory {
  memory_id: string;
  memory_key: string;
  written_in_session: string;
  written_by: string;
  written_on: string;
  untrusted_source: string;
}

export interface Explain {
  gate: GateView;
  laundering: LaunderingMemory[];
  subgraph: { nodes: LineageNode[]; edges: LineageEdge[] };
  queries: Record<string, string>;
}

export interface ForensicReport {
  action_id: string;
  untrusted_source: string;
  laundering_memories: {
    memory_id: string;
    memory_key: string;
    written_by: string;
    written_in_session: string;
    written_on: string;
  }[];
  quarantine_id: string | null;
  quarantined_artifacts: string[];
  affected_actions: string[];
  sandbox: { graph: string; new_action_id: string; verdict: string; reason: string } | null;
  diff: {
    held_payload_id: string;
    held_graph: string;
    healed_payload_id: string;
    healed_graph: string;
  } | null;
  recommendation: "APPROVE_HEALED_RELEASE" | "ESCALATE_TO_HUMAN";
  mode: string;
  fallback_used: boolean;
  llm_calls: number;
}

export interface Artifact {
  id: string;
  kind: string;
  key: string;
  store: string;
  content: string;
  agent_id: string;
  session_id: string;
  created_at: number;
  sanitized: boolean;
  approved: boolean;
  quarantined: boolean;
}

export interface PostedEntry {
  action_id: string;
  sink_id: string;
  payload_id: string;
  content: string;
}

/** `GET /api/health`: `graphs` is omitted in hosted mode (tenant names are never listed). */
export interface HealthStatus {
  falkordb: string;
  graphs?: string[];
}

export interface ApiErrorBody {
  error: string;
  detail: string;
}

export interface TimeMarker {
  t: number;
  artifact_id: string;
  key: string;
}

export interface TimeAction {
  action_id: string;
  status: string;
  payload_id: string;
}

/** `GET /graph-at?t=`: the lineage graph as it was at logical time `t` (markers are workspace-wide). */
export interface GraphAt {
  t: number;
  max_t: number;
  nodes: LineageNode[];
  edges: LineageEdge[];
  actions: TimeAction[];
  doubly_tainted: string[];
  markers: {
    poisoned_memory_written: TimeMarker | null;
    draft_doubly_tainted: TimeMarker | null;
  };
}

export interface MemoryEntry {
  memory_id: string;
  key: string;
  kind: string;
  written_by: string;
  written_on: string;
  quarantined: boolean;
  untrusted_origins: string[];
  quarantine_id: string | null;
}

// ---------------------------------------------------------------- remediation (plan §15, §18)
export type Topology = "enterprise12" | "tinyqueue3";

export interface CapNode {
  name: string;
  kind: string; // source | agent | store | sink
  trust: string | null; // untrusted | secret | internal for sources
  external: boolean | null; // sinks
  toxic: boolean;
}

export interface CapEdge {
  src: string;
  dst: string;
  cap_id: string;
  cost: number;
  revoked: boolean;
}

export interface CapState {
  topology: string;
  nodes: CapNode[];
  edges: CapEdge[];
  toxic_agents: string[];
}

export interface CutEdge {
  cap_id: string;
  src: string;
  dst: string;
  cost: number;
}

export interface Candidate {
  id: string;
  name: string;
  cap_ids: string[];
  edges: CutEdge[];
  total_cost: number;
  max_flow: number;
  invalid_reason: string | null;
  needs_cut: boolean;
  verified: boolean;
  description: string;
}

export interface ApplyResult {
  topology: string;
  cap_ids: string[];
  revoked: number;
  toxic_before: string[];
  toxic_after: string[];
}

export interface AgentWitness {
  agent: string;
  toxic: boolean;
  from_untrusted: string[];
  from_secret: string[];
  to_external: string[];
}

// ---------------------------------------------------------------- evaluation (plan §20; generated by `make eval`)
export interface Proportion {
  k: number;
  n: number;
  rate: number;
  lo: number;
  hi: number;
}

export type DefenseSummary =
  | { status: "run"; asr: Proportion; fhr: Proportion }
  | { status: "not_run" };

export interface RemediationSummary {
  best_candidate_cost: number;
  optimum_cost: number | null;
  gap: number | null;
  optimum_cap_ids: string[];
  toxic_agents_before: string[];
  candidates: { id: string; total_cost: number; flows: number; verified: boolean }[];
}

export interface EvalSummary {
  dataset: { seed: number; scenarios: number; attacks: number; benign: number; families: Record<string, number> };
  defenses: Record<string, DefenseSummary>;
  per_family: Record<string, Record<string, { attacks?: number; released?: number; benign?: number; held?: number; status?: string }>>;
  witness_accuracy: { n: number; correct: number; rate: number };
  falsification_criteria: { text: string; status: string }[];
  limitations: string[];
  remediation?: Record<string, RemediationSummary>;
}
