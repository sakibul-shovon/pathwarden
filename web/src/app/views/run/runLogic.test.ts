import { describe, expect, it } from "vitest";
import type { PostedEntry, RunResult, SessionView, TimelineRow } from "../../../api/types";
import { filterRows, formatElapsed, groupBySession, isLeakLine, opCategory, outcomeOf, scenarioExpectation, stopLabel, verbOf } from "./runLogic";

const result = (status: string, reason: string, id = "act-0001"): RunResult => ({
  scenario: "attack_pipeline_42",
  guard: true,
  mode: "scripted",
  sessions: [],
  timeline: [],
  actions: [{ id, status, reason }],
});
const post = (content: string): PostedEntry => ({ action_id: "act-0001", sink_id: "sink:public_release_page", payload_id: "a-0010", content });
const LEAKY = "## Release notes\nPAYMENT_API_KEY=PWDEMO-SECRET-7f3a9c21-NOT-A-REAL-KEY";
const QUOTED = "## Release notes\n- Test keys follow the format PWDEMO-SECRET-00000000-NOT-A-REAL-KEY";

describe("outcomeOf", () => {
  it("is HELD or BLOCKED exactly as the API says, with the action id and reason", () => {
    expect(outcomeOf(result("held", "TRIFECTA"), [])).toMatchObject({ kind: "held", actionId: "act-0001", reason: "TRIFECTA" });
    expect(outcomeOf(result("blocked", "QUARANTINED_LINEAGE"), [])).toMatchObject({ kind: "blocked" });
  });

  it("is LEAKED only with the guard off and a matching public page", () => {
    expect(outcomeOf(result("executed", "GUARD_OFF"), [post(LEAKY)]).kind).toBe("leaked");
  });

  it("is POSTED (guard off) when nothing on the page matches", () => {
    expect(outcomeOf(result("executed", "GUARD_OFF"), [post("## Release notes\n- Fixed: typo (#43)")]).kind).toBe("posted_unguarded");
  });

  it("never calls a gated release LEAKED, even when it quotes the documented example key", () => {
    // benign_lookalike: guard on, CLEAN, and the text contains PWDEMO-SECRET-00000000-NOT-A-REAL-KEY
    expect(isLeakLine(QUOTED)).toBe(true);
    expect(outcomeOf(result("executed", "CLEAN"), [post(QUOTED)]).kind).toBe("posted");
  });

  it("keeps the warning of a secret that left without any untrusted influence", () => {
    expect(outcomeOf(result("executed", "SECRET_EGRESS_WARNING"), [post(QUOTED)]).kind).toBe("posted_warning");
  });

  it("says NOTHING when no action was proposed (a live Release agent that never asked to post)", () => {
    expect(outcomeOf({ ...result("held", "x"), actions: [] }, [])).toMatchObject({ kind: "nothing", actionId: null });
  });

  it("shows an unknown status instead of guessing", () => {
    expect(outcomeOf(result("weird", "X"), [])).toMatchObject({ kind: "other", status: "weird" });
  });

  it("looks at the last action of a run", () => {
    const r: RunResult = { ...result("executed", "CLEAN"), actions: [{ id: "act-0001", status: "executed", reason: "CLEAN" }, { id: "act-0002", status: "held", reason: "TRIFECTA" }] };
    expect(outcomeOf(r, [])).toMatchObject({ kind: "held", actionId: "act-0002" });
  });
});

const rows: TimelineRow[] = [
  { t: 1, session: "s-0001", agent: "triage", op: "start_session", detail: "triage Mon issue:42 -> s-0001" },
  { t: 2, session: "s-0001", agent: "triage", op: "read_source", detail: "src:issue:42 -> a-0001" },
  { t: 3, session: "s-0001", agent: "triage", op: "write", detail: "memory_write team_convention:42 -> a-0004" },
  { t: 4, session: "s-0002", agent: "fixer", op: "load", detail: "memory_read a-0004" },
  { t: 5, session: "s-0003", agent: "release", op: "propose", detail: "post_release a-0010 -> act-0001" },
  { t: 6, session: "s-0003", agent: "gate", op: "gate", detail: "act-0001 held TRIFECTA" },
  { t: 7, session: "s-0003", agent: "release", op: "something_new", detail: "something_new" },
];
const sessions: SessionView[] = [
  { id: "s-0001", agent: "triage", day: "Mon", rule_of_two: { A: true, B: false, C: true, green: true } },
  { id: "s-0003", agent: "release", day: "Mon", rule_of_two: { A: false, B: false, C: true, green: true } },
];

describe("event log", () => {
  it("categorises the operations the runtime emits", () => {
    expect(["start_session", "read_source", "load", "write", "sanitize", "propose", "approve", "gate"].map(opCategory)).toEqual([
      "session", "reads", "reads", "writes", "writes", "gate", "gate", "gate",
    ]);
    expect(opCategory("something_new")).toBe("other");
  });

  it("filters without losing rows: All keeps every row", () => {
    expect(filterRows(rows, "all")).toHaveLength(rows.length);
    expect(filterRows(rows, "reads").map((r) => r.t)).toEqual([2, 4]);
    expect(filterRows(rows, "writes").map((r) => r.t)).toEqual([3]);
    expect(filterRows(rows, "gate").map((r) => r.t)).toEqual([5, 6]);
  });

  it("groups rows by session in order of first appearance and labels them from the run result", () => {
    const groups = groupBySession(rows, sessions);
    expect(groups.map((g) => g.session)).toEqual(["s-0001", "s-0002", "s-0003"]);
    expect(groups[0]?.label).toBe("triage · s-0001 · Mon");
    expect(groups[1]?.label).toBe("s-0002"); // not in the result: just the id
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(rows.length);
  });

  it("names known operations as verbs and keeps unknown ones raw", () => {
    expect(verbOf("read_source")).toBe("read source");
    expect(verbOf("gate")).toBe("gate decided");
    expect(verbOf("something_new")).toBe("something_new");
  });
});

describe("labels and formatters", () => {
  it("labels every live stop reason and keeps an unknown one raw", () => {
    for (const s of ["done", "finished", "max_steps", "invalid_json", "llm_error"]) expect(stopLabel(s)).not.toBe(s);
    expect(stopLabel("mystery")).toBe("mystery");
  });

  it("formats elapsed time as m:ss and never negative", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(65_400)).toBe("1:05");
    expect(formatElapsed(600_000)).toBe("10:00");
    expect(formatElapsed(-5)).toBe("0:00");
  });

  it("states the expectation of a scenario from the API fields", () => {
    expect(scenarioExpectation({ status: "held", reason: "TRIFECTA" })).toBe("with the guard on: held · TRIFECTA");
  });
});
