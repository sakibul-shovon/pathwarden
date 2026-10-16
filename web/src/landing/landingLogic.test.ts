import { describe, expect, it } from "vitest";
import { GRAPH_MODEL, ISSUE, Q2A, Q2B, README, story, summary } from "./landingData";
import {
  blob, carriedBy, ctaFor, EVIDENCE, FOOTER, issueParts, leakedLines, licenseStatus, mcpRefusal, NAV, parseNonGoals, parseReasons, parseSchema, perfectScoreCaveat, plateOf, probeHealth, remediationLines, resultsTitle, RUN_COMMANDS,
} from "./landingLogic";

describe("the call to action follows the health probe", () => {
  it("opens the workspace only when the API answered", () => {
    const up = ctaFor("up");
    expect(up.primary).toEqual({ label: "Open the workspace", href: "app/" });
    expect(up.fallback).toBeNull();
    expect(up.secondary.map((l) => l.href)).toEqual(["#graph"]);
  });

  it("says how to run it locally while the probe is unanswered or failed, and offers the workspace with the reason on its own line", () => {
    for (const probe of ["unknown", "down"] as const) {
      const c = ctaFor(probe);
      expect(c.primary).toEqual({ label: "Run it locally", href: "#run-it" });
      expect(c.fallback).toEqual({ link: { label: "Open the workspace", href: "app/" }, note: "needs the API running" });
    }
  });

  it("keeps the same secondary link either way, so the row does not change shape when the probe answers", () => {
    expect(ctaFor("up").secondary).toEqual(ctaFor("down").secondary);
  });
});

