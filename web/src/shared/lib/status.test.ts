import { describe, expect, it } from "vitest";
import { FAMILY_ICON, statusFamily } from "./status";

describe("statusFamily", () => {
  it.each([
    ["held", "hold"],
    ["HOLD", "hold"],
    ["blocked", "block"],
    ["BLOCK", "block"],
    ["executed", "allow"],
    ["allowed", "allow"],
    ["ALLOW", "allow"],
    ["proposed", "neutral"],
    ["rejected", "neutral"],
    ["superseded", "neutral"],
  ])("%s is in the %s family", (status, family) => {
    expect(statusFamily(status)).toBe(family);
  });

  it("shows an unknown status neutral instead of guessing", () => {
    expect(statusFamily("something_new")).toBe("neutral");
  });

  it("gives every family an icon", () => {
    for (const family of ["hold", "block", "allow", "neutral", "marked"] as const) expect(FAMILY_ICON[family]).toBeTruthy();
  });
});
