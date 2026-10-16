import { useCallback, useEffect, useRef, useState } from "react";
import { api, setWorkspace } from "../api/client";
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
import { RunTab } from "../tabs/Run";
import { TimeTravelTab } from "../tabs/TimeTravel";
import { Nav } from "./Nav";
import { navItem } from "./navModel";
import { StatusFooter } from "./StatusFooter";
import { Unreachable } from "./Unreachable";
import { buildSearch, navigateState, parseUrl, type TabId, type UrlState } from "./url";
import { useHealth } from "./useHealth";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import "./shell.css";

/** The application shell (ui-redesign.md §13.1): a rail on laptops and up, a top bar with a menu below that, the
 *  attention count, system status, and the view. The URL is the shareable state; views start from it once. */
export function Shell() {
  const [url, setUrl] = useState<UrlState>(() => parseUrl(window.location.search));
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
    (tab: TabId, ws?: string) => {
      const next = navigateState(url, tab, ws);
      setWorkspace(next.ws);
      window.history.pushState(null, "", buildSearch(next));
      setUrl(next);
      setMenuOpen(false);
    },
    [url],
  );

  const changeTheme = useCallback((next: ThemePreference) => {
    setTheme(next);
    applyTheme(next);
  }, []);

  // held and blocked actions are the ones waiting for a human; the poll pauses while the tab is hidden or a run is in flight
  const healthy = health.status === "ok";
  const actions = usePoll(() => (healthy ? api.actions() : Promise.resolve([])), 5000);
  const attention = (actions.data ?? []).filter((a) => a.status === "held" || a.status === "blocked").length;

  const sidebar = (
    <>
      <WorkspaceSwitcher workspace={url.ws} onChange={(ws) => go(url.tab, ws)} />
      <Nav url={url} attention={attention} onNavigate={(tab) => go(tab)} />
      <StatusFooter health={health} theme={theme} onTheme={changeTheme} />
    </>
  );

  const failed = health.status === "unreachable" || health.status === "db_down" || health.status === "error";
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
          ) : (
            <ViewHost url={url} key={`${url.tab}:${url.ws}`} />
          )}
        </main>
      </div>
    </div>
  );
}

function ViewHost({ url }: { url: UrlState }) {
  switch (url.tab) {
    case "run":
      return <RunTab initial={{ scenario: url.scenario, guard: url.guard, autorun: url.autorun, mode: url.mode }} />;
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
