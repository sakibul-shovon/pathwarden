import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon } from "../icons/Icon";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Buttons. For a risk-increasing action mark Cancel with `data-autofocus` so it receives the initial focus. */
  actions?: ReactNode;
  /** `drawer` slides in from the right (bottom sheet on phones) and closes on a backdrop click. */
  variant?: "dialog" | "drawer";
}

/** Native `<dialog>` with `showModal()`: inert background, Esc to close, focus moves in and returns to the opener. */
export function Dialog({ open, onClose, title, children, actions, variant = "dialog" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<Element | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      opener.current = document.activeElement;
      dialog.showModal();
      // React's `autoFocus` runs before showModal(), so the browser would pick the first control instead.
      dialog.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onNativeClose = (): void => {
      onClose();
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
    dialog.addEventListener("close", onNativeClose);
    return () => dialog.removeEventListener("close", onNativeClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={`pw-dialog pw-dialog--${variant}`}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (variant === "drawer" && e.target === ref.current) ref.current?.close();
      }}
    >
      {open && (
        <div className="pw-dialog__panel">
          <header className="pw-dialog__head">
            <h2 id={titleId} className="pw-dialog__title">
              {title}
            </h2>
            <button type="button" className="pw-dialog__close" onClick={() => ref.current?.close()} aria-label="Close">
              <Icon name="close" size={16} />
            </button>
          </header>
          <div className="pw-dialog__body">{children}</div>
          {actions && <footer className="pw-dialog__actions">{actions}</footer>}
        </div>
      )}
    </dialog>
  );
}
