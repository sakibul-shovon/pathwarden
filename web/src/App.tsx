import { useMemo, useState } from "react";
import { InvestigateTab } from "./tabs/Investigate";
import { EvaluationTab } from "./tabs/Evaluation";
import { MemoryTab } from "./tabs/Memory";
import { RemediateTab } from "./tabs/Remediate";
import { RunTab } from "./tabs/Run";
import { TimeTravelTab } from "./tabs/TimeTravel";

type TabId = "run" | "investigate" | "time" | "memory" | "remediate" | "evaluation";

const TABS: { id: TabId; label: string }[] = [
  { id: "run", label: "Run" },
  { id: "investigate", label: "Investigate" },
  { id: "time", label: "Time travel" },
  { id: "memory", label: "Memory" },
  { id: "remediate", label: "Remediate" },
  { id: "evaluation", label: "Evaluation" },
];

/** Deep links make a state reproducible (and checkable in a headless browser):
 *  ?tab=investigate&scenario=attack_pipeline_42&guard=off&autorun=1&autoforensics=1&autoheal=1
 *  ?tab=time&t=16 opens the Time travel tab at logical time 16; ?tab=remediate&topology=tinyqueue3 picks a topology. */
function readUrl(): {
  tab: TabId;
  scenario: string;
  guard: boolean;
  autorun: boolean;
  mode: "scripted" | "live";
  autoForensics: boolean;
  autoHeal: boolean;
  t: number | null;
  topology: "enterprise12" | "tinyqueue3";
} {
  const q = new URLSearchParams(window.location.search);
  const tab = (q.get("tab") ?? "run") as TabId;
  return {
    tab: TABS.some((t) => t.id === tab) ? tab : "run",
    scenario: q.get("scenario") ?? "attack_pipeline_42",
    guard: q.get("guard") !== "off",
    autorun: q.get("autorun") === "1",
    mode: q.get("mode") === "live" ? "live" : "scripted",
    autoForensics: q.get("autoforensics") === "1",
    autoHeal: q.get("autoheal") === "1",
    t: /^\d+$/.test(q.get("t") ?? "") ? Number(q.get("t")) : null,
    topology: q.get("topology") === "tinyqueue3" ? "tinyqueue3" : "enterprise12",
  };
}

export function App() {
  const url = useMemo(readUrl, []);
  const [tab, setTab] = useState<TabId>(url.tab);

  return (
    <div className="app">
      <header>
        <h1>Pathwarden</h1>
        <p className="tagline">Every agent passes its safety check. The system still leaks. Pathwarden sees the path.</p>
        <nav aria-label="Tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === tab ? "tab active" : "tab"}
              aria-current={t.id === tab ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === "run" && <RunTab initial={{ scenario: url.scenario, guard: url.guard, autorun: url.autorun, mode: url.mode }} />}
        {tab === "investigate" && <InvestigateTab autoForensics={url.autoForensics} autoHeal={url.autoHeal} />}
        {tab === "time" && <TimeTravelTab initialT={url.t} />}
        {tab === "memory" && <MemoryTab />}
        {tab === "remediate" && <RemediateTab initialTopology={url.topology} />}
        {tab === "evaluation" && <EvaluationTab />}
      </main>
    </div>
  );
}
