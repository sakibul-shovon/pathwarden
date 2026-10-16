import type { RuleOfTwo } from "../../api/types";
import { Icon } from "../icons/Icon";

const MEANING = {
  A: "processes untrusted input",
  B: "has access to secrets",
  C: "changes state or communicates externally",
} as const;

/** The A/B/C letters of Meta's Agents Rule of Two for one session. The meaning is visible text, not a hover tooltip. */
export function RuleOfTwoLetters({ data, legend }: { data: RuleOfTwo; legend?: boolean }) {
  return (
    <span className="pw-r2">
      <span className="pw-r2__letters">
        {(["A", "B", "C"] as const).map((letter) => (
          <span key={letter} className={data[letter] ? "pw-r2__letter pw-r2__letter--on" : "pw-r2__letter pw-r2__letter--off"}>
            {letter}
            <span className="pw-visually-hidden">
              {" "}
              {MEANING[letter]}: {data[letter] ? "yes" : "no"}
            </span>
          </span>
        ))}
      </span>
      <span className={data.green ? "pw-status pw-status--allow" : "pw-status pw-status--hold"}>
        <Icon name={data.green ? "check" : "warning"} size={14} />
        <span>{data.green ? "Rule of Two OK" : "Rule of Two violated"}</span>
      </span>
      {legend && (
        <span className="pw-r2__legend">
          A untrusted input · B secrets · C changes state or communicates outside
        </span>
      )}
    </span>
  );
}
