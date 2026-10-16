import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { AgentWitness, Candidate, CapEdge, CapNode } from "../../../api/types";
import { AgentInspector } from "./AgentInspector";
import { CapabilityTable } from "./CapabilityTable";
import { CutComparison } from "./CutComparison";

const noop = (): void => undefined;
const text = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const cand = (over: Partial<Candidate> & { id: string }): Candidate => ({
  name: "cut", cap_ids: ["a->b"], edges: [{ cap_id: "a->b", src: "a", dst: "b", cost: 3 }], total_cost: 3, max_flow: 3, invalid_reason: null, needs_cut: true, verified: true, description: "", ...over,
});

const candidates: Candidate[] = [
  cand({ id: "C1", name: "untrusted → external sinks", total_cost: 17, cap_ids: ["a->b", "b->c"] }),
  cand({ id: "C2", name: "secrets → external sinks", total_cost: 12, verified: false, invalid_reason: "toxic agent remains: hr_agent" }),
  cand({ id: "C3", name: "untrusted → toxic agents that touch secrets", total_cost: 16, description: "cuts the inbound flows of the four toxic agents" }),
  cand({ id: "C4", name: "nothing", total_cost: 0, needs_cut: false }),
];

describe("CutComparison", () => {
  const render = (over: Partial<Parameters<typeof CutComparison>[0]> = {}): string =>
    renderToStaticMarkup(<CutComparison candidates={candidates} best={candidates[2]} preview={null} busy={false} optimum={null} onPreview={noop} onApply={noop} {...over} />);

  it("says what to do before cuts were suggested", () => {
    expect(text(render({ candidates: null }))).toBe("Suggest cuts to compare four complete fixes.");
  });

  it("lists the candidates in the order the API returned them, with cost as a number and as a bar", () => {
    const t = text(render());
    expect(t.indexOf("C1")).toBeLessThan(t.indexOf("C2"));
    expect(t.indexOf("C3")).toBeLessThan(t.indexOf("C4"));
    expect(t).toContain("17");
    expect(t).toContain("max flow 3");
    expect(render().match(/pw-cuts__bar/g)).toHaveLength(4);
    expect(render()).toContain('class="pw-cuts__bar" aria-hidden="true"');
  });

  it("marks the cheapest verified candidate in words, once", () => {
    expect(render().match(/Cheapest verified/g)).toHaveLength(1);
    expect(render({ best: undefined })).not.toContain("Cheapest verified");
  });

  it("states verification as a word with an icon, and gives the reason a candidate cannot be applied without hovering", () => {
    const html = render();
    expect(html.match(/VERIFIED/g)?.length).toBeGreaterThanOrEqual(3);
    expect(html).toContain("NOT VERIFIED");
    expect(text(html)).toContain("Not verified: toxic agent remains: hr_agent");
    expect(text(html)).toContain("Nothing to cut: no agent is toxic.");
    expect(html).not.toContain("title=");
  });

  it("disables Apply exactly when the candidate is not verified or needs no cut", () => {
    const html = render();
    const apply = html.match(/<button[^>]*>Apply…<\/button>/g) ?? [];
    expect(apply).toHaveLength(4);
    expect(apply.map((b) => b.includes('disabled=""'))).toEqual([false, true, false, true]);
  });

  it("disables every Apply while a request is in flight", () => {
    const apply = render({ busy: true }).match(/<button[^>]*>Apply…<\/button>/g) ?? [];
    expect(apply.every((b) => b.includes('disabled=""'))).toBe(true);
  });

  it("offers Preview, and says Hide for the one being previewed", () => {
    expect(render().match(/Preview cut/g)).toHaveLength(4);
    const html = render({ preview: "C3" });
    expect(html.match(/Hide cut/g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true"');
  });

  it("shows the optimum sentence it is given and nothing else about optimality", () => {
    expect(text(render({ optimum: "Exhaustive optimum from the last make eval: 14; best candidate 16." }))).toContain("Exhaustive optimum from the last make eval: 14");
    expect(text(render())).not.toContain("Exhaustive optimum");
  });

  it("labels every cell so a phone can show a stacked card", () => {
    for (const label of ["Candidate", "Cost", "Flows", "Verified", "Actions"]) expect(render()).toContain(`data-label="${label}"`);
    expect(readFileSync(new URL("./remediate.css", import.meta.url), "utf8")).toContain("content: attr(data-label)");
  });
});

describe("AgentInspector", () => {
  const witness: AgentWitness = { agent: "billing", toxic: true, from_untrusted: ["inbox", "billing"], from_secret: ["crm", "billing"], to_external: [] };

  it("invites a selection when there is none", () => {
    expect(text(renderToStaticMarkup(<AgentInspector selected={null} witness={null} />))).toContain("Select an agent");
  });

  it("states toxicity in words and the three paths on one line each", () => {
    const t = text(renderToStaticMarkup(<AgentInspector selected="billing" witness={witness} />));
    expect(t).toContain("billing");
    expect(t).toContain("TOXIC");
    expect(t).toContain("inbox → billing");
    expect(t).toContain("crm → billing");
    expect(t).toContain("Can reach outside through none");
  });

  it("does not show the previous agent's witness under the new name while it loads", () => {
    const t = text(renderToStaticMarkup(<AgentInspector selected="hr" witness={witness} />));
    expect(t).toContain("Loading the witness for hr…");
    expect(t).not.toContain("inbox → billing");
  });

  it("says not toxic in words", () => {
    expect(text(renderToStaticMarkup(<AgentInspector selected="audit" witness={{ ...witness, agent: "audit", toxic: false }} />))).toContain("not toxic");
  });
});

describe("CapabilityTable", () => {
  const nodes: CapNode[] = [
    { name: "inbox", kind: "source", trust: "untrusted", external: null, toxic: false },
    { name: "billing", kind: "agent", trust: null, external: null, toxic: true },
    { name: "mail", kind: "sink", trust: null, external: true, toxic: false },
  ];
  const edges: CapEdge[] = [
    { src: "inbox", dst: "billing", cap_id: "inbox->billing", cost: 4, revoked: false },
    { src: "billing", dst: "mail", cap_id: "billing->mail", cost: 6, revoked: true },
  ];
  const html = renderToStaticMarkup(<CapabilityTable nodes={nodes} edges={edges} selected="billing" onSelect={noop} />);

  it("is the same graph as two named tables, with toxicity and revocation as words", () => {
    expect(html).toContain("Nodes of the capability graph");
    expect(html).toContain("Flows of the capability graph");
    expect(text(html)).toContain("TOXIC");
    expect(text(html)).toContain("revoked");
    expect(text(html)).toContain("external");
  });

  it("lets an agent be chosen without the canvas, and only agents", () => {
    expect(html.match(/>Why\?</g)).toHaveLength(1);
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-selected="true"');
  });
});
