import { describe, expect, it } from "vitest";
import { capabilityStyle, hatchUri, lineageStyle, type Palette } from "./canvasStyle";

const p: Palette = {
  ink: "#111111", ink2: "#222222", ink3: "#333333", line: "#aaaaaa", lineStrong: "#888888", sheet: "#ffffff", paper: "#eeeeee",
  untrusted: "#b4450c", secret: "#8f1c6b", hold: "#b3261e", highlight: "#ffd84a", mono: "monospace",
};

const rule = (sheet: ReturnType<typeof lineageStyle>, selector: string): Record<string, unknown> => {
  const found = sheet.find((b) => "selector" in b && b.selector === selector);
  if (!found || !("style" in found)) throw new Error(`no rule for ${selector}`);
  return found.style as Record<string, unknown>;
};

describe("lineage style sheet", () => {
  const sheet = lineageStyle(p);

  it("tells artifact kinds apart by shape, not colour (§15.4)", () => {
    expect(rule(sheet, "node.memory").shape).toBe("barrel");
    expect(rule(sheet, "node.draft").shape).toBe("cut-rectangle");
    expect(rule(sheet, "node.source").shape).toBe("diamond");
  });

  it("tells a sanitized artifact by a dashed border and an approved one by a double border", () => {
    expect(rule(sheet, "node.sanitized")["border-style"]).toBe("dashed");
    expect(rule(sheet, "node.approved")["border-style"]).toBe("double");
  });

  it("draws the untrusted witness solid and the secret witness dotted, both thick", () => {
    expect(rule(sheet, "edge.u")).toMatchObject({ width: 4, "line-color": p.untrusted });
    expect(rule(sheet, "edge.u")["line-style"]).toBeUndefined();
    expect(rule(sheet, "edge.s")).toMatchObject({ width: 4, "line-style": "dotted", "line-color": p.secret });
    expect(rule(sheet, "node.s")["border-style"]).toBe("dotted");
  });

  it("seals a quarantined node with a hatch and fades it, and highlights a marker in yellow, never the untrusted colour", () => {
    const q = rule(sheet, "node.quarantined");
    expect(String(q["background-image"])).toContain("data:image/svg+xml");
    expect(Number(q.opacity)).toBeLessThan(1);
    expect(rule(sheet, "node.marked")["underlay-color"]).toBe(p.highlight);
    expect(p.highlight).not.toBe(p.untrusted);
  });

  it("dims to a quarter and hides with display none, for hover, focus mode and the witness-only filter", () => {
    expect(rule(sheet, ".dim").opacity).toBe(0.25);
    expect(rule(sheet, ".gone").display).toBe("none");
  });

  it("uses the schematic taxi edge only where lanes ask for it, and makes the lane bands inert", () => {
    expect(rule(sheet, "edge.taxi")["curve-style"]).toBe("taxi");
    expect(rule(sheet, "edge")["curve-style"]).toBe("bezier");
    expect(rule(sheet, "node.lane").events).toBe("no");
    expect(rule(sheet, "node.anchor").events).toBe("no");
  });

  it("reads every colour from the palette", () => {
    const other = JSON.stringify(lineageStyle({ ...p, ink: "#010203" }));
    expect(other).toContain("#010203");
    expect(JSON.stringify(sheet)).not.toContain("#010203");
  });
});

describe("capability style sheet", () => {
  const sheet = capabilityStyle(p);

  it("shapes sources, stores and sinks, and doubles the border of a toxic agent", () => {
    expect(rule(sheet, "node.source").shape).toBe("diamond");
    expect(rule(sheet, "node.store").shape).toBe("barrel");
    expect(rule(sheet, "node.sink").shape).toBe("tag");
    expect(rule(sheet, "node.toxic")).toMatchObject({ "border-style": "double", "border-color": p.hold });
  });

  it("dashes and fades a revoked flow and draws the previewed cut thick", () => {
    expect(rule(sheet, "edge.revoked")).toMatchObject({ "line-style": "dashed", opacity: 0.35 });
    expect(rule(sheet, "edge.cut")).toMatchObject({ width: 4, "line-color": p.hold });
  });
});

describe("hatchUri", () => {
  it("is a self-contained SVG data URI in the given colour", () => {
    const uri = hatchUri("#333333", 100, 40);
    expect(uri.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    const svg = decodeURIComponent(uri.slice("data:image/svg+xml;utf8,".length));
    expect(svg).toContain("stroke='#333333'");
    expect(svg).toContain("width='100'");
  });
});
