import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OutcomeStrip, presentOutcome } from "./OutcomeStrip";
import type { Outcome, OutcomeKind } from "./runLogic";

const outcome = (kind: OutcomeKind, over: Partial<Outcome> = {}): Outcome => ({ kind, actionId: "act-0001", reason: "TRIFECTA", status: kind, ...over });
const KINDS: OutcomeKind[] = ["held", "blocked", "leaked", "posted", "posted_warning", "posted_unguarded", "nothing", "other"];

describe("presentOutcome", () => {
  it.each(KINDS)("gives %s a word, a family, an icon and a sentence", (kind) => {
    const p = presentOutcome(outcome(kind));
    expect(p.word).not.toBe("");
    expect(["hold", "block", "allow", "neutral"]).toContain(p.family);
    expect(p.icon).toBeTruthy();
    expect(p.text.length).toBeGreaterThan(10);
    expect(p.text).not.toContain("undefined");
    expect(p.text).not.toContain("null");
  });

  it("names the verdict words exactly", () => {
    expect(presentOutcome(outcome("held")).word).toBe("HELD");
    expect(presentOutcome(outcome("blocked")).word).toBe("BLOCKED");
    expect(presentOutcome(outcome("leaked", { reason: "GUARD_OFF" })).word).toBe("LEAKED");
    expect(presentOutcome(outcome("posted", { reason: "CLEAN" })).word).toBe("POSTED");
  });

  it("explains a TRIFECTA hold and falls back to a closed-by-default sentence for other reasons", () => {
    expect(presentOutcome(outcome("held")).text).toContain("untrusted input and from a secret");
    expect(presentOutcome(outcome("held", { reason: "MISSING_PROVENANCE" })).text).toContain("fails closed");
  });

  it("says the LEAKED sentence is a display check, not a gate verdict", () => {
    expect(presentOutcome(outcome("leaked", { reason: "GUARD_OFF" })).text).toContain("display check");
  });

  it("shows an unknown status in capitals instead of guessing", () => {
    expect(presentOutcome(outcome("other", { status: "weird" })).word).toBe("WEIRD");
  });

  it("says nothing was proposed without an action id", () => {
    const p = presentOutcome({ kind: "nothing", actionId: null, reason: null, status: null });
    expect(p.text).toContain("never asked to post");
  });
});

describe("OutcomeStrip", () => {
  const html = (o: Outcome, href: string | null): string => renderToStaticMarkup(<OutcomeStrip outcome={o} caseHref={href} onOpenCase={() => undefined} />);

  it("links to the case of a held action with a real href", () => {
    const out = html(outcome("held"), "?tab=investigate&action=act-0001");
    expect(out).toContain('href="?tab=investigate&amp;action=act-0001"');
    expect(out).toContain("Open case act-0001");
  });

  it("has no link when the caller gives none (a run that was allowed)", () => {
    expect(html(outcome("posted", { reason: "CLEAN" }), null)).not.toContain("Open case");
  });

  it("is labelled by its own heading and the heading can take focus from script", () => {
    const out = html(outcome("held"), null);
    expect(out).toContain('aria-labelledby="pw-outcome-title"');
    expect(out).toContain('tabindex="-1"');
  });
});
