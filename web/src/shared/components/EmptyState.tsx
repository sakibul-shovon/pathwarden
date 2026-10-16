import type { ReactNode } from "react";

/** One sentence of what will appear here, and one action that makes it appear. */
export function EmptyState({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="pw-empty">
      <p>{children}</p>
      {action}
    </div>
  );
}
