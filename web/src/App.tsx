import { useMemo, useState } from "react";
import { InvestigateTab } from "./tabs/Investigate";
import { RunTab } from "./tabs/Run";

type TabId = "run" | "investigate" | "time" | "memory" | "remediate" | "evaluation";

const TABS: { id: TabId; label: string; built: boolean; note?: string }[] = [
  { id: "run", label: "Run", built: true },
  { id: "investigate", label: "Investigate", built: true },
  { id: "time", label: "Time travel", built: false, note: "arrives in P10b" },
  { id: "memory", label: "Memory", built: false, note: "arrives in P10b" },
  { id: "remediate", label: "Remediate", built: false, note: "arrives in P10c" },
  { id: "evaluation", label: "Evaluation", built: false, note: "arrives in P10c" },
];

/** Deep links make a state reproducible (and checkable in a headless browser):
 *  ?tab=investigate&scenario=attack_pipeline_42&guard=off&autorun=1&autoforensics=1&autoheal=1 */
function readUrl(): {
  tab: TabId;
  scenario: string;
  guard: boolean;
  autorun: boolean;
  autoForensics: boolean;
  autoHeal: boolean;
} {
  const q = new URLSearchParams(window.location.search);
  const tab = (q.get("tab") ?? "run") as TabId;
  return {
    tab: TABS.some((t) => t.id === tab && t.built) ? tab : "run",
    scenario: q.get("scenario") ?? "attack_pipeline_42",
    guard: q.get("guard") !== "off",
    autorun: q.get("autorun") === "1",
    autoForensics: q.get("autoforensics") === "1",
    autoHeal: q.get("autoheal") === "1",
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
              disabled={!t.built}
              title={t.built ? undefined : t.note}
              aria-current={t.id === tab ? "page" : undefined}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {!t.built && <span className="soon"> ({t.note})</span>}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === "run" && <RunTab initial={{ scenario: url.scenario, guard: url.guard, autorun: url.autorun }} />}
        {tab === "investigate" && <InvestigateTab autoForensics={url.autoForensics} autoHeal={url.autoHeal} />}
      </main>
    </div>
  );
}
