import { ctaFor, EVIDENCE, blob, type Plate, type Probe } from "../landingLogic";
import { WitnessPlate } from "./WitnessPlate";

/** The problem and the mechanism in ten seconds. The primary action reflects the health probe, so the page never offers a workspace
 *  that is not there; the fact line states three structural properties of the gate, each linked to its evidence. */
export function Hero({ probe, plate, scenario }: { probe: Probe; plate: Plate; scenario: string }) {
  const cta = ctaFor(probe);
  return (
    <section id="top" className="pw-hero" aria-labelledby="top-title">
      <div className="pw-hero__text">
        <p className="pw-eyebrow">Provenance gate for multi-agent systems · built on FalkorDB</p>
        <h1 id="top-title" className="pw-hero__title pw-display">
          Every agent passes its safety check. The system still leaks.
        </h1>
        <p className="pw-hero__sub">
          Pathwarden records what every agent reads and writes as a lineage graph in FalkorDB. Before anything leaves, two path queries ask one question:
          does this payload descend from untrusted input <strong>and</strong> from a secret, through any chain of agents, memories and days? If both paths exist,
          the action is held and both are shown.
        </p>
        <p className="pw-hero__ctas">
          <a className="pw-btn pw-btn--primary pw-ctabtn" href={cta.primary.href}>
            {cta.primary.label}
          </a>
          {cta.secondary.map((l) => (
            <a key={l.label} className="pw-hero__link" href={l.href}>
              {l.label}
            </a>
          ))}
        </p>
        {/* this line is always there, so the page does not move when the probe answers */}
        <p className="pw-hero__fallback">
          {cta.fallback && (
            <>
              <a href={cta.fallback.link.href}>{cta.fallback.link.label}</a> <span className="pw-muted">({cta.fallback.note})</span>
            </>
          )}
        </p>
        <ul className="pw-facts-line" aria-label="Properties of the gate">
          <li>
            <a href={EVIDENCE.gate} target="_blank" rel="noreferrer noopener">
              {plate.llmCalls} LLM calls per decision
            </a>
          </li>
          <li>
            <a href={EVIDENCE.invariants} target="_blank" rel="noreferrer noopener">
              metadata only: never reads content
            </a>
          </li>
          <li>
            <a href={`${blob("README.md")}#11-evaluation`} target="_blank" rel="noreferrer noopener">
              same answer every run
            </a>
          </li>
        </ul>
      </div>
      <WitnessPlate plate={plate} scenario={scenario} />
    </section>
  );
}
