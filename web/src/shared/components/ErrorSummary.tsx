import { useEffect, useRef } from "react";

export interface SummaryError {
  /** The id of the field to focus when the link is followed; absent for an error that belongs to no field. */
  fieldId?: string;
  message: string;
}

interface ErrorSummaryProps {
  errors: SummaryError[];
  /** Changes on every failed submit: the summary then takes focus again even if the messages are the same. */
  focusKey: number;
}

/** GOV.UK pattern: at the top of the form, takes focus when errors appear, one link per error to its field. */
export function ErrorSummary({ errors, focusKey }: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (errors.length > 0) ref.current?.focus();
  }, [errors.length, focusKey]);
  if (errors.length === 0) return null;
  return (
    <div ref={ref} className="pw-error-summary" tabIndex={-1} role="alert">
      <h2 className="pw-error-summary__title">There is a problem</h2>
      <ul>
        {errors.map((e) => (
          <li key={`${e.fieldId ?? "form"}:${e.message}`}>
            {e.fieldId ? (
              <a
                href={`#${e.fieldId}`}
                onClick={(ev) => {
                  ev.preventDefault();
                  document.getElementById(e.fieldId as string)?.focus();
                }}
              >
                {e.message}
              </a>
            ) : (
              e.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
