import { createContext, useContext } from "react";
import type { IconName } from "./ui/Icon";

export type TabId = "home" | "run" | "investigate" | "time" | "memory" | "remediate" | "evaluation";

export interface ViewInfo {
  id: Exclude<TabId, "home">;
  label: string;
  group: string;
  icon: IconName;
  /** One line that answers "what am I looking at?". */
  lead: string;
  /** Needs a workspace key when the API runs in hosted mode (PW_AUTH=on). */
  workspace: boolean;
}

export const VIEWS: ViewInfo[] = [
  { id: "run", label: "Run", group: "Simulate", icon: "play", workspace: true,
    lead: "Watch three agents work on one issue. Turn the guard off to see a secret leak, then on to see it held." },
  { id: "investigate", label: "Investigate", group: "Respond", icon: "hold", workspace: true,
    lead: "A held action is a case. See why it was stopped, run the Forensic Agent, then decide." },
  { id: "memory", label: "Memory", group: "Respond", icon: "store", workspace: true,
    lead: "Everything the agents wrote to shared team memory, and where each entry came from." },
  { id: "time", label: "Time travel", group: "Replay", icon: "clock", workspace: true,
    lead: "Scrub the lineage graph back to the moment the attack entered and the moment it became dangerous." },
  { id: "remediate", label: "Remediate", group: "Prevent", icon: "scissors", workspace: false,
    lead: "Find the cheapest permissions to revoke so this kind of leak path cannot exist at all." },
  { id: "evaluation", label: "Evaluation", group: "Prove", icon: "graph", workspace: false,
    lead: "Measured results of the defenses on generated scenarios. Nothing here is typed by hand." },
];

/** The suggested path through the product, used for the "next step" hints. */
export const JOURNEY: ViewInfo["id"][] = ["run", "investigate", "time", "memory", "remediate", "evaluation"];

export const NavContext = createContext<{ tab: TabId; go: (tab: TabId) => void }>({ tab: "home", go: () => undefined });
export const useNav = (): { tab: TabId; go: (tab: TabId) => void } => useContext(NavContext);
