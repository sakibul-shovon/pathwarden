import { useRef, type ReactNode } from "react";
import { useScrolls } from "../lib/useScrolls";

interface ScrollProps {
  /** What is inside (a table's name): the region says it, and that it scrolls sideways, when it does. */
  label: string;
  children: ReactNode;
}

/** A box that scrolls sideways when its table is wider than the screen. When it does scroll it is a named, focusable region, so a keyboard
 *  user can reach it and scroll it with the arrow keys (WCAG 2.1.1); when it does not, it adds no tab stop. */
export function Scroll({ label, children }: ScrollProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scrolls = useScrolls(ref);
  return (
    <div ref={ref} className="pw-scroll" {...(scrolls ? { tabIndex: 0, role: "region", "aria-label": `${label} (scrolls sideways)` } : {})}>
      {children}
    </div>
  );
}
