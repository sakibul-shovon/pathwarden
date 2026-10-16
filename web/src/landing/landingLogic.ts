import type { EvalSummary, PostedEntry, RemediationSummary } from "../api/types";
import { witnessSteps, type PathStep } from "../app/views/investigate/caseLogic";
import { isLeakLine } from "../app/views/run/runLogic";
import type { LandingStory } from "./story";

/** Pure helpers behind the landing page (ui-redesign.md §11). The page's claims are parsed from build-time imports (README,
 *  graph-model doc, issue fixture, summary.json) and from one recorded run, so a change in those sources changes the page, and a
 *  test fails when a parser no longer finds what it expects. */

export const REPO = "https://github.com/sakibul-shovon/pathwarden";
export const blob = (path: string): string => `${REPO}/blob/main/${path}`;
export const tree = (path: string): string => `${REPO}/tree/main/${path}`;

// ------------------------------------------------------------------ navigation and the call to action
export interface Link {
  label: string;
  href: string;
  external?: boolean;
}

export const NAV: Link[] = [
  { label: "How it works", href: "#story" },
  { label: "Proof", href: "#proof" },
  { label: "Results", href: "#results" },
  { label: "Why a graph", href: "#graph" },
  { label: "Docs", href: blob("README.md"), external: true },
  { label: "GitHub", href: REPO, external: true },
];

export type Probe = "unknown" | "up" | "down";

export interface Cta {
  primary: Link;
  /** Always the same one link, so the row does not change shape when the probe answers. */
  secondary: Link[];
  /** When the API did not answer: the workspace link and why it may not work, on a line of its own (the line is reserved either way). */
  fallback: { link: Link; note: string } | null;
}

/** The primary action is decided by the health probe, so the page never offers a workspace that is not there: with the API up it opens
 *  the workspace; otherwise (including while the probe has not answered) it says how to run it locally. */
export function ctaFor(probe: Probe): Cta {
  const queries: Link = { label: "Read the two queries →", href: "#graph" };
  if (probe === "up") return { primary: { label: "Open the workspace", href: "app/" }, secondary: [queries], fallback: null };
  return {
    primary: { label: "Run it locally", href: "#run-it" },
    secondary: [queries],
    fallback: { link: { label: "Open the workspace", href: "app/" }, note: "needs the API running" },
  };
}

/** One request, two seconds, never repeated; any failure is silent and means "not up". "Up" needs a 200 *and* the API's own JSON: a
 *  static host that answers every path with the landing page's HTML is not an API. */
