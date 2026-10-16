import { formatElapsed } from "./runLogic";

interface RunStatusProps {
  scenario: string;
  guard: boolean;
  mode: "scripted" | "live";
  model: string | null;
  elapsedMs: number;
}

/** Shown once a run has taken more than a second. The API reports no progress (one blocking request), so this says what
 *  is running and for how long: no percent, no estimate. The timer is hidden from screen readers (it would chatter). */
export function RunStatus({ scenario, guard, mode, model, elapsedMs }: RunStatusProps) {
  return (
    <div className="pw-runstatus" role="status">
      <span className="pw-runstatus__bar" aria-hidden="true" />
      <p>
        Running <code>{scenario}</code> · guard {guard ? "on" : "off"} · {mode}{" "}
        <span aria-hidden="true" className="pw-runstatus__time">
          {formatElapsed(elapsedMs)}
        </span>
      </p>
      <p className="pw-muted">
        {mode === "live" ? `The live agents call ${model ?? "the configured model"}; rate-limited providers can take minutes. ` : ""}
        Results appear when the run finishes.
      </p>
    </div>
  );
}
