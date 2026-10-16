import { describe, expect, it } from "vitest";
import { legacyRedirectTarget } from "./legacyRedirect";

describe("legacyRedirectTarget: every documented link of the old single-page app keeps working", () => {
  it.each([
    "?tab=investigate&ws=tinyqueue-mcp", // what the MCP gateway puts into its tool error
    "?tab=run&scenario=attack_pipeline_42&guard=off&autorun=1",
    "?tab=investigate&autoforensics=1&autoheal=1",
    "?tab=time&t=16",
    "?tab=remediate&topology=tinyqueue3",
    "?ws=tinyqueue-mcp",
    "?key=pwdemo-key-tinyqueue&tab=run", // hosted-mode links
    "?scenario=benign_43",
    "?guard=off",
    "?mode=live",
    "?autorun=1",
  ])("forwards %s to the app with the identical query", (search) => {
    expect(legacyRedirectTarget(search)).toBe(`app/${search}`);
  });

  it("keeps the hash", () => {
    expect(legacyRedirectTarget("?tab=run", "#top")).toBe("app/?tab=run#top");
  });

  it("shows the landing page for a plain visit and for unrelated parameters", () => {
    expect(legacyRedirectTarget("")).toBeNull();
    expect(legacyRedirectTarget("?utm_source=newsletter")).toBeNull();
    expect(legacyRedirectTarget("", "#story")).toBeNull();
  });
});
