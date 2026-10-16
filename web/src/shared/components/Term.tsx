import { useId, type ReactNode } from "react";
import { GLOSSARY, type GlossaryKey } from "../lib/glossary";

interface TermProps {
  term: GlossaryKey;
  /** The words shown (defaults to the term's title). */
  children?: ReactNode;
}

/** A word with a plain-language definition on request. A native popover: opened by Enter, Space or a click, closed by Esc, a click outside
 *  or its own button, and focus returns to the word. It never opens on hover, so nothing appears or vanishes under the pointer (WCAG 1.4.13). */
export function Term({ term, children }: TermProps) {
  const id = useId();
  const g = GLOSSARY[term];
  // `popover` and `popovertarget` are new HTML attributes that React 18's types do not list yet
  const trigger = { popovertarget: id } as Record<string, string>;
  const card = { popover: "auto" } as Record<string, string>;
  return (
    <>
      <button type="button" className="pw-term" {...trigger} aria-haspopup="dialog">
        {children ?? g.title}
        <span className="pw-visually-hidden"> (what this means)</span>
      </button>
      <div id={id} className="pw-term__card" role="dialog" aria-label={`${g.title}: what it means`} {...card}>
        <p className="pw-term__title">{g.title}</p>
        <p>{g.text}</p>
        <button type="button" className="pw-btn pw-btn--sm" {...({ popovertarget: id, popovertargetaction: "hide" } as Record<string, string>)}>
          Close
        </button>
      </div>
    </>
  );
}
