import type { GraphAt, LineageNode, TimeMarker } from "../../../api/types";

/** Pure helpers for Time travel (ui-redesign.md §13.7). The two story moments come from the API (`markers`, computed over
 *  q7/q6b in Python); nothing here finds a taint or a marker, it only words and places what was returned. */

export const REPLAY_STEP_MS = 700;
export const FETCH_DEBOUNCE_MS = 120;

export const clampT = (t: number, max: number): number => Math.min(Math.max(0, Math.trunc(t)), Math.max(0, max));

/** The next time of a replay, or `null` when the replay has reached the end (it stops there, it never wraps). */
export function nextReplayT(t: number, max: number): number | null {
  return t >= max ? null : t + 1;
}

/** What a screen reader hears for the scrubber. */
export const scrubberText = (t: number, max: number): string => `t = ${t} of ${max}`;

export type MarkerKey = "poisoned_memory_written" | "draft_doubly_tainted";

export const MARKER_LABEL: Record<MarkerKey, string> = {
  poisoned_memory_written: "Poisoned memory written",
  draft_doubly_tainted: "Draft doubly tainted",
};

export interface MarkerView {
  key: MarkerKey;
  label: string;
  marker: TimeMarker | null;
  /** The scrubber is on this marker's time. */
  here: boolean;
  /** Where the tick sits on the track, 0–100. */
  percent: number;
  /** The full words of the button, which is also its accessible name. */
  text: string;
}

export function markerViews(markers: GraphAt["markers"] | null, t: number, max: number): MarkerView[] {
  return (Object.keys(MARKER_LABEL) as MarkerKey[]).map((key) => {
    const marker = markers?.[key] ?? null;
    const label = MARKER_LABEL[key];
    return {
      key,
      label,
      marker,
      here: marker !== null && marker.t === t,
      percent: marker === null || max <= 0 ? 0 : (clampT(marker.t, max) / max) * 100,
      text: marker === null ? `${label}: this run has no such moment` : `${label} · t=${marker.t} · ${marker.key}`,
    };
  });
}

/** The artifacts that carry a marker at this moment (drawn with a highlighter halo). */
export function markedIds(markers: GraphAt["markers"] | null): string[] {
  return [markers?.poisoned_memory_written?.artifact_id, markers?.draft_doubly_tainted?.artifact_id].filter((id): id is string => id !== undefined);
}

/** Nodes whose clock tick is exactly this moment. The clock also ticks on events that write no node, so this may be empty. */
export const writtenAt = (graph: GraphAt): LineageNode[] => graph.nodes.filter((n) => n.created_at === graph.t);

const plural = (n: number, one: string, many: string = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export function frameSummary(graph: GraphAt): string {
  return `${plural(graph.nodes.length, "node")} · ${plural(graph.edges.length, "edge")} · ${plural(graph.actions.length, "proposed action")}`;
}

export const taintedSummary = (graph: GraphAt): string | null =>
  graph.doubly_tainted.length === 0 ? null : `${plural(graph.doubly_tainted.length, "doubly tainted draft")}: untrusted and secret lineage in one artifact`;

/** A frame may be drawn only if it is the one asked for: a late answer for an earlier time is never shown as the current one. */
export const isCurrentFrame = (graph: GraphAt | null, t: number): graph is GraphAt => graph !== null && graph.t === t;
