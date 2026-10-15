import type { RuleOfTwo as RuleOfTwoData } from "../api/types";

const MEANING = {
  A: "A: processes untrusted input",
  B: "B: has access to secrets",
  C: "C: changes state or communicates externally",
} as const;

/** The A/B/C letters of Meta's Agents Rule of Two for one session, and its verdict. */
export function RuleOfTwoBadge({ data }: { data: RuleOfTwoData }) {
  return (
    <span className="r2">
      {(["A", "B", "C"] as const).map((letter) => (
        <span key={letter} className={data[letter] ? "pill on" : "pill off"} title={MEANING[letter]}>
          {letter}
        </span>
      ))}
      <span className={data.green ? "badge green" : "badge red"}>
        {data.green ? "✓ Rule of Two OK" : "✗ Rule of Two violated"}
      </span>
    </span>
  );
}
