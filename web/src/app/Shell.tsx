import { useCallback, useEffect, useRef, useState } from "react";
import { api, clearKey, hasKey, setWorkspace } from "../api/client";
import { usePoll } from "../hooks";
import { Button } from "../shared/components/Button";
import { Dialog } from "../shared/components/Dialog";
import { Wordmark } from "../shared/components/Wordmark";
import { Icon } from "../shared/icons/Icon";
import { applyTheme, readStoredTheme, type ThemePreference } from "../shared/lib/theme";
import { EvaluationTab } from "../tabs/Evaluation";
import { InvestigateTab } from "../tabs/Investigate";
import { MemoryTab } from "../tabs/Memory";
import { RemediateTab } from "../tabs/Remediate";
import { TimeTravelTab } from "../tabs/TimeTravel";
import { Connect } from "./Connect";
import { readOnboarding, writeOnboarding } from "./guide";
import { Nav } from "./Nav";
import { navItem } from "./navModel";
import { StatusFooter } from "./StatusFooter";
import { RunView } from "./views/run/RunView";
import { Unreachable } from "./Unreachable";
import { buildSearch, navigateState, parseUrl, type TabId, type UrlState } from "./url";
import { blocksWorkspaceViews, useAccess } from "./useAccess";
import { useHealth } from "./useHealth";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import "./shell.css";

/** The application shell (ui-redesign.md §13.1): a rail on laptops and up, a top bar with a menu below that, the
 *  attention count, system status, and the view. The URL is the shareable state; views start from it once. */
export function Shell() {
  const [url, setUrl] = useState<UrlState>(() => {
    const parsed = parseUrl(window.location.search);
    // a returning visitor without a deep link lands on the view they used last
    const last = window.location.search === "" ? readOnboarding().lastTab : null;
    return last ? { ...parsed, tab: last } : parsed;
  });
  const [announcement, setAnnouncement] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme);
  const { health, retry } = useHealth();
  const heading = useRef<HTMLHeadingElement>(null);
  const shown = useRef({ tab: url.tab, ws: url.ws });

  // the one-shot flags (autorun, ...) were consumed by the first render: keep the address bar to the shareable state
  useEffect(() => {
    window.history.replaceState(null, "", buildSearch(url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onPop = (): void => {
      const next = parseUrl(window.location.search);
      setWorkspace(next.ws);
      setUrl(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const item = navItem(url.tab);
  useEffect(() => {
    document.title = `${item.label} · ${url.ws} · Pathwarden`;
    // keyboard and screen-reader users land on the new view's title, but only when the view really changed
    // (not on load, and not on the second effect run of React StrictMode in development)
    if (shown.current.tab !== url.tab || shown.current.ws !== url.ws) {
      shown.current = { tab: url.tab, ws: url.ws };
      heading.current?.focus();
    }
  }, [item.label, url.ws, url.tab]);

  const go = useCallback(
    (tab: TabId, ws?: string, patch?: Partial<UrlState>) => {
      const next: UrlState = { ...navigateState(url, tab, ws), ...patch };
      setWorkspace(next.ws);
      window.history.pushState(null, "", buildSearch(next));
      writeOnboarding({ ...readOnboarding(), lastTab: next.tab });
      setUrl(next);
      setMenuOpen(false);
    },
    [url],
  );

  const changeTheme = useCallback((next: ThemePreference) => {
    setTheme(next);
    applyTheme(next);
  }, []);

  const healthy = health.status === "ok";
  const { access, recheck } = useAccess(url.ws, healthy);
  const open = healthy && access === "open";
  // held and blocked actions are the ones waiting for a human; the poll pauses while the tab is hidden or a run is in flight
  const actions = usePoll(() => (open ? api.actions() : Promise.resolve([])), 5000);
  const attention = (actions.data ?? []).filter((a) => a.status === "held" || a.status === "blocked").length;

  const connected = useCallback(
    (ws: string) => {
      setAnnouncement(`Connected to ${ws}.`);
      go(url.tab, ws);
      recheck();
    },
    [go, recheck, url.tab],
  );
  const signOut = useCallback(() => {
    clearKey();
    setAnnouncement("Signed out.");
    recheck();
  }, [recheck]);

  const sidebar = (
    <>
      <WorkspaceSwitcher workspace={url.ws} onChange={(ws) => go(url.tab, ws)} />
      <Nav url={url} attention={attention} onNavigate={(tab) => go(tab)} />
      <StatusFooter health={health} theme={theme} onTheme={changeTheme} signedIn={hasKey()} onSignOut={signOut} />
    </>
  );

  const failed = health.status === "unreachable" || health.status === "db_down" || health.status === "error";
  // the two global views (Remediate, Evaluation) are public demo data: only the workspace views ask for a key
  const workspaceView = url.tab === "run" || url.tab === "investigate" || url.tab === "memory" || url.tab === "time";
  const needsConnect = !failed && workspaceView && blocksWorkspaceViews(access);
  return (
    <div className="pw-shell">
      <a className="pw-skip" href="#main">
        Skip to content
      </a>
      <aside className="pw-rail" aria-label="Workspace and views">
        <a className="pw-rail__brand" href="../" aria-label="Pathwarden, back to the site">
          <Wordmark />
        </a>
        {sidebar}
      </aside>
      <div className="pw-shell__main">
        <header className="pw-topbar">
          <a className="pw-rail__brand" href="../" aria-label="Pathwarden, back to the site">
            <Wordmark size={18} />
          </a>
          <span className="pw-topbar__where">
            {item.label} · {url.ws}
          </span>
          <Button size="sm" aria-haspopup="dialog" onClick={() => setMenuOpen(true)}>
            <Icon name="menu" size={16} /> Menu
          </Button>
        </header>
        <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" variant="drawer">
          <div className="pw-menu">{sidebar}</div>
        </Dialog>
        <main id="main" className="pw-main">
          <div className="pw-pagehead">
            <h1 ref={heading} tabIndex={-1}>
              {item.label}
            </h1>
            <p className="pw-muted">{item.blurb}</p>
          </div>
          {failed ? (
            <Unreachable health={health} onRetry={retry} />
          ) : needsConnect ? (
            <Connect workspace={url.ws} reason={access as "needs_key" | "rejected" | "forbidden"} onConnected={connected} />
          ) : (
            <ViewHost url={url} key={`${url.tab}:${url.ws}`} onNavigate={(tab, patch) => go(tab, undefined, patch)} />
          )}
        </main>
        <div role="status" className="pw-visually-hidden">
          {announcement}
        </div>
      </div>
    </div>
  );
}

function ViewHost({ url, onNavigate }: { url: UrlState; onNavigate: (tab: TabId, patch?: Partial<UrlState>) => void }) {
  switch (url.tab) {
    case "run":
      return <RunView initial={{ scenario: url.scenario, guard: url.guard, autorun: url.autorun, mode: url.mode }} workspace={url.ws} onNavigate={onNavigate} />;
    case "investigate":
      return <InvestigateTab autoForensics={url.autoForensics} autoHeal={url.autoHeal} />;
    case "memory":
      return <MemoryTab />;
    case "time":
      return <TimeTravelTab initialT={url.t} />;
    case "remediate":
      return <RemediateTab initialTopology={url.topology} />;
    case "evaluation":
      return <EvaluationTab />;
  }
}
