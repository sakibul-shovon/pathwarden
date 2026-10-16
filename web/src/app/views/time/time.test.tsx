import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GraphAt, LineageNode } from "../../../api/types";
import { FactsPanel } from "./FactsPanel";
import { Scrubber } from "./Scrubber";
import { markerViews } from "./timeLogic";

const noop = (): void => undefined;
const text = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/&#x27;/g, "'").replace(/\s+/g, " ").trim();
const node = (over: Partial<LineageNode> & { id: string }): LineageNode => ({
  label: "Artifact", kind: "raw", trust: null, sanitized: null, approved: null, quarantined: null, agent_id: null, session_id: null, key: null, created_at: null, ...over,
});
const graph = (over: Partial<GraphAt> = {}): GraphAt => ({
  t: 16, max_t: 18, nodes: [node({ id: "a-0013", kind: "draft", key: "changelog:44", agent_id: "fixer", created_at: 16 })], edges: [],
  actions: [{ action_id: "act-0001", status: "held", payload_id: "a-0013" }], doubly_tainted: ["a-0013"],
  markers: { poisoned_memory_written: { t: 4, artifact_id: "a-0003", key: "issue_summary:42" }, draft_doubly_tainted: { t: 16, artifact_id: "a-0013", key: "changelog:44" } },
  ...over,
});

describe("Scrubber", () => {
  const render = (t: number, over: Partial<Parameters<typeof Scrubber>[0]> = {}): string =>
    renderToStaticMarkup(<Scrubber t={t} max={18} markers={markerViews(graph().markers, t, 18)} playing={false} onChange={noop} onJump={noop} onReplay={noop} {...over} />);

  it("is a native range with a spoken value, step buttons and a clock", () => {
    const html = render(16);
    expect(html).toContain('type="range"');
    expect(html).toContain('aria-valuetext="t = 16 of 18"');
    expect(html).toContain('max="18"');
    expect(html).toContain('aria-label="Previous step"');
    expect(html).toContain('aria-label="Next step"');
    expect(text(html)).toContain("t = 16 / 18");
  });

  it("disables the step that is not possible at either end", () => {
    expect(render(0)).toMatch(/aria-label="Previous step"[^>]*disabled=""|disabled=""[^>]*aria-label="Previous step"/);
    expect(render(18)).toMatch(/aria-label="Next step"[^>]*disabled=""|disabled=""[^>]*aria-label="Next step"/);
    expect(render(5)).not.toMatch(/disabled=""[^>]*aria-label="Previous step"/);
  });

  it("makes each story moment a button with its full words and marks the one the scrubber is on", () => {
    const html = render(16);
    expect(text(html)).toContain("Poisoned memory written · t=4 · issue_summary:42");
    expect(text(html)).toContain("Draft doubly tainted · t=16 · changelog:44");
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(text(html)).toContain("● Draft doubly tainted");
  });

  it("disables a marker this run does not have and says so in words", () => {
    const html = renderToStaticMarkup(
      <Scrubber t={0} max={3} markers={markerViews({ poisoned_memory_written: null, draft_doubly_tainted: null }, 0, 3)} playing={false} onChange={noop} onJump={noop} onReplay={noop} />,
    );
    expect(text(html)).toContain("this run has no such moment");
    expect(html.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("offers replay from 0 at either end, continue in the middle, and pause while playing", () => {
    expect(text(render(0))).toContain("Replay from 0");
    expect(text(render(18))).toContain("Replay from 0");
    expect(text(render(7))).toContain("Continue replay");
    expect(text(render(7, { playing: true }))).toContain("Pause replay");
  });

  it("draws a tick for each marker as decoration only", () => {
    const html = render(7);
    expect(html.match(/pw-scrub__tick"/g)).toHaveLength(2);
    expect(html).toMatch(/class="pw-scrub__ticks" aria-hidden="true"/);
  });
});

describe("FactsPanel", () => {
  const render = (g: GraphAt, loadingT: number | null = null): string => renderToStaticMarkup(<FactsPanel graph={g} loadingT={loadingT} onOpenNode={noop} onOpenCase={noop} />);

  it("states the counts, the doubly tainted draft and what was written at this moment", () => {
    const t = text(render(graph()));
    expect(t).toContain("At t = 16");
    expect(t).toContain("1 node · 0 edges · 1 proposed action");
    expect(t).toContain("1 doubly tainted draft");
    expect(t).toContain("changelog:44 a-0013 draft · by fixer");
  });

  it("says nothing was written instead of showing an empty list", () => {
    expect(text(render(graph({ t: 5, nodes: [], doubly_tainted: [] })))).toContain("Nothing: the clock ticks on other events too.");
  });

  it("shows the status of an action as it is now, with a way into its case", () => {
    const t = text(render(graph()));
    expect(t).toContain("act-0001");
    expect(t).toContain("held");
    expect(t).toContain("now");
    expect(t).toContain("Open case");
  });

  it("says the flags are current values, not history", () => {
    expect(text(render(graph()))).toMatch(/show their values now\s*, not as they were at this time/);
  });

  it("keeps the previous frame and says which time is loading", () => {
    expect(text(render(graph(), 17))).toContain("Loading t = 17…");
    expect(text(render(graph(), null))).not.toContain("Loading");
  });

  it("does not warn when the API returned no doubly tainted draft", () => {
    expect(text(render(graph({ doubly_tainted: [] })))).not.toContain("doubly tainted");
  });
});
