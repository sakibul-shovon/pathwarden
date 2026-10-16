import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Working } from "./Working";

describe("Working (an operation in flight for more than a second)", () => {
  it("is a status with an indeterminate bar that assistive technology skips, and the words that say what is running", () => {
    const html = renderToStaticMarkup(<Working>Computing four cuts…</Working>);
    expect(html).toContain('role="status"');
    expect(html).toMatch(/<span class="pw-working__bar" aria-hidden="true"><\/span>/);
    expect(html).toContain("Computing four cuts…");
  });

  it("shows the elapsed time as m:ss and hides the ticking number from screen readers", () => {
    const html = renderToStaticMarkup(<Working elapsedMs={65_400}>Investigating…</Working>);
    expect(html).toMatch(/<span aria-hidden="true" class="pw-working__time">1:05<\/span>/);
  });

  it("says no percent and no estimate: it has neither to give", () => {
    const html = renderToStaticMarkup(<Working elapsedMs={3000}>Running…</Working>);
    expect(html).not.toMatch(/%|remaining|eta/i);
  });

  it("shows no time when none is given", () => {
    expect(renderToStaticMarkup(<Working>Running…</Working>)).not.toContain("pw-working__time");
  });
});
