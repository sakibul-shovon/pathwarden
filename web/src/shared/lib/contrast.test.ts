import { describe, expect, it } from "vitest";
import { contrastRatio, parseHex } from "./contrast";

describe("contrastRatio", () => {
  it("is 21 for black on white and symmetric", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 5);
  });

  it("is 1 for identical colours", () => {
    expect(contrastRatio("#83878f", "#83878f")).toBeCloseTo(1, 5);
  });

  it("matches a published reference value (#767676 on white is about 4.54)", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeGreaterThan(4.5);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("rejects anything that is not #rrggbb", () => {
    expect(() => parseHex("red")).toThrow();
    expect(() => parseHex("#fff")).toThrow();
  });
});
