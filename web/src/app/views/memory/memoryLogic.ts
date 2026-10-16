import type { LineageNode, MemoryEntry } from "../../../api/types";

/** Wording and filtering for the team-memory ledger. Every field comes from `GET /memory` (query q8); nothing is derived
 *  from content, and "untrusted origins" is the API's list, never a guess. */

export type MemoryFilter = "all" | "untrusted" | "quarantined";

export const FILTER_LABEL: Record<MemoryFilter, string> = {
  all: "All",
  untrusted: "From untrusted input",
  quarantined: "Quarantined",
};

export function filterEntries(entries: MemoryEntry[], filter: MemoryFilter): MemoryEntry[] {
  if (filter === "untrusted") return entries.filter((e) => e.untrusted_origins.length > 0);
  if (filter === "quarantined") return entries.filter((e) => e.quarantined);
  return entries;
}

export function filterCounts(entries: MemoryEntry[]): Record<MemoryFilter, number> {
  return { all: entries.length, untrusted: filterEntries(entries, "untrusted").length, quarantined: filterEntries(entries, "quarantined").length };
}

/** Why the release button cannot be pressed, in words that are shown without hovering; `null` when it can. */
export function releaseBlockedReason(entry: MemoryEntry): string | null {
  if (!entry.quarantined) return null;
  return entry.quarantine_id === null ? "The quarantine id is unknown (the API was restarted). Run forensics again to re-quarantine." : null;
}

/** The other entries of the ledger sealed by the same quarantine: releasing it restores all of them (and any artifact the ledger does not list). */
export function sharedQuarantine(entries: MemoryEntry[], quarantineId: string): MemoryEntry[] {
  return entries.filter((e) => e.quarantine_id === quarantineId);
}

export function releaseSuccess(result: { quarantine_id: string; released: number }): string {
  const n = result.released;
  return `Released ${result.quarantine_id}: ${n} ${n === 1 ? "artifact" : "artifacts"} restored. The gate no longer blocks on this quarantine; its other checks still apply.`;
}

/** The ledger row as a node, so the shared node drawer can show it (its edges are not part of the ledger). */
export function memoryNode(entry: MemoryEntry): LineageNode {
  return {
    id: entry.memory_id,
    label: "Artifact",
    kind: entry.kind,
    trust: null,
    sanitized: null,
    approved: null,
    quarantined: entry.quarantined,
    agent_id: entry.written_by,
    session_id: null,
    key: entry.key,
    created_at: null,
  };
}
