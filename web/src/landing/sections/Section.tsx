import type { ReactNode } from "react";

interface SectionProps {
  id: string;
  /** The small mono line above the title. */
  eyebrow?: string;
  title: string;
  /** A one-paragraph lead under the title. */
  lead?: ReactNode;
  children?: ReactNode;
}

/** A page section: an anchor, a heading the link focuses, and room to breathe. */
export function Section({ id, eyebrow, title, lead, children }: SectionProps) {
  return (
    <section id={id} className="pw-lsec" aria-labelledby={`${id}-title`}>
      <header className="pw-lsec__head">
        {eyebrow && <p className="pw-eyebrow">{eyebrow}</p>}
        <h2 id={`${id}-title`} className="pw-lsec__title pw-display">
          {title}
        </h2>
        {lead && <div className="pw-lsec__lead">{lead}</div>}
      </header>
      {children}
    </section>
  );
}
