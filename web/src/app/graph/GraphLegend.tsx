interface LegendItem {
  glyph: string;
  text: string;
}

export const LINEAGE_LEGEND: LegendItem[] = [
  { glyph: "u", text: "untrusted witness path: solid, thick" },
  { glyph: "s", text: "secret witness path: dotted, thick" },
  { glyph: "source", text: "source: diamond, with its trust in words" },
  { glyph: "memory", text: "memory: barrel; draft: cut corner" },
  { glyph: "sanitized", text: "sanitized: dashed border" },
  { glyph: "approved", text: "approved by a person: double border" },
  { glyph: "payload", text: "payload under review: heavy border and the word payload" },
  { glyph: "quarantined", text: "quarantined: hatched and faded, marked Q" },
  { glyph: "marked", text: "a story moment: yellow halo around the artifact" },
  { glyph: "tainted", text: "doubly tainted draft (untrusted and secret lineage): double border and the words 2× tainted" },
];

const byGlyph = (...glyphs: string[]): LegendItem[] => glyphs.map((g) => LINEAGE_LEGEND.find((i) => i.glyph === g)).filter((i): i is LegendItem => i !== undefined);

/** The lineage legend for what this figure draws: the witness paths and the payload only when it has them, and the marker halo and
 *  the doubly tainted border only in Time travel. */
export function lineageLegend(use: { witness: boolean; payload: boolean; marked: boolean; tainted: boolean }): LegendItem[] {
  return [
    ...(use.witness ? byGlyph("u", "s") : []),
    ...byGlyph("source", "memory", "sanitized", "approved"),
    ...(use.payload ? byGlyph("payload") : []),
    ...byGlyph("quarantined"),
    ...(use.marked ? byGlyph("marked") : []),
    ...(use.tainted ? byGlyph("tainted") : []),
  ];
}

export const CAPABILITY_LEGEND: LegendItem[] = [
  { glyph: "source", text: "source: diamond, with its trust in words" },
  { glyph: "store", text: "store: barrel" },
  { glyph: "sink", text: "sink: tag; external sinks have a heavy border" },
  { glyph: "toxic", text: "toxic agent: double border and the words toxic: it reads untrusted and secret data and can reach outside" },
  { glyph: "revoked", text: "revoked flow: dashed and faded, labelled revoked" },
  { glyph: "cut", text: "previewed cut: thick, labelled cut" },
];

/** What the shapes and lines mean. Each entry pairs a drawn glyph with words, so the legend never relies on colour either. */
export function GraphLegend({ items, label }: { items: LegendItem[]; label: string }) {
  return (
    <ul className="pw-legend" aria-label={label}>
      {items.map((i) => (
        <li key={i.glyph}>
          <span className={`pw-key pw-key--${i.glyph}`} aria-hidden="true" />
          {i.text}
        </li>
      ))}
    </ul>
  );
}
