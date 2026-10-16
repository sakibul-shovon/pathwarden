import { readdirSync, readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { story, summary } from "./landingData";
import { plateOf } from "./landingLogic";
import { Footer } from "./sections/Footer";
import { Heal } from "./sections/Heal";
import { Hero } from "./sections/Hero";
import { Limits, RunIt } from "./sections/LimitsRun";
import { Mcp } from "./sections/Mcp";
import { Problem } from "./sections/Problem";
import { Remediate } from "./sections/Remediate";
import { Results } from "./sections/Results";
import { TopBar } from "./sections/TopBar";
import { WhyGraph } from "./sections/WhyGraph";
import { WitnessPlate } from "./sections/WitnessPlate";

const text = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const plate = plateOf(story);

describe("hero", () => {
  it("opens the workspace when the API answered, and says how to run it locally otherwise", () => {
    const up = renderToStaticMarkup(<Hero probe="up" plate={plate} scenario={story.scenario} />);
    expect(up).toMatch(/<a class="pw-btn pw-btn--primary pw-ctabtn" href="app\/">Open the workspace<\/a>/);
    expect(text(up)).not.toContain("needs the API running");
    for (const probe of ["unknown", "down"] as const) {
      const down = renderToStaticMarkup(<Hero probe={probe} plate={plate} scenario={story.scenario} />);
      expect(down).toMatch(/<a class="pw-btn pw-btn--primary pw-ctabtn" href="#run-it">Run it locally<\/a>/);
      expect(text(down)).toContain("Open the workspace (needs the API running)");
    }
  });

  it("reserves the line for the fallback either way, so the page does not move when the probe answers", () => {
    for (const probe of ["up", "down"] as const) expect(renderToStaticMarkup(<Hero probe={probe} plate={plate} scenario={story.scenario} />)).toContain('class="pw-hero__fallback"');
    expect(renderToStaticMarkup(<Hero probe="up" plate={plate} scenario={story.scenario} />)).toMatch(/class="pw-hero__fallback"><\/p>/);
  });

  it("states the problem and the mechanism, with the decision's LLM calls from the recording", () => {
    const html = renderToStaticMarkup(<Hero probe="down" plate={plate} scenario={story.scenario} />);
    expect(text(html)).toContain("Every agent passes its safety check. The system still leaks.");
    expect(text(html)).toContain("two path queries ask one question");
    expect(text(html)).toContain(`${plate.llmCalls} LLM calls per decision`);
    expect(html).toContain("<h1");
  });

  it("links each fact to its evidence in the repository", () => {
    const html = renderToStaticMarkup(<Hero probe="up" plate={plate} scenario={story.scenario} />);
    expect(html).toContain("api/runtime/gate.py");
    expect(html).toContain("tests/test_invariants.py");
    expect(html.match(/rel="noreferrer noopener"/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe("FIG. 1", () => {
  const html = renderToStaticMarkup(<WitnessPlate plate={plate} scenario={story.scenario} />);

  it("draws both recorded rails and the gate bar, and is static", () => {
    expect(text(html)).toContain("Untrusted path");
    expect(text(html)).toContain("Secret path");
    expect(text(html)).toContain("team_convention:42");
    expect(text(html)).toContain(`${plate.verdict} · ${plate.reason}`);
    expect(text(html)).toContain(plate.sink);
    expect(html).not.toContain("<button");
  });

  it("captions itself with the recorded action, the scenario and the two queries", () => {
    expect(text(html)).toContain(`FIG. 1 Lineage of ${plate.actionId}`);
    expect(text(html)).toContain(story.scenario);
    expect(text(html)).toContain("q2a_untrusted_witness");
    expect(text(html)).toContain("q2b_secret_witness");
  });
});

describe("the sections", () => {
  it("shows the problem with the recorded sessions, the quote and the leaked page", () => {
    const t = text(renderToStaticMarkup(<Problem story={story} />));
    expect(t).toContain("It's in the path between them");
    expect(t).toContain("must satisfy no more than two");
    expect(t).toContain("secret value");
    expect(t).toContain("PWDEMO-");
    for (const agent of ["Triage", "Fixer", "Release"]) expect(t).toContain(agent);
  });

  it("states the repair path with the recorded quarantine and a human release", () => {
    const html = renderToStaticMarkup(<Heal story={story} />);
    expect(text(html)).toContain(`quarantine ${story.heal.report.quarantine_id} sealed ${story.heal.report.quarantined_artifacts.length} artifacts`);
    expect(text(html)).toContain("Pathwarden never releases on its own");
    expect(html).toContain("pw-diff");
  });

  it("builds the remediation table from the generated summary", () => {
    const t = text(renderToStaticMarkup(<Remediate summary={summary} />));
    for (const topology of Object.keys(summary.remediation ?? {})) expect(t).toContain(topology);
    expect(t).toContain("algo.maxFlow");
  });

  it("quotes the gateway's tool error filled in from the recording", () => {
    const t = text(renderToStaticMarkup(<Mcp plate={plate} />));
    expect(t).toContain(`Held by Pathwarden: ${plate.actionId} (${plate.reason}). Review at`);
    expect(t).toContain("scripted");
  });

  it("presents the generated results, the criteria as generated and the limitations verbatim", () => {
    const html = renderToStaticMarkup(<Results summary={summary} />);
    expect(text(html)).toContain(`Measured on ${summary.dataset.scenarios} synthetic scenarios. Read the limits first.`);
    for (const c of summary.falsification_criteria) expect(text(html)).toContain(c.status);
    for (const l of summary.limitations) expect(text(html)).toContain(l);
    expect(html.match(/class="pw-chart__svg"/g)).toHaveLength(2);
  });

  it("explains why a graph with the README's reasons, the schema and the two queries", () => {
    const html = renderToStaticMarkup(<WhyGraph />);
    expect(text(html)).toContain("GRAPH.COPY");
    expect(text(html)).toContain("8 node labels and 11 relationship types");
    expect(html).toContain("<details");
    expect(html).toContain("MATCH");
  });

  it("lists what it does not claim, from the README", () => {
    const t = text(renderToStaticMarkup(<Limits summary={summary} />));
    expect(t).toContain("side channels outside the runtime and the gateway");
    expect(t).toContain("wrong registry labels");
    expect(t).toMatch(/perfect PW score/i);
  });

  it("gives the four quickstart commands with a copy button each", () => {
    const html = renderToStaticMarkup(<RunIt probe="down" />);
    for (const c of ["make setup", "make up", "make demo", "make web"]) expect(html).toContain(c);
    expect(html.match(/pw-code__copy/g)).toHaveLength(4);
    expect(text(html)).toContain("No API key, no account.");
  });
});

describe("navigation and footer", () => {
  it("offers the sections and a call to action that follows the probe", () => {
    const html = renderToStaticMarkup(<TopBar probe="down" />);
    for (const id of ["#story", "#proof", "#results", "#graph"]) expect(html).toContain(`href="${id}"`);
    expect(html).toContain("Run it locally");
    expect(html).toContain("<details");
    expect(renderToStaticMarkup(<TopBar probe="up" />)).toContain("Open the workspace");
  });

  it("warns that an external link opens a new tab, in text", () => {
    expect(renderToStaticMarkup(<TopBar probe="up" />)).toContain("(opens in a new tab)");
    expect(renderToStaticMarkup(<Footer generated="x" />)).toContain("(opens in a new tab)");
  });

  it("states the licence status in the repository's own words and says the data is synthetic", () => {
    const t = text(renderToStaticMarkup(<Footer generated="2026-10-16 from commit abc" />));
    expect(t).toMatch(/Licence: No license/i);
    expect(t).toContain("All data is synthetic");
    expect(t).toContain("Track 01 and Track 02");
    expect(t).toContain("AI-assistance disclosure");
    expect(t).toContain("recorded 2026-10-16 from commit abc");
  });
});

describe("nothing is typed", () => {
  const dir = new URL("./", import.meta.url);
  const sources = [
    ...readdirSync(new URL("./sections/", dir)).map((f) => ["sections/" + f, readFileSync(new URL("./sections/" + f, dir), "utf8")] as const),
    ["Landing.tsx", readFileSync(new URL("./Landing.tsx", dir), "utf8")] as const,
    ["landingLogic.ts", readFileSync(new URL("./landingLogic.ts", dir), "utf8")] as const,
  ];

  it("has no evaluation number or interval written into the landing source", () => {
    const forbidden = [/\b20261015\b/, /\b100\.0%/, /\b40\.0%/, /\b73\.3%/, /\b94\.0%/, /\b28\.6%/, /\b60\/60\b/, /\b24\/60\b/];
    for (const [file, src] of sources) for (const re of forbidden) expect(src, `${file} contains ${re}`).not.toMatch(re);
  });

  it("does not claim open source, a testimonial or a sponsor", () => {
    for (const [file, src] of sources) {
      expect(src, file).not.toMatch(/open[- ]source/i);
      expect(src, file).not.toMatch(/testimonial|trusted by|as seen in/i);
    }
  });

  it("does not hard-code a scenario count, an action id or a verdict", () => {
    for (const [file, src] of sources) {
      expect(src, file).not.toMatch(/act-0001|a-0010|120 (synthetic )?scenarios/);
    }
  });
});
