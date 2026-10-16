import { useId } from "react";
import { Button } from "../../../shared/components/Button";
import { scrubberText, type MarkerView } from "./timeLogic";

interface ScrubberProps {
  t: number;
  max: number;
  markers: MarkerView[];
  playing: boolean;
  onChange: (t: number) => void;
  onJump: (t: number) => void;
  /** Start, continue or pause the replay. */
  onReplay: () => void;
}

/** The time control: a native range input (arrow keys, Home and End work), step buttons, a marker button for each story moment
 *  with its full words, and a replay. The ticks on the track are decoration; the marker buttons are the accessible form. */
export function Scrubber({ t, max, markers, playing, onChange, onJump, onReplay }: ScrubberProps) {
  const id = useId();
  const replayLabel = playing ? "Pause replay" : t >= max || t === 0 ? "Replay from 0" : "Continue replay";
  return (
    <div className="pw-scrub">
      <div className="pw-scrub__row">
        <Button size="sm" aria-label="Previous step" disabled={t <= 0} onClick={() => onChange(t - 1)}>
          <span aria-hidden="true">◀</span>
        </Button>
        <div className="pw-scrub__track">
          <label htmlFor={id} className="pw-visually-hidden">
            Logical time
          </label>
          <input id={id} type="range" min={0} max={max} step={1} value={Math.min(t, max)} aria-valuetext={scrubberText(t, max)} onChange={(e) => onChange(Number(e.target.value))} />
          <span className="pw-scrub__ticks" aria-hidden="true">
            {markers.map((m) => m.marker && <span key={m.key} className={m.here ? "pw-scrub__tick pw-scrub__tick--here" : "pw-scrub__tick"} style={{ left: `${m.percent}%` }} />)}
          </span>
        </div>
        <Button size="sm" aria-label="Next step" disabled={t >= max} onClick={() => onChange(t + 1)}>
          <span aria-hidden="true">▶</span>
        </Button>
        <output className="pw-scrub__clock" htmlFor={id}>
          t = {t} / {max}
        </output>
        <Button size="sm" variant={playing ? "secondary" : "primary"} aria-pressed={playing} onClick={onReplay}>
          {replayLabel}
        </Button>
      </div>
      <div className="pw-scrub__markers" role="group" aria-label="Story moments">
        {markers.map((m) => (
          <Button key={m.key} size="sm" disabled={m.marker === null} aria-pressed={m.here} onClick={() => m.marker && onJump(m.marker.t)}>
            {m.here ? "● " : "◆ "}
            {m.text}
          </Button>
        ))}
      </div>
    </div>
  );
}
