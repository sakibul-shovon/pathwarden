import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "./Icon";

/** A small disclosure menu: closes on Escape and on an outside click; focus returns to the button. */
export function Menu({
  trigger,
  label,
  children,
  align = "end",
}: {
  trigger: ReactNode;
  label: string;
  children: (close: () => void) => ReactNode;
  align?: "start" | "end";
}) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={box}>
      <button ref={button} type="button" className="menu-btn" aria-haspopup="true" aria-expanded={open} aria-label={label} onClick={() => setOpen(!open)}>
        {trigger}
        <Icon name="chevron" size={14} />
      </button>
      {open && <div className={`menu-panel menu-${align}`}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
