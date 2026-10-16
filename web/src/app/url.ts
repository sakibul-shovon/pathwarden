import type { Topology } from "../api/types";

/** The URL is the shareable state of the app. The parameters are the documented deep-link contract (decision A-16,
 *  ui-redesign.md §3.2); this module only reads and writes them, it never changes their meaning. */

export const TAB_IDS = ["run", "investigate", "memory", "time", "remediate", "evaluation"] as const;
export type TabId = (typeof TAB_IDS)[number];

export const DEFAULT_WORKSPACE = "tinyqueue";
export const DEFAULT_SCENARIO = "attack_pipeline_42";

export interface UrlState {
  tab: TabId;
  ws: string;
  scenario: string;
  guard: boolean;
  mode: "scripted" | "live";
  /** One-shot automation flags (`autorun`, `autoforensics`, `autoheal`): honoured on load, never written back. */
  autorun: boolean;
  autoForensics: boolean;
  autoHeal: boolean;
  t: number | null;
  topology: Topology;
  /** The action opened in the Investigate case file. */
  action: string | null;
}

const WORKSPACE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const ACTION = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;

export const isTabId = (value: string | null): value is TabId => TAB_IDS.some((id) => id === value);

export function parseUrl(search: string): UrlState {
  const q = new URLSearchParams(search);
  const tab = q.get("tab");
  const ws = q.get("ws");
  const action = q.get("action");
  return {
    tab: isTabId(tab) ? tab : "run",
    ws: ws !== null && WORKSPACE.test(ws) ? ws : DEFAULT_WORKSPACE,
    scenario: q.get("scenario") ?? DEFAULT_SCENARIO,
    guard: q.get("guard") !== "off",
    mode: q.get("mode") === "live" ? "live" : "scripted",
    autorun: q.get("autorun") === "1",
    autoForensics: q.get("autoforensics") === "1",
    autoHeal: q.get("autoheal") === "1",
    t: /^\d+$/.test(q.get("t") ?? "") ? Number(q.get("t")) : null,
    topology: q.get("topology") === "tinyqueue3" ? "tinyqueue3" : "enterprise12",
    action: action !== null && ACTION.test(action) ? action : null,
  };
}

/** The query string for a state: only what differs from the defaults, in a stable order, without the one-shot flags. */
export function buildSearch(state: UrlState): string {
  const q = new URLSearchParams();
  q.set("tab", state.tab);
  if (state.ws !== DEFAULT_WORKSPACE) q.set("ws", state.ws);
  if (state.tab === "run") {
    if (state.scenario !== DEFAULT_SCENARIO) q.set("scenario", state.scenario);
    if (!state.guard) q.set("guard", "off");
    if (state.mode === "live") q.set("mode", "live");
  } else if (state.tab === "investigate") {
    if (state.action) q.set("action", state.action);
  } else if (state.tab === "time") {
    if (state.t !== null) q.set("t", String(state.t));
  } else if (state.tab === "remediate") {
    if (state.topology === "tinyqueue3") q.set("topology", "tinyqueue3");
  }
  return `?${q.toString()}`;
}

/** Switching view or workspace starts the new view from its defaults but keeps the workspace. */
export function navigateState(from: UrlState, tab: TabId, ws: string = from.ws): UrlState {
  return { ...parseUrl(""), tab, ws };
}
