import type { EvalSummary } from "../../api/types";
import { CodeBlock } from "../../shared/components/CodeBlock";
import { README } from "../landingData";
import { ctaFor, parseNonGoals, perfectScoreCaveat, RUN_COMMANDS, type Probe } from "../landingLogic";
import { Section } from "./Section";

/** Trust: what Pathwarden does not claim, in the README's own list plus the generated caveat about a perfect score. */
export function Limits({ summary }: { summary: EvalSummary }) {
  const goals = parseNonGoals(README);
  const caveat = perfectScoreCaveat(summary);
  return (
    <Section id="limits" eyebrow="What it does not claim" title="Where Pathwarden stops">
      <p className="pw-prose">Pathwarden does not claim to stop:</p>
      <ul className="pw-prose-list">
        {goals.map((g) => (
          <li key={g}>{g}</li>
        ))}
      </ul>
      {caveat && <p className="pw-prose">{caveat}</p>}
    </Section>
  );
}

/** Conversion: the four commands of the README quickstart, one copy button each, and the same primary action as the hero. */
export function RunIt({ probe }: { probe: Probe }) {
  const cta = ctaFor(probe);
  return (
    <Section id="run-it" eyebrow="Run it" title="Run it on your machine" lead={<p>Docker, Python 3.11, GNU Make (Git Bash on Windows) and Node 22 for the UI. No API key, no account.</p>}>
      <ul className="pw-cmds">
        {RUN_COMMANDS.map((c) => (
          <li key={c.command}>
            <CodeBlock code={c.command} label={c.command} />
            <span className="pw-muted">{c.note}</span>
          </li>
        ))}
      </ul>
      <p className="pw-hero__ctas">
        <a className="pw-btn pw-btn--primary pw-ctabtn" href="app/">
          Open the workspace
        </a>
        {cta.fallback && <span className="pw-muted pw-hero__note">({cta.fallback.note})</span>}
      </p>
    </Section>
  );
}
