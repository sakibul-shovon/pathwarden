import type { IconName } from "../icons/Icon";

/** The five visual families of ui-redesign.md §16.6. Every status shows its icon and its word, never colour alone. */
export type StatusFamily = "hold" | "block" | "allow" | "neutral" | "marked";

const FAMILY_BY_STATUS: Record<string, StatusFamily> = {
  held: "hold",
  HOLD: "hold",
  blocked: "block",
  BLOCK: "block",
  executed: "allow",
  allowed: "allow",
  ALLOW: "allow",
  proposed: "neutral",
  rejected: "neutral",
  superseded: "neutral",
};

/** Action statuses and gate verdicts come from the API; an unknown one is shown neutral with its raw text. */
export function statusFamily(status: string): StatusFamily {
  return FAMILY_BY_STATUS[status] ?? "neutral";
}

export const FAMILY_ICON: Record<StatusFamily, IconName> = {
  hold: "gate",
  block: "block",
  allow: "check",
  neutral: "info",
  marked: "diamond",
};
