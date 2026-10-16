import type { ReactNode } from "react";

interface SheetProps {
  title?: ReactNode;
  /** A sheet is a document: release page, diff side, report. Square corners, mono content. */
  children: ReactNode;
  className?: string;
}

export function Sheet({ title, children, className }: SheetProps) {
  return (
    <section className={className ? `pw-sheet ${className}` : "pw-sheet"}>
      {title && <h3 className="pw-sheet__title">{title}</h3>}
      <div className="pw-sheet__body">{children}</div>
    </section>
  );
}
