/** Per-view graph preferences (Graph or Table, Lanes or Tree). A per-browser convenience kept in `localStorage`: the view
 *  must work, and look right, when storage is blocked. */

export interface GraphPrefs {
  view: "graph" | "table";
  layout: "lanes" | "tree";
}

export const DEFAULT_PREFS: GraphPrefs = { view: "graph", layout: "lanes" };

export const prefsKey = (scope: string): string => `pw_graph:${scope}`;

export function parsePrefs(raw: unknown): GraphPrefs {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return DEFAULT_PREFS;
    }
  }
  if (typeof value !== "object" || value === null) return DEFAULT_PREFS;
  const v = value as Record<string, unknown>;
  return {
    view: v.view === "table" ? "table" : "graph",
    layout: v.layout === "tree" ? "tree" : "lanes",
  };
}

export function readPrefs(scope: string): GraphPrefs {
  try {
    return parsePrefs(window.localStorage.getItem(prefsKey(scope)));
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writePrefs(scope: string, prefs: GraphPrefs): void {
  try {
    window.localStorage.setItem(prefsKey(scope), JSON.stringify(prefs));
  } catch {
    // storage can be blocked; the choice still applies until the page is closed
  }
}
