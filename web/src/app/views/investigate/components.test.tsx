import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ActionListItem } from "../../../api/types";
import type { PathStep } from "./caseLogic";
import { PayloadDiff } from "./PayloadDiff";
import { ReviewQueue } from "./ReviewQueue";
import { WitnessPaths } from "./WitnessPaths";

const noop = (): void => undefined;
const text = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const step = (over: Partial<PathStep> & { id: string }): PathStep => ({ label: over.id, isSource: false, tags: [], ...over });

describe("PayloadDiff", () => {
  const held = { id: "a-0010", content: "## Release notes\nPORT=8080\nDEPLOY_TOKEN=PWDEMO-TOKEN-b81e44d0-NOT-A-REAL-KEY", error: null };
  const healed = { id: "a-sbx-0003", content: "## Release notes", error: null };

  it("marks a removed line with a gutter sign and a hidden word, never colour alone", () => {
    const html = renderToStaticMarkup(<PayloadDiff held={held} healed={healed} />);
    expect(html).toContain("pw-diff__line--removed");
    expect(html).toContain(">−<");
    expect(html).toContain("removed: ");
    expect(html).toContain('aria-hidden="true"');
  });

  it("flags a removed line that holds a secret value", () => {
    const html = renderToStaticMarkup(<PayloadDiff held={held} healed={healed} />);
    expect(text(html)).toContain("secret value");
    expect(html.match(/pw-release__flag/g)).toHaveLength(1);
  });

  it("shows the other side when one payload could not be loaded, and says why", () => {
    const html = renderToStaticMarkup(<PayloadDiff held={held} healed={{ id: "a-sbx-0003", content: null, error: "Not found" }} />);
    expect(text(html)).toContain("Could not load this payload: Not found");
    expect(text(html)).toContain("PORT=8080");
    expect(html).not.toContain("pw-diff__line--removed");
  });
});

describe("WitnessPaths", () => {
  const untrusted = [step({ id: "a-0010", label: "changelog:42" }), step({ id: "src:issue:42", isSource: true, tags: ["untrusted"] })];
  const queries = { q2a_untrusted_witness: "MATCH (n) RETURN n", q2b_secret_witness: "MATCH (m) RETURN m" };

  it("names each path in words, with its step count and the query that computed it", () => {
    const html = renderToStaticMarkup(<WitnessPaths untrusted={untrusted} secret={[step({ id: "src:env:T", isSource: true })]} queries={queries} />);
    const t = text(html);
    expect(t).toContain("Untrusted path");
    expect(t).toContain("Secret path");
    expect(t).toContain("1 step ·");
    expect(t).toContain("computed by q2a_untrusted_witness");
    expect(t).toContain("computed by q2b_secret_witness");
    expect(html).toContain("MATCH (n) RETURN n");
  });

  it("says plainly when there is no path instead of drawing an empty one", () => {
    const html = renderToStaticMarkup(<WitnessPaths untrusted={[]} secret={[]} queries={{}} />);
    expect(text(html)).toContain("No untrusted path");
    expect(text(html)).toContain("No secret path");
    expect(html).not.toContain("pw-path__steps");
  });

  it("repeats the id after a key people know, and omits it when the label is the id", () => {
    const html = renderToStaticMarkup(<WitnessPaths untrusted={untrusted} secret={[]} queries={queries} />);
    expect(html).toContain('<code class="pw-step__id">a-0010</code>');
    expect(html.match(/pw-step__id/g)).toHaveLength(1);
  });
});

describe("ReviewQueue", () => {
  const list: ActionListItem[] = [
    { id: "act-0001", status: "superseded", payload_id: "a-0010" },
    { id: "act-0002", status: "held", payload_id: "a-0013" },
  ];

  it("groups by what needs a person and marks the open case", () => {
    const html = renderToStaticMarkup(<ReviewQueue actions={list} workspace="tinyqueue" selected="act-0002" onSelect={noop} onRun={noop} />);
    expect(text(html)).toContain("Needs a decision (1)");
    expect(text(html)).toContain("Resolved (1)");
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });

  it("offers to run the attack when the workspace has no actions", () => {
    const html = renderToStaticMarkup(<ReviewQueue actions={[]} workspace="tinyqueue" selected={null} onSelect={noop} onRun={noop} />);
    expect(text(html)).toContain("No actions in tinyqueue yet");
    expect(text(html)).toContain("Run attack_pipeline_42");
  });

  it("shows a placeholder, not an empty state, while the list loads", () => {
    const html = renderToStaticMarkup(<ReviewQueue actions={null} workspace="tinyqueue" selected={null} onSelect={noop} onRun={noop} />);
    expect(text(html)).not.toContain("No actions");
  });
});

describe("investigate.css", () => {
  const css = readFileSync(new URL("./investigate.css", import.meta.url), "utf8");

  it("pins every grid column to minmax(0, 1fr) so long ids cannot widen the page", () => {
    for (const sel of [".pw-case", ".pw-case__main", ".pw-case__section", ".pw-paths", ".pw-diff"]) {
      const block = css.slice(css.indexOf(`${sel} {`));
      expect(block.slice(0, block.indexOf("}"))).toContain("grid-template-columns: minmax(0, 1fr)");
    }
  });

  it("tells untrusted from secret by line style as well as colour", () => {
    expect(css).toMatch(/\.pw-path--untrusted\s*\{[^}]*border-left: 4px solid/);
    expect(css).toMatch(/\.pw-path--secret\s*\{[^}]*border-left: 4px dotted/);
  });
});
