import { forwardRef } from "react";
import { Icon, type IconName } from "../../../shared/icons/Icon";
import type { Outcome } from "./runLogic";

interface Presentation {
  word: string;
  family: "hold" | "block" | "allow" | "neutral";
  icon: IconName;
  text: string;
}

/** What each outcome says (ui-redesign.md §14.3). The verdict words come from the API fields; this only phrases them. */
export function presentOutcome(o: Outcome): Presentation {
  const id = o.actionId ?? "the action";
  switch (o.kind) {
    case "held":
      return {
        word: "HELD",
        family: "hold",
        icon: "gate",
        text:
          o.reason === "TRIFECTA"
            ? `${id}: TRIFECTA. Nothing was posted. The payload descends from untrusted input and from a secret.`
            : `${id}: ${o.reason ?? "held"}. Nothing was posted: the gate fails closed.`,
      };
    case "blocked":
      return {
        word: "BLOCKED",
        family: "block",
        icon: "block",
        text:
          o.reason === "QUARANTINED_LINEAGE"
            ? `${id}: part of this payload's lineage is quarantined. Nothing was posted.`
            : `${id}: ${o.reason ?? "blocked"}. Nothing was posted.`,
      };
    case "leaked":
      return {
        word: "LEAKED",
        family: "hold",
        icon: "outbound",
        text: `${id} (${o.reason}): the public release page now shows secret values, although every agent session passed the Rule of Two. (This is a display check of the page text, not a gate verdict.)`,
      };
    case "posted":
      return { word: "POSTED", family: "allow", icon: "check", text: `${id} (${o.reason}): the gate allowed it and a release note was published.` };
    case "posted_warning":
      return {
        word: "POSTED · WARNING",
        family: "neutral",
        icon: "warning",
        text: `${id} (SECRET_EGRESS_WARNING): a secret descends into this release but no untrusted input influenced it. The gate allows that (a documented non-goal).`,
      };
    case "posted_unguarded":
      return { word: "POSTED · GUARD OFF", family: "neutral", icon: "check", text: `${id}: executed without the gate. The page shows no secret-looking text.` };
    case "nothing":
      return {
        word: "NOTHING PROPOSED",
        family: "neutral",
        icon: "info",
        text: "The Release agent never asked to post, so there was nothing to gate and nothing was published.",
      };
    case "other":
      return { word: (o.status ?? "UNKNOWN").toUpperCase(), family: "neutral", icon: "info", text: `${id} ended with the status "${o.status}".` };
  }
}

interface OutcomeStripProps {
  outcome: Outcome;
  caseHref: string | null;
  onOpenCase: (actionId: string) => void;
}

/** The first thing after a run: the verdict as a word with an icon, a sentence, and the way into the case. */
export const OutcomeStrip = forwardRef<HTMLHeadingElement, OutcomeStripProps>(function OutcomeStrip({ outcome, caseHref, onOpenCase }, ref) {
  const p = presentOutcome(outcome);
  return (
    <section className={`pw-outcome pw-outcome--${p.family}`} aria-labelledby="pw-outcome-title">
      <h2 id="pw-outcome-title" ref={ref} tabIndex={-1} className="pw-outcome__word">
        <Icon name={p.icon} size={22} /> {p.word}
      </h2>
      <p className="pw-outcome__text">{p.text}</p>
      {caseHref && outcome.actionId && (
        <a
          className="pw-outcome__case"
          href={caseHref}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onOpenCase(outcome.actionId as string);
          }}
        >
          Open case {outcome.actionId} <Icon name="arrow-right" size={14} />
        </a>
      )}
    </section>
  );
});
