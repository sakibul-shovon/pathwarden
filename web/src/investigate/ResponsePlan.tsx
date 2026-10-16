import { m, useReducedMotion } from "motion/react";
import type { ForensicReport, HealResult } from "../api/types";
import { ActorChip } from "../ui/Chip";
import { Icon } from "../ui/Icon";

type StepState = "pending" | "working" | "done" | "waiting";

interface Step {
  title: string;
  who: "auto" | "human";
  state: StepState;
  detail: string;
}

function plan(report: ForensicReport | null, busy: boolean, heal: HealResult | null): Step[] {
  const phase = (done: boolean): StepState => (done ? "done" : busy ? "working" : "pending");
  const has = report !== null;
  const memories = report?.laundering_memories ?? [];
  const healed = heal !== null && heal.superseded;
  return [
    {
      title: "Find the untrusted source",
      who: "auto",
      state: phase(has),
      detail: has ? (report.untrusted_source ? report.untrusted_source : "(none found)") : "Walks the lineage back to the source that carried untrusted text.",
    },
    {
      title: "Find the poisoned memory",
      who: "auto",
      state: phase(has),
      detail: has ? (memories.length === 0 ? "No team-memory entry carries it." : memories.map((x) => `${x.memory_key} (${x.memory_id}, ${x.written_by}, ${x.written_on})`).join("; ")) : "Looks for memory entries that carried it into a later session.",
    },
    {
      title: "Quarantine everything derived from it",
      who: "auto",
      state: phase(has),
      detail: has
        ? report.quarantine_id
          ? `${report.quarantine_id}: ${report.quarantined_artifacts.length} artifact(s). Reversible.`
          : "Nothing new to quarantine."
        : "Reversible, and recorded as a Quarantine node.",
    },
    {
      title: "Replay the work in a sandbox copy",
      who: "auto",
      state: phase(has),
      detail: has ? (report.sandbox ? `${report.sandbox.new_action_id}: ${report.sandbox.verdict} / ${report.sandbox.reason}` : "Skipped.") : "Re-runs Fixer and Release on a copy of the graph; the real sinks are never touched.",
    },
    {
      title: "Compare and recommend",
      who: "auto",
      state: phase(has),
      detail: has ? report.recommendation : "Held payload against healed payload; the forensic agent never reads content.",
    },
    {
      title: "Release the healed version",
      who: "human",
      state: healed ? "done" : has && report.recommendation === "APPROVE_HEALED_RELEASE" ? "waiting" : "pending",
      detail: healed ? `${heal.actions[0]?.id} executed; the held action is superseded.` : has && report.recommendation === "APPROVE_HEALED_RELEASE" ? "Waiting for you. Releasing increases exposure, so a person decides." : "Needs a person once a healed release is recommended.",
    },
  ];
}

const LABEL: Record<StepState, string> = { pending: "Not started", working: "Working…", done: "Done", waiting: "Waiting for you" };

/** The Forensic Agent's response plan. Automatic steps are risk-reducing; the last one needs a person.
 *  The API answers the whole investigation in one request, so the steps are filled from the report. */
export function ResponsePlan({ report, busy, heal }: { report: ForensicReport | null; busy: boolean; heal: HealResult | null }) {
  const reduce = useReducedMotion();
  const steps = plan(report, busy, heal);
  return (
    <ol className="plan" aria-label="Forensic Agent response plan">
      {steps.map((s, i) => (
        <m.li
          key={s.title}
          className={`plan-step plan-${s.state}`}
          initial={false}
          animate={reduce ? undefined : { opacity: s.state === "pending" ? 0.7 : 1 }}
        >
          <span className="plan-dot" aria-hidden="true">
            {s.state === "done" ? (
              <m.span initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ delay: reduce || !report ? 0 : i * 0.12, type: "spring", stiffness: 500, damping: 18 }}>
                <Icon name="check" size={14} />
              </m.span>
            ) : s.state === "waiting" ? (
              <Icon name="user" size={14} />
            ) : (
              <span className="plan-num">{i + 1}</span>
            )}
          </span>
          <div className="plan-body">
            <div className="plan-title">
              <strong>{s.title}</strong>
              <ActorChip who={s.who} />
              <span className="plan-state">{LABEL[s.state]}</span>
            </div>
            <p className="muted">{s.detail}</p>
          </div>
        </m.li>
      ))}
    </ol>
  );
}
