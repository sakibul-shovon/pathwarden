import { m } from "motion/react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { api, workspaceName } from "../api/client";
import { usePoll } from "../hooks";
import { useTheme, setThemePref, type ThemePref } from "../theme";
import { JOURNEY, VIEWS, useNav, type TabId } from "../nav";
import { Icon, type IconName } from "../ui/Icon";
import { Mark } from "../ui/Mark";
import { Menu } from "../ui/Menu";
import { useActions } from "./actions";
import { useAuth } from "./auth";

const GROUPS = ["Simulate", "Respond", "Replay", "Prevent", "Prove"];

function NavLinks({ onPick }: { onPick?: () => void }) {
  const { tab, go } = useNav();
  const { needsReview } = useActions();
  const pick = (id: TabId): void => {
    go(id);
    onPick?.();
  };
  return (
    <div className="nav-links">
      <button type="button" className={tab === "home" ? "nav-item active" : "nav-item"} aria-current={tab === "home" ? "page" : undefined} onClick={() => pick("home")}>
        <Icon name="home" /> Overview
      </button>
      {GROUPS.map((group) => (
        <div key={group} className="nav-group">
          <p className="nav-caption">{group}</p>
          {VIEWS.filter((v) => v.group === group).map((v) => (
            <button
              key={v.id}
              type="button"
              className={tab === v.id ? "nav-item active" : "nav-item"}
              aria-current={tab === v.id ? "page" : undefined}
              onClick={() => pick(v.id)}
            >
              {tab === v.id && <m.span layoutId="nav-active" className="nav-active" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
              <Icon name={v.icon as IconName} />
              <span>{v.label}</span>
              {v.id === "investigate" && needsReview > 0 && (
                <span className="badge-count" aria-label={`${needsReview} need review`}>{needsReview}</span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function StatusPill() {
  const health = usePoll(api.health, 15000);
  useEffect(() => {
    window.addEventListener("focus", health.reload);
    return () => window.removeEventListener("focus", health.reload);
  }, [health.reload]);
  let tone = "checking";
  let text = "Checking API";
  if (health.data) {
    tone = health.data.falkordb === "ok" ? "ok" : "down";
    text = tone === "ok" ? "API ok" : "Database unavailable";
  } else if (health.error) {
    const dbDown = /falkordb_unavailable|503/i.test(health.error);
    tone = "down";
    text = dbDown ? "Database unavailable" : "API unreachable";
  }
  return (
    <span className={`api-pill api-${tone}`} role="status" title="GET /api/health, checked every 15 seconds">
      <span className="api-dot" aria-hidden="true" /> {text}
    </span>
  );
}

const THEMES: { id: ThemePref; label: string; icon: IconName }[] = [
  { id: "light", label: "Light", icon: "sun" },
  { id: "dark", label: "Dark", icon: "moon" },
  { id: "system", label: "System", icon: "monitor" },
];

export function ThemeMenu() {
  const { pref, theme } = useTheme();
  return (
    <Menu label="Theme" trigger={<Icon name={theme === "dark" ? "moon" : "sun"} />}>
      {(close) => (
        <div className="menu-list" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className="menu-item"
              aria-pressed={pref === t.id}
              onClick={() => {
                setThemePref(t.id);
                close();
              }}
            >
              <Icon name={t.icon} /> {t.label}
              {pref === t.id && <Icon name="check" size={14} className="menu-check" />}
            </button>
          ))}
        </div>
      )}
    </Menu>
  );
}

function WorkspaceSwitcher() {
  const ws = workspaceName();
  const base = ws.replace(/-mcp$/, "");
  const choose = (name: string): void => {
    const url = new URL(window.location.href);
    url.searchParams.set("ws", name);
    window.location.assign(url.toString());
  };
  return (
    <Menu label="Workspace" align="start" trigger={<><Icon name="store" /><span className="ws-name">{ws}</span></>}>
      {(close) => (
        <div className="menu-list" role="group" aria-label="Workspace">
          {[
            { name: base, title: "Scripted runtime", help: "Agents run inside Pathwarden" },
            { name: `${base}-mcp`, title: "Through the MCP gateway", help: "Lineage written by real MCP clients" },
          ].map((o) => (
            <button
              key={o.name}
              type="button"
              className="menu-item menu-item-2"
              aria-pressed={ws === o.name}
              onClick={() => {
                close();
                if (o.name !== ws) choose(o.name);
              }}
            >
              <span><strong>{o.title}</strong><small>{o.name} · {o.help}</small></span>
              {ws === o.name && <Icon name="check" size={14} className="menu-check" />}
            </button>
          ))}
        </div>
      )}
    </Menu>
  );
}

function AuthChip() {
  const auth = useAuth();
  if (auth.status === "checking") return null;
  if (auth.status === "needs-key" || auth.status === "forbidden") return <span className="chip chip-hold" title="The API runs with PW_AUTH=on: this workspace needs a key"><Icon name="key" size={14} /> Key required</span>;
  if (auth.mode === "local") return <span className="chip chip-muted" title="The API runs with PW_AUTH=off: no key is needed"><Icon name="user" size={14} /> Local mode</span>;
  return (
    <Menu label="Account" trigger={<><Icon name="key" /><span className="ws-name">{auth.status === "ok" ? `Signed in · ${workspaceName().replace(/-mcp$/, "")}` : "Not signed in"}</span></>}>
      {(close) => (
        <div className="menu-list">
          {auth.mode === "built-in" ? (
            <p className="menu-note">This build carries its own key, so there is nothing to sign out of.</p>
          ) : (
            <button type="button" className="menu-item" onClick={() => { close(); auth.signOut(); }}>
              <Icon name="logout" /> Sign out
            </button>
          )}
        </div>
      )}
    </Menu>
  );
}

/** The console frame: top bar, navigation rail (a drawer on small screens) and the main region. */
export function AppShell({ children }: { children: ReactNode }) {
  const { tab, go } = useNav();
  const drawer = useRef<HTMLDialogElement>(null);
  const [announce, setAnnounce] = useState("");
  const { needsReview } = useActions();
  const previous = useRef(needsReview);

  useEffect(() => {
    if (needsReview > previous.current) setAnnounce(`${needsReview} action${needsReview === 1 ? "" : "s"} need review`);
    previous.current = needsReview;
  }, [needsReview]);

  useEffect(() => {
    const label = tab === "home" ? "Overview" : (VIEWS.find((v) => v.id === tab)?.label ?? "");
    document.title = `${label} · Pathwarden`;
  }, [tab]);

  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <button type="button" className="icon-btn menu-toggle" onClick={() => drawer.current?.showModal()} aria-label="Open navigation"><Icon name="menu" size={20} /></button>
        <button type="button" className="brand brand-btn" onClick={() => go("home")}><Mark /> pathwarden</button>
        <WorkspaceSwitcher />
        <span className="topbar-spacer" />
        <StatusPill />
        <AuthChip />
        <ThemeMenu />
      </header>
      <div className="shell-body">
        <nav className="rail" aria-label="Primary"><NavLinks /></nav>
        <main id="main" className="main" tabIndex={-1}>{children}</main>
      </div>
      <dialog
        ref={drawer}
        className="drawer"
        aria-label="Navigation"
        onClick={(e) => {
          if (e.target === drawer.current) drawer.current?.close();
        }}
      >
        <div className="drawer-head">
          <span className="brand"><Mark /> pathwarden</span>
          <button type="button" className="icon-btn" onClick={() => drawer.current?.close()} aria-label="Close navigation"><Icon name="close" /></button>
        </div>
        <NavLinks onPick={() => drawer.current?.close()} />
      </dialog>
      <span className="sr-only" role="status">{announce}</span>
    </div>
  );
}

/** "Step 3 of 6": where this view sits in the suggested path, with the next step one click away. */
export function Journey({ current }: { current: (typeof JOURNEY)[number] }) {
  const { go } = useNav();
  const index = JOURNEY.indexOf(current);
  return (
    <ol className="journey" aria-label="Suggested path through Pathwarden">
      {JOURNEY.map((id, i) => {
        const view = VIEWS.find((v) => v.id === id);
        if (!view) return null;
        return (
          <li key={id} className={i === index ? "j-current" : i < index ? "j-done" : undefined}>
            <button type="button" onClick={() => go(id)} aria-current={i === index ? "step" : undefined}>
              <span className="j-n">{i + 1}</span> {view.label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

export function ViewHeader({ id, children }: { id: (typeof JOURNEY)[number]; children?: ReactNode }) {
  const view = VIEWS.find((v) => v.id === id);
  return (
    <div className="view-head">
      <div className="view-head-text">
        <h1>{view?.label}</h1>
        <p className="lead">{view?.lead}</p>
      </div>
      <Journey current={id} />
      {children}
    </div>
  );
}
