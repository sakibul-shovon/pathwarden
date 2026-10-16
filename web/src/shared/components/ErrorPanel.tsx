import type { ReactNode } from "react";
import { Icon } from "../icons/Icon";

interface ErrorPanelProps {
  title: string;
  /** The raw `error` code of the API (or a client code): always shown, in mono, for debugging. */
  code?: string;
  children?: ReactNode;
  recovery?: ReactNode;
}

export function ErrorPanel({ title, code, children, recovery }: ErrorPanelProps) {
  return (
    <div className="pw-error" role="alert">
      <h3 className="pw-error__title">
        <Icon name="warning" size={18} /> {title}
      </h3>
      {code && <p className="pw-error__code">{code}</p>}
      {children && <div className="pw-error__body">{children}</div>}
      {recovery && <div className="pw-error__recovery">{recovery}</div>}
    </div>
  );
}
