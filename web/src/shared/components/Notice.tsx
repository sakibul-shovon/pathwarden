import type { ReactNode } from "react";
import { Icon, type IconName } from "../icons/Icon";

export type NoticeVariant = "info" | "caveat" | "consequence";

const ICON: Record<NoticeVariant, IconName> = { info: "info", caveat: "warning", consequence: "gate" };
const LEAD: Record<NoticeVariant, string> = { info: "Note", caveat: "Caveat", consequence: "What this does" };

/** Icon plus a visible lead-in word, so the kind of notice never depends on colour. */
export function Notice({ variant = "info", children }: { variant?: NoticeVariant; children: ReactNode }) {
  return (
    <div className={`pw-notice pw-notice--${variant}`}>
      <Icon name={ICON[variant]} size={16} />
      <p>
        <strong>{LEAD[variant]}.</strong> {children}
      </p>
    </div>
  );
}
