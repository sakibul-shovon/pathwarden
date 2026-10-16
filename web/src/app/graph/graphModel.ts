import type { LineageEdge, LineageNode } from "../../api/types";

/** Pure helpers behind the graph views (ui-redesign.md §15). They only arrange and word what the API returned; a verdict,
 *  a taint or a marker is never computed here. */

export type Witness = "untrusted" | "secret" | "both" | "";

// ------------------------------------------------------------------ glossary
/** Plain-language meaning of a relationship type, from docs/graph-model.md. An unknown type is said to be unknown. */
const GLOSSARY: Record<string, string> = {
  DERIVED_FROM:
    "was written while this artifact was in the agent's context, so it may carry anything in it (a sanitizer's output derives from its single input only)",
  ORIGINATES_FROM: "was read from this source",
};

export function relationMeaning(rel: string): string {
  return GLOSSARY[rel] ?? "a relationship type this page has no description for";
}

// ------------------------------------------------------------------ neighbourhoods
const pairKey = (a: string, b: string): string => `${a}>${b}`;
export const witnessPairs = (path: string[]): Set<string> => new Set(path.slice(0, -1).map((id, i) => pairKey(id, path[i + 1] ?? "")));

export interface Incident {
  incoming: LineageEdge[];
  outgoing: LineageEdge[];
}

/** Edges are stored from the newer artifact to what it was made from: `outgoing` points at the inputs, `incoming` at what was made from this node. */
export function incidentEdges(id: string, edges: LineageEdge[]): Incident {
  return { incoming: edges.filter((e) => e.dst === id), outgoing: edges.filter((e) => e.src === id) };
}

/** What stays at full strength while a node is hovered or focused: the node, its incident edges and the nodes at their ends. */
export function neighbourhood(id: string, edges: LineageEdge[]): { nodes: Set<string>; edges: Set<number> } {
  const nodes = new Set<string>([id]);
  const kept = new Set<number>();
  edges.forEach((e, i) => {
    if (e.src === id || e.dst === id) {
      kept.add(i);
      nodes.add(e.src);
      nodes.add(e.dst);
    }
  });
  return { nodes, edges: kept };
}

/** Focus mode (a display filter over the returned edges, not a security computation): the node, everything it was made from
 *  and everything made from it, transitively. */
export function focusSet(id: string, edges: LineageEdge[]): Set<string> {
  const reach = (from: "src" | "dst"): Set<string> => {
    const to = from === "src" ? "dst" : "src";
    const seen = new Set<string>([id]);
    const queue = [id];
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      for (const e of edges) {
        if (e[from] === next && !seen.has(e[to])) {
          seen.add(e[to]);
          queue.push(e[to]);
        }
      }
    }
    return seen;
  };
  return new Set([...reach("src"), ...reach("dst")]);
}

/** "Show only witness paths": the nodes of both paths. */
export const witnessNodes = (untrusted: string[], secret: string[]): Set<string> => new Set([...untrusted, ...secret]);

export interface TraceEdge {
  kind: "untrusted" | "secret";
  from: string;
  to: string;
}

/** The witness trace: both paths revealed in lockstep, one edge each per step, from the payload towards the source. */
export function traceFrames(untrusted: string[], secret: string[]): TraceEdge[][] {
  const steps = (kind: TraceEdge["kind"], path: string[]): TraceEdge[] => path.slice(0, -1).map((from, i) => ({ kind, from, to: path[i + 1] ?? "" }));
  const u = steps("untrusted", untrusted);
  const s = steps("secret", secret);
  const frames: TraceEdge[][] = [];
  for (let i = 0; i < Math.max(u.length, s.length); i++) frames.push([u[i], s[i]].filter((e): e is TraceEdge => e !== undefined));
  return frames;
}

// ------------------------------------------------------------------ words
const pathSteps = (path: string[]): number => Math.max(0, path.length - 1);
const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export function graphCounts(nodes: LineageNode[], edges: LineageEdge[]): { artifacts: number; sources: number; edges: number } {
  const sources = nodes.filter((n) => n.label === "Source").length;
  return { artifacts: nodes.length - sources, sources, edges: edges.length };
}

