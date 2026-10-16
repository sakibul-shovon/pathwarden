import { Icon } from "../icons/Icon";
import { FAMILY_ICON, statusFamily, type StatusFamily } from "../lib/status";

interface StatusPillProps {
  /** An action status or gate verdict as the API returned it. */
  status: string;
  /** Override the visual family (e.g. "marked" for a time-travel marker). */
  family?: StatusFamily;
  /** Text shown instead of the raw status. */
  label?: string;
}

export function StatusPill({ status, family, label }: StatusPillProps) {
  const fam = family ?? statusFamily(status);
  return (
    <span className={`pw-status pw-status--${fam}`}>
      <Icon name={FAMILY_ICON[fam]} size={14} />
      <span>{label ?? status}</span>
    </span>
  );
}
