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
];

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
