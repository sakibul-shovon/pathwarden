import type { LineageEdge, LineageNode } from "../../api/types";

/** The lanes layout (ui-redesign.md §15.3, transposed): one lane per session as a vertical column, logical time running down,
 *  and a final column of sources. A pure function of the returned subgraph, so the same graph always lands in the same place
 *  (it feeds Cytoscape's built-in `preset` layout). It only places nodes; it never decides a verdict, a taint or a marker.
 *
 *  The spec lays lanes out as horizontal bands with a column per time step. A real run has a dozen steps, which makes that
 *  about 1,900 px wide and unreadable in the page; with lanes as columns the width depends on the number of sessions (three to
 *  five) and the time axis is the page's own scroll direction. The spacing numbers are the spec's. */

export interface Point {
  x: number;
  y: number;
}

export interface LaneBand {
  id: string;
  label: string;
  kind: "session" | "other" | "sources";
  /** Horizontal extent of the lane; every lane spans the full height. */
  left: number;
  width: number;
}

export interface LanesLayout {
  positions: Map<string, Point>;
  /** The band each node sits in (the Cytoscape compound parent). */
  bandOf: Map<string, string>;
  bands: LaneBand[];
  width: number;
  height: number;
}

export const LANES = {
  /** Width of a lane; the node (150 px) sits centred in it. */
  lane: 170,
  gap: 10,
  pad: 16,
  /** Height of one stacked node. */
  row: 60,
  /** Minimum distance between two sources in the Sources lane (a diamond is 64 px tall). */
  sourceGap: 76,
  /** A source is nudged down in steps of 60 px until it clears its neighbour. */
  nudge: 60,
  /** Above this many nodes lanes stop being readable and the Tree layout is used instead. */
  maxNodes: 150,
} as const;

const TRUST_ORDER = ["untrusted", "internal", "secret"];
const trustRank = (trust: string | null): number => {
  const i = TRUST_ORDER.indexOf(trust ?? "");
  return i === -1 ? TRUST_ORDER.length : i;
};

const byId = (a: LineageNode, b: LineageNode): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
const minTime = (nodes: LineageNode[]): number => nodes.reduce((m, n) => (n.created_at === null ? m : Math.min(m, n.created_at)), Infinity);

/** Lanes for an artifact graph, or Tree with the reason when the graph is too large to read as lanes. */
export function chooseLayout(nodeCount: number): { layout: "lanes" | "tree"; reason: string | null } {
  if (nodeCount > LANES.maxNodes) {
    return { layout: "tree", reason: `${nodeCount} nodes: lanes stop being readable above ${LANES.maxNodes}, so the tree layout is used.` };
  }
  return { layout: "lanes", reason: null };
}

export function lanesLayout(nodes: LineageNode[], edges: LineageEdge[]): LanesLayout {
  const positions = new Map<string, Point>();
  const bandOf = new Map<string, string>();

  const sources = nodes.filter((n) => n.label === "Source");
  const artifacts = nodes.filter((n) => n.label !== "Source");

  // rows: the rank of an artifact's created_at among all distinct times; an artifact without a time goes in a last row
  const times = [...new Set(artifacts.map((n) => n.created_at).filter((t): t is number => t !== null))].sort((a, b) => a - b);
  const rank = new Map(times.map((t, i) => [t, i]));
  const rowOf = (n: LineageNode): number => (n.created_at === null ? times.length : (rank.get(n.created_at) ?? times.length));

  // lanes: sessions, ordered by the earliest time of their artifacts; artifacts without a session go in an Other lane
  const bySession = new Map<string, LineageNode[]>();
  const noSession: LineageNode[] = [];
  for (const n of artifacts) {
    if (n.session_id) bySession.set(n.session_id, [...(bySession.get(n.session_id) ?? []), n]);
    else noSession.push(n);
  }
  const sessions = [...bySession.entries()]
    .map(([id, members]) => ({ id, members, start: minTime(members) }))
    .sort((a, b) => (a.start === b.start ? (a.id < b.id ? -1 : 1) : a.start - b.start));

  const lanes: { id: string; label: string; kind: LaneBand["kind"]; members: LineageNode[] }[] = sessions.map((s) => {
    const agent = [...s.members].sort(byId).find((n) => n.agent_id)?.agent_id ?? "unknown agent";
    return { id: `lane:${s.id}`, label: `${agent} · ${s.id}`, kind: "session", members: s.members };
  });
  if (noSession.length > 0) lanes.push({ id: "lane:other", label: "Other (no session recorded)", kind: "other", members: noSession });

  const rowCount = times.length + (artifacts.some((n) => n.created_at === null) ? 1 : 0);
  const stackAt = (members: LineageNode[], r: number): LineageNode[] => members.filter((n) => rowOf(n) === r).sort(byId);

  // a row is as tall as its tallest stack in any lane, so nodes that share a time never collide with the next time
  const rowTop: number[] = [];
  let y: number = LANES.pad;
  for (let r = 0; r < rowCount; r++) {
    rowTop.push(y);
    y += Math.max(1, ...lanes.map((l) => stackAt(l.members, r).length)) * LANES.row;
  }
  let height = y;

  const bands: LaneBand[] = [];
  const left = (i: number): number => LANES.pad + i * (LANES.lane + LANES.gap);
  lanes.forEach((lane, i) => {
    bands.push({ id: lane.id, label: lane.label, kind: lane.kind, left: left(i), width: LANES.lane });
    for (let r = 0; r < rowCount; r++) {
      stackAt(lane.members, r).forEach((n, k) => {
        positions.set(n.id, { x: left(i) + LANES.lane / 2, y: rowTop[r]! + k * LANES.row + LANES.row / 2 });
        bandOf.set(n.id, lane.id);
      });
    }
  });

  // sources: a last lane, each source level with the first artifact that was read from it
  if (sources.length > 0) {
    const firstY = new Map<string, number>();
    for (const e of edges) {
      if (e.rel !== "ORIGINATES_FROM") continue;
      const from = positions.get(e.src);
      if (!from) continue;
      const known = firstY.get(e.dst);
      if (known === undefined || from.y < known) firstY.set(e.dst, from.y);
    }
    const index = lanes.length;
    const desired = (id: string): number => firstY.get(id) ?? LANES.pad + LANES.row / 2;
    const ordered = [...sources].sort((a, b) => desired(a.id) - desired(b.id) || trustRank(a.trust) - trustRank(b.trust) || byId(a, b));
    let last = -Infinity;
    for (const s of ordered) {
      let sy = desired(s.id);
      while (sy - last < LANES.sourceGap) sy += LANES.nudge;
      last = sy;
      positions.set(s.id, { x: left(index) + LANES.lane / 2, y: sy });
      bandOf.set(s.id, "lane:sources");
      height = Math.max(height, sy + LANES.sourceGap / 2 + LANES.pad);
    }
    bands.push({ id: "lane:sources", label: "Sources", kind: "sources", left: left(index), width: LANES.lane });
  }

  const width = bands.length === 0 ? 0 : left(bands.length - 1) + LANES.lane + LANES.pad;
  return { positions, bandOf, bands, width, height: positions.size === 0 ? 0 : height };
}
