import { useId } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  /** Visible helper text shown under the control when this option is selected or disabled (not a hover tooltip). */
  hint?: string;
}

interface SegmentedControlProps<T extends string> {
  legend: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
}

/** Radio-group semantics: arrow keys move the selection, Tab leaves the group. */
export function SegmentedControl<T extends string>({ legend, options, value, onChange, disabled }: SegmentedControlProps<T>) {
  const name = useId();
  const hint = options.find((o) => o.value === value)?.hint ?? options.find((o) => o.disabled && o.hint)?.hint;
  return (
    <fieldset className="pw-seg" disabled={disabled}>
      <legend className="pw-seg__legend">{legend}</legend>
      <div className="pw-seg__row">
        {options.map((o) => (
          <label key={o.value} className={o.value === value ? "pw-seg__opt pw-seg__opt--on" : "pw-seg__opt"}>
            <input
              className="pw-visually-hidden"
              type="radio"
              name={name}
              value={o.value}
              checked={o.value === value}
              disabled={o.disabled}
              onChange={() => onChange(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
      {hint && <p className="pw-seg__hint">{hint}</p>}
    </fieldset>
  );
}
