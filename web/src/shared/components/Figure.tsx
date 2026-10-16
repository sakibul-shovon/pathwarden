import type { ReactNode } from "react";

interface FigureProps {
  /** Figure number: "FIG. 1". */
  n: number;
  caption: ReactNode;
  /** Where the data of the figure comes from; a figure without a source is decoration. */
  source: ReactNode;
  children: ReactNode;
}

export function Figure({ n, caption, source, children }: FigureProps) {
  return (
    <figure className="pw-figure">
      <div className="pw-figure__plate">{children}</div>
      <figcaption>
        <span className="pw-eyebrow">FIG. {n}</span> {caption} <span className="pw-figure__source">Source: {source}</span>
      </figcaption>
    </figure>
  );
}
