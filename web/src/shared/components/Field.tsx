import type { ReactNode } from "react";

interface FieldA11y {
  id: string;
  "aria-describedby": string | undefined;
  "aria-invalid": true | undefined;
}

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  /** The message of the error of this field; the summary at the top of the form repeats it with a link here. */
  error?: string;
  children: (a11y: FieldA11y) => ReactNode;
}

/** Visible label above, hint below it, error under the control; the control gets the ids that tie them together. */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={error ? "pw-field pw-field--invalid" : "pw-field"}>
      <label htmlFor={id} className="pw-field__label">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="pw-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="pw-field__error">
          <span className="pw-visually-hidden">Error: </span>
          {error}
        </p>
      )}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
    </div>
  );
}
