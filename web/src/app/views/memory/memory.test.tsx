import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { MemoryEntry } from "../../../api/types";
import { Ledger } from "./Ledger";
import { filterCounts, filterEntries, memoryNode, releaseBlockedReason, releaseSuccess, sharedQuarantine } from "./memoryLogic";

const entry = (over: Partial<MemoryEntry> & { memory_id: string }): MemoryEntry => ({
  key: "team_convention:42", kind: "memory", written_by: "triage", written_on: "Mon", quarantined: false, untrusted_origins: [], quarantine_id: null, ...over,
});
const text = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const noop = (): void => undefined;

const entries: MemoryEntry[] = [
  entry({ memory_id: "a-0003", key: "issue_summary:42", untrusted_origins: ["src:issue:42"], quarantined: true, quarantine_id: "q-0001" }),
  entry({ memory_id: "a-0004", untrusted_origins: ["src:issue:42"], quarantined: true, quarantine_id: "q-0001" }),
  entry({ memory_id: "a-0020", key: "style_guide", written_by: "fixer", written_on: "Wed" }),
  entry({ memory_id: "a-0021", key: "orphan", quarantined: true, quarantine_id: null }),
];

describe("memory logic", () => {
  it("filters by untrusted origin and by quarantine, and counts each filter", () => {
    expect(filterEntries(entries, "all")).toHaveLength(4);
    expect(filterEntries(entries, "untrusted").map((e) => e.memory_id)).toEqual(["a-0003", "a-0004"]);
    expect(filterEntries(entries, "quarantined").map((e) => e.memory_id)).toEqual(["a-0003", "a-0004", "a-0021"]);
    expect(filterCounts(entries)).toEqual({ all: 4, untrusted: 2, quarantined: 3 });
    expect(filterCounts([])).toEqual({ all: 0, untrusted: 0, quarantined: 0 });
  });

  it("says why a release is impossible only when it really is", () => {
    expect(releaseBlockedReason(entries[0]!)).toBeNull();
    expect(releaseBlockedReason(entries[2]!)).toBeNull();
    expect(releaseBlockedReason(entries[3]!)).toContain("The quarantine id is unknown");
    expect(releaseBlockedReason(entries[3]!)).toContain("Run forensics again");
  });

  it("lists the entries sealed together by one quarantine", () => {
    expect(sharedQuarantine(entries, "q-0001").map((e) => e.key)).toEqual(["issue_summary:42", "team_convention:42"]);
    expect(sharedQuarantine(entries, "q-9999")).toEqual([]);
  });

  it("words the success with the real count and keeps the gate's other checks in view", () => {
    expect(releaseSuccess({ quarantine_id: "q-0001", released: 5 })).toBe(
      "Released q-0001: 5 artifacts restored. The gate no longer blocks on this quarantine; its other checks still apply.",
    );
    expect(releaseSuccess({ quarantine_id: "q-0002", released: 1 })).toContain("1 artifact restored");
  });

  it("turns a ledger row into a node without inventing what the ledger does not have", () => {
    const n = memoryNode(entries[0]!);
    expect(n).toMatchObject({ id: "a-0003", label: "Artifact", kind: "memory", key: "issue_summary:42", quarantined: true, agent_id: "triage" });
    expect(n.session_id).toBeNull();
    expect(n.created_at).toBeNull();
    expect(n.trust).toBeNull();
  });
});

describe("Ledger", () => {
  const html = renderToStaticMarkup(<Ledger entries={entries} busy={false} onOpen={noop} onRelease={noop} />);

  it("is a real table with a caption and the six columns of the spec", () => {
    expect(html).toContain("<caption");
    for (const h of ["Entry", "Kind", "Written by", "Untrusted origins", "State"]) expect(html).toContain(`>${h}<`);
    expect(html.match(/<tbody>/g)).toHaveLength(1);
    expect(html.match(/pw-ledger__row/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("states quarantine as a word with its id and a lock, and an active entry as a word", () => {
    expect(html).toContain("QUARANTINED");
    expect(html).toContain("ACTIVE");
    expect(html.match(/pw-ledger__qid/g)).toHaveLength(2);
    expect(html).toContain("pw-status--block");
  });

  it("names the untrusted origins, or says none", () => {
    expect(text(html)).toContain("src:issue:42");
    expect(text(html)).toContain("none");
  });

  it("offers a release that names the quarantine, only for sealed entries", () => {
    expect(html.match(/Release quarantine q-0001…/g)).toHaveLength(2);
    expect(html.match(/pw-btn--danger/g)).toHaveLength(3);
  });

  it("disables a release that cannot work and says why in visible text, not a tooltip", () => {
    expect(text(html)).toContain("The quarantine id is unknown (the API was restarted). Run forensics again to re-quarantine.");
    expect(html).not.toContain("title=");
    const disabled = html.match(/<button[^>]*disabled=""[^>]*>[^<]*Release quarantine…/g) ?? [];
    expect(disabled).toHaveLength(1);
  });

  it("labels every cell so a phone can show a stacked card", () => {
    for (const label of ["Entry", "Kind", "Written by", "Untrusted origins", "State", "Action"]) expect(html).toContain(`data-label="${label}"`);
    const css = readFileSync(new URL("./memory.css", import.meta.url), "utf8");
    expect(css).toContain("content: attr(data-label)");
  });

  it("disables every release while a request is in flight", () => {
    const busy = renderToStaticMarkup(<Ledger entries={entries} busy onOpen={noop} onRelease={noop} />);
    expect(busy.match(/<button[^>]*disabled=""[^>]*>[^<]*Release quarantine/g)).toHaveLength(3);
  });
});