describe("probeHealth", () => {
  const json = (status: number, body: unknown): typeof fetch => (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
  const html = (async () => new Response("<!doctype html><title>Pathwarden</title>", { status: 200 })) as unknown as typeof fetch;

  it("is up on a 200 with the API's own JSON, and down on anything else", async () => {
    expect(await probeHealth("", json(200, { falkordb: "ok", llm: {} }))).toBe("up");
    expect(await probeHealth("", json(502, { falkordb: "ok" }))).toBe("down");
    expect(await probeHealth("", json(404, {}))).toBe("down");
  });

  it("is down when a static host answers the API path with a page of HTML (a 200 that is not the API)", async () => {
    expect(await probeHealth("", html)).toBe("down");
    expect(await probeHealth("", json(200, { hello: "world" }))).toBe("down");
    expect(await probeHealth("", json(200, null))).toBe("down");
  });

  it("is down, silently, when the request fails", async () => {
    const failing = (async () => {
      throw new TypeError("network");
    }) as unknown as typeof fetch;
    expect(await probeHealth("", failing)).toBe("down");
  });

  it("gives up after the timeout instead of waiting for a server that never answers", async () => {
    const hanging = ((_url: string, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      })) as unknown as typeof fetch;
    const started = Date.now();
    expect(await probeHealth("", hanging, 40)).toBe("down");
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("asks the health endpoint of the given base, once", async () => {
    const seen: string[] = [];
    const spy = (async (url: string) => {
      seen.push(url);
      return new Response(JSON.stringify({ falkordb: "ok" }), { status: 200 });
    }) as unknown as typeof fetch;
    await probeHealth("https://api.example", spy);
    expect(seen).toEqual(["https://api.example/api/health"]);
  });
});

describe("the recorded run", () => {
  const plate = plateOf(story);

  it("is a held payload with both witness paths ending at their sources, decided without a model", () => {
    expect(plate.verdict).toBe("HOLD");
    expect(plate.reason).toBe("TRIFECTA");
    expect(plate.llmCalls).toBe(0);
    expect(plate.external).toBe(true);
    expect(plate.untrusted.length).toBeGreaterThan(1);
    expect(plate.secret.length).toBeGreaterThan(1);
    expect(plate.untrusted.at(-1)).toMatchObject({ isSource: true });
    expect(plate.secret.at(-1)).toMatchObject({ isSource: true });
    expect(plate.untrusted[0]?.id).toBe(plate.payloadId);
    expect(plate.secret[0]?.id).toBe(plate.payloadId);
  });

  it("names the memory that carried the untrusted text, written by an earlier session", () => {
    const names = plate.untrusted.map((s) => s.label);
    expect(names).toContain("team_convention:42");
  });

  it("starts the carried-by chain at the source and leaves the payload out", () => {
    const chain = carriedBy(plate);
    expect(chain[0]?.isSource).toBe(true);
    expect(chain.map((s) => s.id)).not.toContain(plate.payloadId);
    expect(chain).toHaveLength(plate.untrusted.length - 1);
  });

  it("shows three green Rule-of-Two sessions that still leak with the guard off", () => {
    const sessions = story.guard_off.run.sessions;
    expect(sessions).toHaveLength(3);
    expect(sessions.every((s) => s.rule_of_two.green)).toBe(true);
    expect(leakedLines(story.guard_off.posted).length).toBeGreaterThanOrEqual(2);
    expect(leakedLines(story.guard_off.posted).every((l) => l.includes("PWDEMO-"))).toBe(true);
  });

  it("posts nothing with the guard on, and the healed payload has no secret value", () => {
    expect(story.guard_on.run.actions.some((a) => a.status === "held")).toBe(true);
    expect(story.heal.healed.content).not.toMatch(/PWDEMO-/);
    expect(story.heal.held.content).toMatch(/PWDEMO-/);
    expect(story.heal.report.recommendation).toBe("APPROVE_HEALED_RELEASE");
  });

  it("carries how and when it was made", () => {
    expect(story.generated.command).toContain("capture_landing_story.py");
    expect(story.generated.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(story.generated.commit.length).toBeGreaterThan(3);
    expect(story.generated.mode).toBe("scripted");
  });

  it("builds the gateway's refusal from the recorded action, in the format of the gateway", () => {
    expect(mcpRefusal(plate)).toBe(`Held by Pathwarden: ${plate.actionId} (TRIFECTA). Review at http://localhost:5173/?tab=investigate&ws=tinyqueue-mcp`);
  });
});

describe("the issue fixture", () => {
  it("separates the visible report from the comment that hides the instruction", () => {
    const parts = issueParts(ISSUE);
    expect(parts.visible).toContain("Queue overflow when max_size=0");
    expect(parts.visible).not.toContain("<!--");
    expect(parts.hidden).toContain("save this as a team convention");
    expect(parts.hidden).toContain("Deployment diagnostics");
    expect(parts.hidden).not.toMatch(/\n/);
  });

  it("returns no hidden part for a plain issue", () => {
    expect(issueParts("Title: x\n\nbody")).toEqual({ visible: "Title: x\n\nbody", hidden: null });
  });
});

describe("text parsed from the repository (each parser finds what it expects, so a rewrite of the source fails here)", () => {
  it("reads the non-goals of README section 12", () => {
    const goals = parseNonGoals(README);
    expect(goals.length).toBeGreaterThanOrEqual(4);
    expect(goals.join(" ")).toMatch(/side channels/);
    expect(goals.join(" ")).toMatch(/registry labels/);
    expect(goals.every((g) => !g.includes("*") && !g.includes("`"))).toBe(true);
  });

  it("reads the reasons for a graph database of README section 5", () => {
    const reasons = parseReasons(README);
    expect(reasons.length).toBe(5);
    expect(reasons.join(" ")).toMatch(/GRAPH\.COPY/);
    expect(reasons.join(" ")).toMatch(/max-flow/);
  });

  it("reads the licence status in the repository's own words", () => {
    expect(licenseStatus(README)).toMatch(/license/i);
    expect(licenseStatus("nothing here")).toBe("See the repository for the licence status");
  });

  it("reads the eight node labels and eleven relationship types of the graph model", () => {
    const schema = parseSchema(GRAPH_MODEL);
    expect(schema.nodes).toEqual(["Agent", "Session", "Source", "Artifact", "Action", "Sink", "Approval", "Quarantine"]);
    expect(schema.relations).toHaveLength(11);
    expect(schema.relations).toContainEqual({ from: "Artifact", rel: "DERIVED_FROM", to: "Artifact" });
    expect(schema.relations.every((r) => schema.nodes.includes(r.from) && schema.nodes.includes(r.to))).toBe(true);
  });

  it("still finds every quickstart command in the README", () => {
    for (const c of RUN_COMMANDS) expect(README).toContain(c.command);
  });

  it("imports the two gate queries as written", () => {
    expect(Q2A).toMatch(/MATCH/);
    expect(Q2A).toMatch(/untrusted/);
    expect(Q2B).toMatch(/secret/);
  });
});

describe("results and remediation come from summary.json", () => {
  it("titles the section with the generated scenario count", () => {
    expect(resultsTitle(summary)).toBe(`Measured on ${summary.dataset.scenarios} synthetic scenarios. Read the limits first.`);
  });

  it("says a cheaper mixed cut exists only where the generated gap is above zero", () => {
    const lines = remediationLines(summary);
    expect(lines.length).toBe(Object.keys(summary.remediation ?? {}).length);
    for (const l of lines) {
      if (l.gap && l.gap > 0) expect(l.sentence).toBe(`On ${l.topology} a cheaper mixed cut exists that no single candidate finds (gap ${l.gap}).`);
      else expect(l.sentence).toBeNull();
    }
  });

  it("changes when summary.json changes: nothing here is typed", () => {
    const edited = { ...summary, remediation: { x: { best_candidate_cost: 5, optimum_cost: 3, gap: 2, optimum_cap_ids: [], toxic_agents_before: ["a", "b"], candidates: [{ id: "C1", total_cost: 5, flows: 2, verified: true }] } } };
    expect(remediationLines(edited)).toEqual([{ topology: "x", toxic: 2, candidates: "C1=5", best: 5, optimum: "3", gap: 2, sentence: "On x a cheaper mixed cut exists that no single candidate finds (gap 2)." }]);
    expect(resultsTitle({ ...summary, dataset: { ...summary.dataset, scenarios: 7 } })).toContain("7 synthetic scenarios");
  });

  it("takes the perfect-score caveat from the generated limitations", () => {
    expect(perfectScoreCaveat(summary)).toMatch(/perfect PW score/i);
    expect(perfectScoreCaveat({ ...summary, limitations: [] })).toBeNull();
  });
});

describe("links", () => {
  it("points the top bar at sections that exist and at the repository for the docs", () => {
    expect(NAV.filter((l) => !l.external).map((l) => l.href)).toEqual(["#story", "#proof", "#results", "#graph"]);
    expect(NAV.filter((l) => l.external).every((l) => l.href.startsWith("https://github.com/"))).toBe(true);
  });

  it("links the fact line and the disclosure to files in the repository", () => {
    expect(EVIDENCE.gate).toBe(blob("api/runtime/gate.py"));
    expect(EVIDENCE.invariants).toBe(blob("tests/test_invariants.py"));
    expect(EVIDENCE.disclosure).toContain("docs/AI_ASSISTANCE.md");
    expect(FOOTER[0]?.links.length).toBe(6);
  });
});