export async function probeHealth(base: string, fetchImpl: typeof fetch, timeoutMs = 2000): Promise<Probe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(`${base}/api/health`, { signal: controller.signal });
    if (response.status !== 200) return "down";
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && "falkordb" in body ? "up" : "down";
  } catch {
    return "down";
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------------ the recorded run
export interface Plate {
  actionId: string;
  payloadId: string;
  untrusted: PathStep[];
  secret: PathStep[];
  verdict: string;
  reason: string;
  sink: string;
  external: boolean;
  llmCalls: number;
  latencyMs: number;
}

/** FIG. 1: the two witness paths and the verdict exactly as the recorded gate returned them. */
export function plateOf(story: LandingStory): Plate {
  const { action, explain } = story.guard_on;
  const nodes = explain.subgraph.nodes;
  return {
    actionId: action.id,
    payloadId: action.payload_id,
    untrusted: witnessSteps(explain.gate.untrusted_witness, nodes, explain.laundering),
    secret: witnessSteps(explain.gate.secret_witness, nodes, explain.laundering),
    verdict: explain.gate.verdict,
    reason: explain.gate.reason,
    sink: action.sink_id,
    external: action.external,
    llmCalls: explain.gate.llm_calls,
    latencyMs: explain.gate.latency_ms,
  };
}

/** The path from the untrusted source up to the memory that carried it: what Exhibit B shows (the payload end is left out). */
export function carriedBy(plate: Plate): PathStep[] {
  return [...plate.untrusted].slice(1).reverse();
}

export const leakedLines = (posted: PostedEntry[]): string[] => posted.flatMap((p) => p.content.split("\n").filter(isLeakLine));

/** The gate's message to an MCP client, built from the recorded action with the format of `api/mcp/gateway.py`. */
export const mcpRefusal = (plate: Plate, uiUrl = "http://localhost:5173"): string => `Held by Pathwarden: ${plate.actionId} (${plate.reason}). Review at ${uiUrl}/?tab=investigate&ws=tinyqueue-mcp`;

// ------------------------------------------------------------------ the issue fixture
export interface IssueParts {
  visible: string;
  /** The text of the HTML comment that carries the instruction, whitespace collapsed; `null` when there is none. */
  hidden: string | null;
}

export function issueParts(issue: string): IssueParts {
  const m = /<!--([\s\S]*?)-->/.exec(issue);
  if (!m) return { visible: issue.trim(), hidden: null };
  return { visible: issue.replace(m[0], "").trim(), hidden: (m[1] ?? "").replace(/\s+/g, " ").trim() };
}

// ------------------------------------------------------------------ text parsed from the README and the graph-model doc
const clean = (s: string): string => s.replace(/[*`]/g, "").replace(/\s+/g, " ").trim();

/** README §12: what Pathwarden does not claim to stop. Empty when the sentence is no longer there (a test notices). */
export function parseNonGoals(readme: string): string[] {
  const m = /does \*\*not\*\* claim to stop:\s*([^.]*)\.\s/.exec(readme);
  return m ? (m[1] ?? "").split(";").map(clean).filter(Boolean) : [];
}

/** README §5: the reasons for a graph database. */
export function parseReasons(readme: string): string[] {
  const m = /Why a graph database:\s*(.*)\.\s*$/m.exec(readme);
  return m ? (m[1] ?? "").split(",").map(clean).filter(Boolean) : [];
}

/** README §17, in the repository's own words. */
export function licenseStatus(readme: string): string {
  const m = /\*\*(No license[^*]*)\*\*/.exec(readme);
  return m ? clean(m[1] ?? "").replace(/\.$/, "") : "See the repository for the licence status";
}

export interface Schema {
  nodes: string[];
  relations: { from: string; rel: string; to: string }[];
}

/** docs/graph-model.md: the node labels and the relationship patterns `(A)-[:REL]->(B)`; the capability graph's patterns have a colon before the label and are not matched. */
export function parseSchema(doc: string): Schema {
  const nodesBlock = /## Nodes([\s\S]*?)\n## /.exec(doc)?.[1] ?? "";
  const nodes = [...nodesBlock.matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1] ?? "");
  const relations = [...doc.matchAll(/`\((\w+)\)-\[:(\w+)\]->\((\w+)\)`/g)].map((m) => ({ from: m[1] ?? "", rel: m[2] ?? "", to: m[3] ?? "" }));
  return { nodes, relations };
}

/** The four commands of the quickstart (README §2). A test checks each is still there. */
export const RUN_COMMANDS: { command: string; note: string }[] = [
  { command: "make setup", note: "once: a virtual environment with the pinned dependencies" },
  { command: "make up", note: "FalkorDB and the API in Docker; waits until the database answers" },
  { command: "make demo", note: "the six scenarios of the story, with and without the guard" },
  { command: "make web", note: "the UI on http://localhost:5173 (Node needed; tested with 22)" },
];

// ------------------------------------------------------------------ results
export interface RemediationLine {
  topology: string;
  toxic: number;
  candidates: string;
  best: number;
  optimum: string;
  gap: number | null;
  /** Said only when a cheaper mixed cut exists (gap above zero). */
  sentence: string | null;
}

export function remediationLines(summary: EvalSummary): RemediationLine[] {
  return Object.entries(summary.remediation ?? {}).map(([topology, r]: [string, RemediationSummary]) => ({
    topology,
    toxic: r.toxic_agents_before.length,
    candidates: r.candidates.map((c) => `${c.id}=${c.total_cost}`).join(", "),
    best: r.best_candidate_cost,
    optimum: r.optimum_cost === null ? "none (more than 6 edges)" : String(r.optimum_cost),
    gap: r.gap,
    sentence: r.gap && r.gap > 0 ? `On ${topology} a cheaper mixed cut exists that no single candidate finds (gap ${r.gap}).` : null,
  }));
}

export const resultsTitle = (summary: EvalSummary): string => `Measured on ${summary.dataset.scenarios} synthetic scenarios. Read the limits first.`;

/** The limitation that says what a perfect score does and does not show, taken from the generated list. */
export const perfectScoreCaveat = (summary: EvalSummary): string | null => summary.limitations.find((l) => /perfect PW score/i.test(l)) ?? null;

// ------------------------------------------------------------------ footer
export interface FooterColumn {
  title: string;
  links: Link[];
}

export const FOOTER: FooterColumn[] = [
  {
    title: "Project",
    links: [
      { label: "README", href: blob("README.md"), external: true },
      { label: "Graph model", href: blob("docs/graph-model.md"), external: true },
      { label: "Queries", href: tree("api/graph/queries"), external: true },
      { label: "Security model", href: blob("docs/SECURITY.md"), external: true },
      { label: "Deploy guide", href: blob("docs/DEPLOY.md"), external: true },
      { label: "Blog post draft", href: blob("docs/blog.md"), external: true },
    ],
  },
];

export const EVIDENCE = {
  gate: blob("api/runtime/gate.py"),
  invariants: blob("tests/test_invariants.py"),
  disclosure: blob("docs/AI_ASSISTANCE.md"),
};
