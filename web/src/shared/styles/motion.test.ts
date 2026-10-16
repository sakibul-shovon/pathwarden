import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** The motion rules of ui-redesign.md §17 as checks on the stylesheets: only opacity and transform animate, nothing animates on a layout
 *  property, every animation has a reduced-motion answer, and the tokens are the specified ones. */

const root = new URL("../../", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".css") ? [join(dir, e.name)] : []));
const sheets = files(root).map((f) => ({ file: f.replace(root, ""), css: readFileSync(f, "utf8") }));
const all = sheets.map((s) => s.css).join("\n");
const components = readFileSync(join(root, "shared/styles/components.css"), "utf8");
const tokens = readFileSync(join(root, "shared/styles/tokens.css"), "utf8");
const base = readFileSync(join(root, "shared/styles/base.css"), "utf8");

/** Brace-matched body of the first block that starts with `head`. */
function block(css: string, head: string): string {
  const start = css.indexOf(head);
  if (start === -1) return "";
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    if (css[i] === "}" && --depth === 0) return css.slice(css.indexOf("{", start) + 1, i);
  }
  return "";
}

describe("keyframes animate opacity and transform only (§17.5: nothing that changes layout)", () => {
  const names = [...all.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1] as string);

  it("has the keyframes the interactions need", () => {
    for (const n of ["pw-fade-in", "pw-rise", "pw-drawer-in", "pw-sheet-in", "pw-indeterminate"]) expect(names).toContain(n);
  });

  it.each([...new Set(names)])("%s animates only allowed properties", (name) => {
    const body = sheets.map((s) => block(s.css, `@keyframes ${name}`)).find(Boolean) ?? "";
    expect(body, name).not.toBe("");
    const props = [...body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1] as string);
    for (const p of props) expect(["opacity", "transform"], `${name}: ${p}`).toContain(p);
  });
});

describe("transitions", () => {
  const allowed = new Set(["background-color", "border-color", "color", "opacity", "transform", "overlay", "display", "box-shadow"]);

  it("never use `all` and never touch a layout property", () => {
    const declarations = [...all.matchAll(/transition(?:-property)?\s*:([^;]+);/g)].map((m) => m[1] as string);
    expect(declarations.length).toBeGreaterThan(8);
    for (const d of declarations) {
      expect(d, d).not.toMatch(/\ball\b(?!-)/);
      const props = d.split(",").map((part) => part.trim().split(/\s+/)[0] ?? "");
      for (const p of props) if (p && !p.startsWith("var(")) expect(allowed.has(p), `${p} in "${d}"`).toBe(true);
    }
  });

  it("colour changes on hover take --dur-1, linear, on every interactive surface of the catalogue", () => {
    for (const sel of [".pw-btn {", ".pw-nav__link {", ".pw-seg__opt {", ".pw-queue__item {", ".pw-scn__row {"]) {
      const body = sheets.map((s) => block(s.css, sel)).find((b) => /transition/.test(b)) ?? "";
      expect(body, sel).toMatch(/transition:[^;]*var\(--dur-1\) linear/);
    }
  });
});

describe("dialog, drawer and sheet", () => {
  it("fades and scales a centred dialog in over --dur-2 and out over --dur-1, and keeps it on screen while it leaves", () => {
    const closed = block(components, ".pw-dialog--dialog {");
    const open = block(components, ".pw-dialog--dialog[open] {");
    expect(closed).toMatch(/opacity var\(--dur-1\) var\(--ease-in\)/);
    expect(closed).toMatch(/transform var\(--dur-1\) var\(--ease-in\)/);
    expect(open).toMatch(/opacity var\(--dur-2\) var\(--ease-out\)/);
    expect(open).toMatch(/transform var\(--dur-2\) var\(--ease-out\)/);
    expect(components).toMatch(/@starting-style\s*\{\s*\.pw-dialog--dialog\[open\]\s*\{[^}]*scale\(0\.98\)/);
    expect(closed).toContain("display var(--dur-1) allow-discrete");
  });

  it("is a fade only under reduced motion: no scale, no travel", () => {
    const reduced = components.slice(components.indexOf("@media (prefers-reduced-motion: reduce)"));
    expect(reduced).toMatch(/\.pw-dialog--dialog,\s*\.pw-dialog--dialog\[open\]\s*\{[^}]*transform:\s*none/);
    expect(components).toMatch(/\.pw-dialog--drawer\[open\]\s*\{\s*animation:\s*pw-fade-in var\(--dur-1\) linear/);
  });

  it("slides a drawer 16 px and a sheet 8 px, with opacity", () => {
    expect(block(components, "@keyframes pw-drawer-in")).toContain("translateX(16px)");
    expect(block(components, "@keyframes pw-sheet-in")).toContain("translateY(8px)");
  });
});

describe("the verdict and the operation indicator", () => {
  it("lets the outcome strip rise 8 px and fade in over --dur-2", () => {
    const strip = all.slice(all.indexOf(".pw-outcome {"));
    expect(block(strip, ".pw-outcome {")).toMatch(/animation:\s*pw-rise var\(--dur-2\) var\(--ease-out\)/);
    expect(block(all, "@keyframes pw-rise")).toContain("translateY(8px)");
  });

  it("loops only the in-flight bar, at 1.2 s linear, and holds it still under reduced motion", () => {
    const loops = [...all.matchAll(/animation:[^;]*infinite[^;]*;/g)].map((m) => m[0]);
    expect(loops).toHaveLength(1);
    expect(loops[0]).toMatch(/pw-indeterminate 1\.2s linear infinite/);
    expect(components).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.pw-working__bar::after\s*\{[^}]*animation:\s*none/);
  });

  it("starts nothing on the first paint of the app: no animation on the page, the shell or the root", () => {
    for (const sel of ["html {", "body {", "#root {", ".pw-shell {", "main {"]) {
      for (const s of sheets) expect(block(s.css, sel), `${sel} in ${s.file}`).not.toMatch(/animation/);
    }
  });
});

describe("tokens (§17.3)", () => {
  it("has the specified durations and curves", () => {
    for (const [name, value] of [
      ["--dur-0", "0ms"],
      ["--dur-1", "120ms"],
      ["--dur-2", "180ms"],
      ["--dur-3", "260ms"],
      ["--dur-trace-step", "110ms"],
      ["--ease-out", "cubic-bezier(0.2, 0, 0, 1)"],
      ["--ease-in", "cubic-bezier(0.4, 0, 1, 1)"],
      ["--ease-move", "cubic-bezier(0.4, 0, 0.2, 1)"],
    ] as const) {
      expect(tokens).toContain(`${name}: ${value};`);
    }
  });

  it("zeroes --dur-2, --dur-3 and the trace step under reduced motion and keeps the 120 ms fades", () => {
    const reduced = block(tokens, "@media (prefers-reduced-motion: reduce)");
    for (const name of ["--dur-2", "--dur-3", "--dur-trace-step"]) expect(reduced).toMatch(new RegExp(`${name}:\\s*0ms`));
    expect(reduced).not.toMatch(/--dur-1/);
  });

  it("turns smooth scrolling off under reduced motion", () => {
    expect(block(base, "@media (prefers-reduced-motion: reduce)")).toMatch(/scroll-behavior:\s*auto\s*!important/);
  });

  it("crossfades a view switch over --dur-2", () => {
    expect(block(base, "::view-transition-old(root)")).toMatch(/animation-duration:\s*var\(--dur-2\)/);
  });
});
