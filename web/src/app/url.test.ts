import { describe, expect, it } from "vitest";
import { buildSearch, DEFAULT_SCENARIO, navigateState, parseUrl } from "./url";

describe("parseUrl: the documented deep links keep their meaning", () => {
  it("defaults to the Run tab of the demo workspace", () => {
    expect(parseUrl("")).toMatchObject({
      tab: "run",
      ws: "tinyqueue",
      scenario: DEFAULT_SCENARIO,
      guard: true,
      mode: "scripted",
      autorun: false,
      autoForensics: false,
      autoHeal: false,
      t: null,
      topology: "enterprise12",
      action: null,
    });
  });

  it("reads the full demo-flow link from the P10a evidence", () => {
    const s = parseUrl("?tab=investigate&scenario=attack_pipeline_42&guard=off&autorun=1&autoforensics=1&autoheal=1");
    expect(s).toMatchObject({ tab: "investigate", guard: false, autorun: true, autoForensics: true, autoHeal: true });
  });

  it("reads the link that the MCP gateway puts into its tool error", () => {
    expect(parseUrl("?tab=investigate&ws=tinyqueue-mcp")).toMatchObject({ tab: "investigate", ws: "tinyqueue-mcp" });
  });

  it("reads time travel and remediation links", () => {
    expect(parseUrl("?tab=time&t=16")).toMatchObject({ tab: "time", t: 16 });
    expect(parseUrl("?tab=remediate&topology=tinyqueue3")).toMatchObject({ tab: "remediate", topology: "tinyqueue3" });
  });

  it("only treats mode=live and guard=off as non-default", () => {
    expect(parseUrl("?mode=live").mode).toBe("live");
    expect(parseUrl("?mode=whatever").mode).toBe("scripted");
    expect(parseUrl("?guard=0").guard).toBe(true);
  });

  it("falls back to the Run tab for an unknown tab and ignores a non-numeric t", () => {
    expect(parseUrl("?tab=nope").tab).toBe("run");
    expect(parseUrl("?t=-3").t).toBeNull();
    expect(parseUrl("?t=abc").t).toBeNull();
  });

  it("refuses a workspace or action id that is not a plain identifier", () => {
    expect(parseUrl("?ws=../etc").ws).toBe("tinyqueue");
    expect(parseUrl("?ws=UPPER").ws).toBe("tinyqueue");
    expect(parseUrl("?action=act-0001<script>").action).toBeNull();
    expect(parseUrl("?action=act-0001").action).toBe("act-0001");
  });
});

describe("buildSearch", () => {
  it("writes only what differs from the defaults and never the one-shot flags", () => {
    const state = parseUrl("?tab=run&autorun=1&autoforensics=1&autoheal=1");
    expect(buildSearch(state)).toBe("?tab=run");
  });

  it("writes the state that belongs to the open view", () => {
    expect(buildSearch(parseUrl("?tab=investigate&action=act-0002"))).toBe("?tab=investigate&action=act-0002");
    expect(buildSearch(parseUrl("?tab=time&t=16"))).toBe("?tab=time&t=16");
    expect(buildSearch(parseUrl("?tab=remediate&topology=tinyqueue3"))).toBe("?tab=remediate&topology=tinyqueue3");
    expect(buildSearch(parseUrl("?tab=run&scenario=benign_43&guard=off&mode=live"))).toBe(
      "?tab=run&scenario=benign_43&guard=off&mode=live",
    );
  });

  it("keeps a non-default workspace and drops state of other views", () => {
    expect(buildSearch(parseUrl("?tab=memory&ws=tinyqueue-mcp&t=9&action=act-1"))).toBe("?tab=memory&ws=tinyqueue-mcp");
  });

  it("round-trips through parseUrl", () => {
    const search = "?tab=run&ws=acme&scenario=benign_43&guard=off";
    expect(buildSearch(parseUrl(search))).toBe(search);
  });
});

describe("navigateState", () => {
  it("starts the new view from its defaults but keeps the workspace", () => {
    const from = parseUrl("?tab=time&t=16&ws=tinyqueue-mcp");
    expect(navigateState(from, "investigate")).toMatchObject({ tab: "investigate", ws: "tinyqueue-mcp", t: null, action: null });
  });

  it("can switch workspace in the same step", () => {
    expect(navigateState(parseUrl("?tab=memory"), "memory", "tinyqueue-mcp").ws).toBe("tinyqueue-mcp");
  });
});