/** The caption under a canvas, so the figure never says anything the text does not. */
export function graphCaption(subject: string, nodes: LineageNode[], edges: LineageEdge[], untrusted: string[], secret: string[]): string {
  const c = graphCounts(nodes, edges);
  return (
    `Lineage of ${subject}: ${plural(c.artifacts, "artifact")}, ${plural(c.sources, "source")}, ${plural(c.edges, "edge")}. ` +
    `Untrusted path ${plural(pathSteps(untrusted), "step")}, secret path ${plural(pathSteps(secret), "step")}.`
  );
}

/** The canvas label of a node: the key people know, then the id, then the facts that matter, never colour alone (§15.4). */
export function canvasLabel(node: LineageNode, opts: { payload?: boolean; tainted?: boolean } = {}): string {
  if (node.label === "Source") return `◆ ${node.id}\n${node.trust ?? "source"}`;
  // a sanitizer's output already says "sanitized" as its kind: do not repeat it
  const flags = [node.sanitized && node.kind !== "sanitized" ? "sanitized" : "", node.approved ? "approved" : "", node.quarantined ? "quarantined" : ""].filter(Boolean);
  const prefix = [opts.tainted ? "⚠ 2× tainted" : "", opts.payload ? "payload" : "", node.quarantined ? "Q" : ""].filter(Boolean).join(" ");
  const name = node.key || node.kind || node.id;
  const detail = node.key && node.kind ? `${node.id} · ${node.kind}` : node.id;
  return [prefix ? `${prefix} ${name}` : name, detail, flags.join(" · ")].filter(Boolean).join("\n");
}

// ------------------------------------------------------------------ the accessible table
export interface NodeRow {
  id: string;
  label: string;
  name: string;
  trust: string;
  flags: string;
  agent: string;
  session: string;
  t: number | null;
  witness: Witness;
}

export interface EdgeRow {
  from: string;
  rel: string;
  to: string;
  witness: Witness;
}

const witnessOf = (u: boolean, s: boolean): Witness => (u && s ? "both" : u ? "untrusted" : s ? "secret" : "");

export function nodeRows(nodes: LineageNode[], untrusted: string[], secret: string[]): NodeRow[] {
  const u = new Set(untrusted);
  const s = new Set(secret);
  return nodes.map((n) => ({
    id: n.id,
    label: n.label,
    name: n.key || n.kind || "",
    trust: n.trust ?? "",
    flags: [n.sanitized ? "sanitized" : "", n.approved ? "approved" : "", n.quarantined ? "quarantined" : ""].filter(Boolean).join(", "),
    agent: n.agent_id ?? "",
    session: n.session_id ?? "",
    t: n.created_at,
    witness: witnessOf(u.has(n.id), s.has(n.id)),
  }));
}

export function edgeRows(edges: LineageEdge[], untrusted: string[], secret: string[]): EdgeRow[] {
  const u = witnessPairs(untrusted);
  const s = witnessPairs(secret);
  return edges.map((e) => ({ from: e.src, rel: e.rel, to: e.dst, witness: witnessOf(u.has(pairKey(e.src, e.dst)), s.has(pairKey(e.src, e.dst))) }));
}

export type SortDir = "asc" | "desc";

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** A stable sort; ids compare naturally (`a-0002` before `a-0010`) and an empty cell sorts last in either direction. */
export function sortRows<T extends object>(rows: T[], key: keyof T, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      const x = a.row[key];
      const y = b.row[key];
      const xe = x === "" || x === null || x === undefined;
      const ye = y === "" || y === null || y === undefined;
      if (xe || ye) return xe && ye ? a.i - b.i : xe ? 1 : -1;
      const c = typeof x === "number" && typeof y === "number" ? x - y : collator.compare(String(x), String(y));
      return c === 0 ? a.i - b.i : c * sign;
    })
    .map((x) => x.row);
}

export function filterRows<T extends object>(rows: T[], text: string): T[] {
  const needle = text.trim().toLowerCase();
  if (needle === "") return rows;
  return rows.filter((r) => Object.values(r).some((v) => v !== null && String(v).toLowerCase().includes(needle)));
}
