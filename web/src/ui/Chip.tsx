import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Tone = "hold" | "allow" | "quarantine" | "muted" | "untrusted" | "secret" | "ink";

/** A labelled chip. Colour is never the only cue: every tone carries an icon or a word. */
export function Chip({ tone, icon, children, title }: { tone: Tone; icon?: IconName; children: ReactNode; title?: string }) {
  return (
    <span className={`chip chip-${tone}`} title={title}>
      {icon && <Icon name={icon} size={14} />}
      {children}
    </span>
  );
}

const STATUS: Record<string, { tone: Tone; icon: IconName }> = {
  held: { tone: "hold", icon: "hold" },
  blocked: { tone: "hold", icon: "hold" },
  HOLD: { tone: "hold", icon: "hold" },
  BLOCK: { tone: "hold", icon: "hold" },
  executed: { tone: "allow", icon: "check" },
  ALLOW: { tone: "allow", icon: "check" },
  superseded: { tone: "muted", icon: "back" },
  rejected: { tone: "muted", icon: "close" },
};

/** Verdicts (HOLD/BLOCK/ALLOW) and recorded statuses (held/executed/...) share one look. */
export function StatusChip({ status }: { status: string }) {
  const s = STATUS[status] ?? { tone: "muted" as Tone, icon: "info" as IconName };
  return <Chip tone={s.tone} icon={s.icon}>{status}</Chip>;
}

/** Who acts: risk-reducing steps may run on their own, risk-increasing ones need a person (plan rule 8). */
export function ActorChip({ who }: { who: "auto" | "human" }) {
  return who === "auto" ? (
    <Chip tone="muted" icon="bolt" title="Risk-reducing: the system may do this on its own">Automatic</Chip>
  ) : (
    <Chip tone="ink" icon="user" title="Risk-increasing: needs a person's decision">Needs a person</Chip>
  );
}
