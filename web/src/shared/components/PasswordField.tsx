import { useState } from "react";
import { Field } from "./Field";

interface PasswordFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
}

/** A secret the browser must not remember or spell-check; a button shows it on request (`aria-pressed`). */
export function PasswordField({ id, label, hint, error, value, onChange }: PasswordFieldProps) {
  const [shown, setShown] = useState(false);
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      {(a11y) => (
        <div className="pw-field__row">
          <input
            {...a11y}
            className="pw-input"
            type={shown ? "text" : "password"}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button type="button" className="pw-field__toggle" aria-pressed={shown} onClick={() => setShown((s) => !s)}>
            {shown ? "Hide" : "Show"}
            <span className="pw-visually-hidden"> key</span>
          </button>
        </div>
      )}
    </Field>
  );
}
