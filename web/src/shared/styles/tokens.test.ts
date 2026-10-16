import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { contrastRatio } from "../lib/contrast";

// Vitest swaps plain CSS imports for an empty string, so the file is read directly.
const tokensCss = readFileSync(new URL("./tokens.css", import.meta.url), "utf-8");

type Tokens = Record<string, string>;

/** `--name: value;` declarations of one CSS block, from the text between its braces. */
function declarations(block: string): Tokens {
  const out: Tokens = {};
  for (const m of block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)) out[m[1] as string] = (m[2] as string).trim();
  return out;
}

/** Text of the first `{ ... }` block that starts at `selector` (no nested braces inside the block). */
function blockAfter(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

const light = declarations(blockAfter(tokensCss, ":root {"));
const dark = declarations(blockAfter(tokensCss, ':root:not([data-theme="light"]) {'));
const darkManual = declarations(blockAfter(tokensCss, ':root[data-theme="dark"] {'));

const COLOUR_KEYS = [
  "--paper", "--sheet", "--ink", "--ink-2", "--ink-3", "--line", "--line-strong",
  "--untrusted", "--untrusted-tint", "--secret", "--secret-tint",
  "--allow", "--allow-tint", "--hold", "--hold-tint", "--highlight", "--on-highlight",
] as const;

describe("tokens.css", () => {
  it("defines every colour token as #rrggbb in the light theme", () => {
    for (const key of COLOUR_KEYS) expect(light[key], key).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("redefines the same colour tokens for the dark theme", () => {
    for (const key of COLOUR_KEYS) expect(dark[key], key).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it("keeps the manual dark override identical to the OS dark block", () => {
    for (const key of Object.keys(dark)) expect(darkManual[key], key).toBe(dark[key]);
    expect(Object.keys(darkManual).filter((k) => k.startsWith("--")).sort()).toEqual(Object.keys(dark).sort());
  });
});

describe.each([
  ["light", light],
  ["dark", dark],
] as const)("%s theme contrast (ui-redesign.md §16.3)", (_name, t) => {
  const text = ["--ink", "--ink-2", "--ink-3", "--untrusted", "--secret", "--allow", "--hold"] as const;

  it.each(text)("%s is readable text (>= 4.5:1) on paper and on sheet", (key) => {
    for (const surface of ["--paper", "--sheet"] as const) {
      expect(contrastRatio(t[key] as string, t[surface] as string), `${key} on ${surface}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ["--untrusted", "--untrusted-tint"],
    ["--secret", "--secret-tint"],
    ["--allow", "--allow-tint"],
    ["--hold", "--hold-tint"],
  ] as const)("%s text stays readable on its tint %s", (fg, bg) => {
    expect(contrastRatio(t[fg] as string, t[bg] as string)).toBeGreaterThanOrEqual(4.5);
  });

  it("control borders reach 3:1 against the surfaces they sit on", () => {
    for (const surface of ["--paper", "--sheet"] as const) {
      expect(contrastRatio(t["--line-strong"] as string, t[surface] as string), surface).toBeGreaterThanOrEqual(3);
    }
  });

  it("dark text on the highlight stays readable in both themes", () => {
    expect(contrastRatio(t["--on-highlight"] as string, t["--highlight"] as string)).toBeGreaterThanOrEqual(4.5);
  });

  it("--line is decorative only: it must not be mistaken for a control border", () => {
    expect(contrastRatio(t["--line"] as string, t["--sheet"] as string)).toBeLessThan(3);
  });
});
