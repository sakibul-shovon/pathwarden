import { PayloadDiff } from "../../app/views/investigate/PayloadDiff";
import type { LandingStory } from "../story";
import { Section } from "./Section";

const STEPS = [
  { title: "Find the source", text: "Trace the untrusted source and the memories that carried it across sessions (query q3)." },
  { title: "Quarantine", text: "Seal everything derived from it. This is automatic because it only reduces risk, and it is reversible." },
  { title: "Replay in a sandbox", text: "Run Fixer and Release again in a copy of the graph (GRAPH.COPY), so the main graph is untouched." },
  { title: "Gate the healed result", text: "The same gate decides the replayed release." },
  { title: "A person releases it", text: "Releasing puts risk back, so it needs a human. Pathwarden never releases on its own." },
] as const;

/** After a hold: the repair path, with the held and healed payloads of the recorded run side by side. */
export function Heal({ story }: { story: LandingStory }) {
  const r = story.heal.report;
  return (
    <Section
      id="heal"
      eyebrow="After a hold"
      title="Repair the run, not just block it"
      lead={
        <p>
          In the recorded run the quarantine <code>{r.quarantine_id}</code> sealed {r.quarantined_artifacts.length} artifacts, and the sandbox replay was gated {r.sandbox?.verdict} ({r.sandbox?.reason}).
          The recommendation: <strong>{r.recommendation.replaceAll("_", " ").toLowerCase()}</strong>, for a person to decide.
        </p>
      }
    >
      <ol className="pw-steps5">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <span className="pw-steps5__n" aria-hidden="true">
              {i + 1}
            </span>
            <strong>{s.title}</strong>
            <span>{s.text}</span>
          </li>
        ))}
      </ol>
      <figure className="pw-fig">
        <PayloadDiff held={{ id: story.heal.held.id, content: story.heal.held.content, error: null }} healed={{ id: story.heal.healed.id, content: story.heal.healed.content, error: null }} />
        <figcaption className="pw-fig__caption">
          The held payload (main graph) and the healed payload (sandbox graph) of the recorded run. The gate and the Forensic Agent never read this text; it is shown here, and in the app, only for a person.
        </figcaption>
      </figure>
    </Section>
  );
}
