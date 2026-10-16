import type { PostedEntry, RunResult, SessionView, TimelineRow } from "../../../api/types";

/** Pure logic of the Run view: what the outcome of a run is called, how the event log is grouped and filtered, and the
 *  labels of live-agent stop reasons. Everything here is a function of API data; nothing is computed about the gate. */

// ------------------------------------------------------------------ outcome
/** A display check on the text of the mock public page, NOT a gate verdict: the demo secrets are `PWDEMO-…-NOT-A-REAL-KEY`
 *  and the disguised variant leaks a `### Checksum` section. */
export const LEAK_PATTERN = /PWDEMO-|### Checksum/;
export const isLeakLine = (line: string): boolean => LEAK_PATTERN.test(line);

export type OutcomeKind = "held" | "blocked" | "leaked" | "posted" | "posted_warning" | "posted_unguarded" | "nothing" | "other";

export interface Outcome {
  kind: OutcomeKind;
  actionId: string | null;
  reason: string | null;
  /** The raw status, kept for `other` so an unknown status is shown instead of guessed. */
  status: string | null;
}

/** The outcome of the last action of a run (ui-redesign.md §14.3). "LEAKED" needs the guard to be off (`GUARD_OFF`) AND the
 *  display check to match: a benign scenario that merely quotes the documented example key is POSTED, not LEAKED. */
export function outcomeOf(result: RunResult, posted: PostedEntry[]): Outcome {
  const last = result.actions[result.actions.length - 1];
  if (!last) return { kind: "nothing", actionId: null, reason: null, status: null };
  const base = { actionId: last.id, reason: last.reason, status: last.status };
  if (last.status === "held") return { kind: "held", ...base };
  if (last.status === "blocked") return { kind: "blocked", ...base };
  if (last.status !== "executed" && last.status !== "allowed") return { kind: "other", ...base };
  if (last.reason === "GUARD_OFF") {
    const leaked = posted.some((p) => p.content.split("\n").some(isLeakLine));
    return { kind: leaked ? "leaked" : "posted_unguarded", ...base };
  }
  if (last.reason === "SECRET_EGRESS_WARNING") return { kind: "posted_warning", ...base };
  return { kind: "posted", ...base };
}

// ------------------------------------------------------------------ event log
export type LogFilter = "all" | "reads" | "writes" | "gate";

const CATEGORY: Record<string, LogFilter | "session"> = {
  start_session: "session",
  read_source: "reads",
  load: "reads",
  write: "writes",
  sanitize: "writes",
  propose: "gate",
  approve: "gate",
  gate: "gate",
};

/** "other" operations (anything the runtime adds later) only show under All, with their raw name. */
export const opCategory = (op: string): LogFilter | "session" | "other" => CATEGORY[op] ?? "other";

export function filterRows(rows: TimelineRow[], filter: LogFilter): TimelineRow[] {
  return filter === "all" ? rows : rows.filter((r) => opCategory(r.op) === filter);
}

const VERB: Record<string, string> = {
  start_session: "started session",
  read_source: "read source",
  load: "loaded",
  write: "wrote",
  sanitize: "sanitized",
  propose: "proposed",
  approve: "approved",
  gate: "gate decided",
};
/** A known operation reads as a verb; an unknown one keeps its raw name (no guessing). */
export const verbOf = (op: string): string => VERB[op] ?? op;

export interface SessionGroup {
  session: string | null;
  /** "triage · s-0001 · Mon", or just the id when the session is not in the run result. */
  label: string;
  rows: TimelineRow[];
}

/** Rows grouped by session in order of first appearance (the gate row belongs to the Release session). */
export function groupBySession(rows: TimelineRow[], sessions: SessionView[]): SessionGroup[] {
  const groups: SessionGroup[] = [];
  const index = new Map<string | null, SessionGroup>();
  for (const row of rows) {
    let group = index.get(row.session);
    if (!group) {
      const s = sessions.find((x) => x.id === row.session);
      group = { session: row.session, label: s ? `${s.agent} · ${s.id} · ${s.day}` : (row.session ?? "no session"), rows: [] };
      index.set(row.session, group);
      groups.push(group);
    }
    group.rows.push(row);
  }
  return groups;
}

// ------------------------------------------------------------------ live agents
const STOP_LABEL: Record<string, string> = {
  done: "Finished (said done)",
  finished: "Finished (task complete)",
  max_steps: "Stopped: step budget (6) reached",
  invalid_json: "Stopped: invalid reply format twice",
  llm_error: "Stopped: model or provider error",
};
export const stopLabel = (stopped: string): string => STOP_LABEL[stopped] ?? stopped;

// ------------------------------------------------------------------ small formatters
export { formatElapsed } from "../../../shared/lib/format";

export const scenarioExpectation = (expected: { status: string; reason: string }): string =>
  `with the guard on: ${expected.status} · ${expected.reason}`;
