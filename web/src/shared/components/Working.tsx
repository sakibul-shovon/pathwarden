import type { ReactNode } from "react";
import { formatElapsed } from "../lib/format";

interface WorkingProps {
  children: ReactNode;
  /** Shown as m:ss, hidden from screen readers (a ticking number would chatter). */
  elapsedMs?: number;
}

/** A request that has taken more than a second: what is running, for how long, and an indeterminate bar. The API reports no progress, so
 *  there is no percent and no estimate. Under reduced motion the bar is static and the text and the elapsed time say it all. */
export function Working({ children, elapsedMs }: WorkingProps) {
  return (
    <div className="pw-working" role="status">
      <span className="pw-working__bar" aria-hidden="true" />
      <p>
        {children}
        {elapsedMs !== undefined && (
          <>
            {" "}
            <span aria-hidden="true" className="pw-working__time">
              {formatElapsed(elapsedMs)}
            </span>
          </>
        )}
      </p>
    </div>
  );
}
