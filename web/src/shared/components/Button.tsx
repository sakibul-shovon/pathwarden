import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "md" | "sm";
  /** The request behind the button is in flight: the label should already say so ("Running…"). */
  pending?: boolean;
}

/** Labels are verbs naming the action ("Release healed version", not "Confirm"). `danger` marks risk-increasing entry points. */
export function Button({ variant = "secondary", size = "md", pending, className, type = "button", disabled, ...rest }: ButtonProps) {
  const cls = ["pw-btn", `pw-btn--${variant}`, size === "sm" ? "pw-btn--sm" : "", className ?? ""].filter(Boolean).join(" ");
  return <button type={type} className={cls} disabled={disabled || pending} aria-busy={pending || undefined} {...rest} />;
}
