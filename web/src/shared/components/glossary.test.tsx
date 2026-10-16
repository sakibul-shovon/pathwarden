import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GLOSSARY, GLOSSARY_KEYS } from "../lib/glossary";
import { Term } from "./Term";

const text = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

describe("glossary", () => {
  it("defines the six words of the spec in plain language, in one to three sentences each", () => {
    expect(GLOSSARY_KEYS.sort()).toEqual(["cut", "quarantine", "sanitized", "toxic", "trifecta", "witness"]);
    for (const key of GLOSSARY_KEYS) {
      const { title, text: body } = GLOSSARY[key];
      expect(title.length).toBeGreaterThan(2);
      const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean);
      expect(sentences.length, key).toBeGreaterThanOrEqual(1);
      expect(sentences.length, key).toBeLessThanOrEqual(3);
      expect(body, key).not.toMatch(/\b(TODO|lorem)\b/i);
    }
  });

  it("states the rules the product follows, and no more: a sanitizer never cuts a secret path, only a person releases a quarantine", () => {
    expect(GLOSSARY.sanitized.text).toContain("never cuts a secret path");
    expect(GLOSSARY.quarantine.text).toContain("releasing one puts risk back, so it needs a person");
    expect(GLOSSARY.toxic.text).toContain("untrusted data");
    expect(GLOSSARY.toxic.text).toContain("secrets");
    expect(GLOSSARY.toxic.text).toContain("external sink");
    expect(GLOSSARY.trifecta.text).toContain("TRIFECTA");
  });
});

describe("Term", () => {
  const html = renderToStaticMarkup(<Term term="witness">Witness</Term>);

  it("is a button that opens a popover, never a hover tooltip", () => {
    expect(html).toMatch(/<button[^>]*type="button"[^>]*class="pw-term"/);
    expect(html).toMatch(/popovertarget="[^"]+"/);
    expect(html).toMatch(/popover="auto"/);
    expect(html).not.toMatch(/title=|onmouse/i);
  });

  it("names the trigger so a screen reader knows it explains the word, and the card by what it explains", () => {
    expect(text(html)).toContain("Witness (what this means)");
    expect(html).toContain('aria-label="Witness: what it means"');
    expect(html).toContain('aria-haspopup="dialog"');
  });

  it("carries the definition and its own close button, tied to the same popover", () => {
    expect(text(html)).toContain(GLOSSARY.witness.text);
    const target = html.match(/popovertarget="([^"]+)"/)?.[1];
    expect(html).toContain(`id="${target}"`);
    expect(html).toContain('popovertargetaction="hide"');
    expect(text(html)).toContain("Close");
  });

  it("shows the title when no words are given", () => {
    expect(text(renderToStaticMarkup(<Term term="toxic" />))).toContain("Toxic agent (what this means)");
  });
});

describe("where the terms are used", () => {
  const read = (path: string): string => readFileSync(new URL(path, import.meta.url), "utf8");
  it("explains each of the six words where it first matters", () => {
    const uses: [string, RegExp][] = [
      ["../../app/views/investigate/VerdictPair.tsx", /term="trifecta"/],
      ["../../app/views/investigate/InvestigateView.tsx", /term="witness"/],
      ["../../app/views/investigate/ForensicsPanel.tsx", /term="quarantine"/],
      ["../../app/views/remediate/RemediateView.tsx", /term="toxic"/],
      ["../../app/views/remediate/RemediateView.tsx", /term="cut"/],
      ["../../app/views/memory/MemoryView.tsx", /term="sanitized"/],
    ];
    for (const [file, re] of uses) expect(read(file), file).toMatch(re);
  });
});
