import { StatusPill } from "../../shared/components/StatusPill";
import { useOnceVisible } from "../../shared/lib/motion";
import { WitnessPaths } from "../../app/views/investigate/WitnessPaths";
import type { Plate } from "../landingLogic";

/** FIG. 1: the lineage of the held action, as recorded from a real scripted run: two rails (solid untrusted, dotted secret) from the
 *  payload to their sources, and the gate bar before the sink. Static: no live pulse, no invented activity. The ids and paths are the
 *  gate's own answer (`q2a_untrusted_witness`, `q2b_secret_witness`), recorded by `scripts/capture_landing_story.py`. */
export function WitnessPlate({ plate, scenario }: { plate: Plate; scenario: string }) {
  const payload = plate.untrusted[0];
  // the trace runs once, when the figure is half visible (an IntersectionObserver, not a scroll listener)
  const [ref, seen] = useOnceVisible<HTMLElement>(0.5);
  return (
    <figure className="pw-plate" ref={ref}>
      <div className="pw-plate__sheet">
        <p className="pw-plate__payload">
          <span className="pw-eyebrow">payload</span> <strong>{payload?.label ?? plate.payloadId}</strong> <code>{plate.payloadId}</code>
        </p>
        <WitnessPaths untrusted={plate.untrusted} secret={plate.secret} queries={{}} trace={`${plate.actionId}:fig1`} traceReady={seen} headings={false} />
        <p className="pw-plate__gate">
          <span className="pw-plate__bar" aria-hidden="true" />
          <StatusPill status={`${plate.verdict} · ${plate.reason}`} family="hold" />
          <span>
            before <code>{plate.sink}</code> ({plate.external ? "external" : "internal"})
          </span>
        </p>
      </div>
      <figcaption className="pw-plate__caption">
        <span className="pw-eyebrow">FIG. 1</span> Lineage of <code>{plate.actionId}</code>, recorded by Pathwarden in a scripted run of <code>{scenario}</code>. Paths returned by{" "}
        <code>q2a_untrusted_witness</code> and <code>q2b_secret_witness</code>.
      </figcaption>
    </figure>
  );
}
