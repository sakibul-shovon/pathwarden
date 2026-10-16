import type { ScenarioInfo } from "../../../api/types";
import { Skeleton } from "../../../shared/components/Skeleton";
import { scenarioExpectation } from "./runLogic";

interface ScenarioListProps {
  scenarios: ScenarioInfo[];
  value: string;
  onChange: (name: string) => void;
  disabled?: boolean;
  /** The scenario list has not arrived yet. */
  loading?: boolean;
}

/** A radio group: arrow keys move the selection. Each row shows the story and what the API says the guard does with it. */
export function ScenarioList({ scenarios, value, onChange, disabled, loading }: ScenarioListProps) {
  if (loading) return <Skeleton lines={6} height={36} />;
  return (
    <fieldset className="pw-scn" disabled={disabled}>
      <legend className="pw-scn__legend">Scenario</legend>
      {scenarios.map((s) => (
        <label key={s.name} className={s.name === value ? "pw-scn__row pw-scn__row--on" : "pw-scn__row"}>
          <input className="pw-visually-hidden" type="radio" name="scenario" value={s.name} checked={s.name === value} onChange={() => onChange(s.name)} />
          <code className="pw-scn__name">{s.name}</code>
          <span className="pw-scn__desc">{s.description}</span>
          <span className="pw-scn__expect">{scenarioExpectation(s.expected)}</span>
        </label>
      ))}
    </fieldset>
  );
}
