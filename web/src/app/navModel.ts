import type { IconName } from "../shared/icons/Icon";
import type { TabId } from "./url";

/** Labels are the ones used by the README, docs/MCP.md and the demo script (ui-redesign.md §10.3): only the order
 *  changed (Memory before Time travel follows the investigation flow). Four views act on one workspace graph, two on
 *  global demo data, and the rail says so. */
export interface NavItem {
  id: TabId;
  label: string;
  group: "workspace" | "global";
  icon: IconName;
  /** One line under the view title. */
  blurb: string;
}

export const NAV: NavItem[] = [
  { id: "run", label: "Run", group: "workspace", icon: "play", blurb: "Reproduce a demo scenario with or without the guard and see what each agent did." },
  { id: "investigate", label: "Investigate", group: "workspace", icon: "search", blurb: "Held and blocked actions: why they were stopped, the proof, and how to repair them." },
  { id: "memory", label: "Memory", group: "workspace", icon: "barrel", blurb: "What is in shared team memory, where it came from, and what is quarantined." },
  { id: "time", label: "Time travel", group: "workspace", icon: "clock", blurb: "Replay the lineage graph at any logical time." },
  { id: "remediate", label: "Remediate", group: "global", icon: "cut", blurb: "Find the cheapest verified set of permissions to remove so the leak path cannot exist." },
  { id: "evaluation", label: "Evaluation", group: "global", icon: "table", blurb: "Generated results of the 120-scenario evaluation, including where Pathwarden is not better." },
];

export const GROUP_LABEL: Record<NavItem["group"], string> = {
  workspace: "This workspace",
  global: "Across workspaces",
};

export const navItem = (id: TabId): NavItem => NAV.find((n) => n.id === id) ?? (NAV[0] as NavItem);

/** The `-mcp` workspace shows the lineage the MCP gateway wrote (decision D-026); both belong to one tenant. */
export const MCP_SUFFIX = "-mcp";
export const baseWorkspace = (ws: string): string => ws.endsWith(MCP_SUFFIX) ? ws.slice(0, -MCP_SUFFIX.length) : ws;
export const mcpWorkspace = (ws: string): string => `${baseWorkspace(ws)}${MCP_SUFFIX}`;
