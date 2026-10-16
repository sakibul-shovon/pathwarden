import { Icon } from "../shared/icons/Icon";
import { GROUP_LABEL, NAV, type NavItem } from "./navModel";
import { buildSearch, navigateState, type TabId, type UrlState } from "./url";

interface NavProps {
  url: UrlState;
  /** Held plus blocked actions of the open workspace: the ones that need a human decision. */
  attention: number;
  onNavigate: (tab: TabId) => void;
}

/** The views are real links (open in a new tab, copy the address) that the app intercepts for in-page navigation. */
export function Nav({ url, attention, onNavigate }: NavProps) {
  return (
    <nav aria-label="Application" className="pw-nav">
      {(["workspace", "global"] as const).map((group) => (
        <div key={group} className="pw-nav__group">
          <p className="pw-nav__heading">{GROUP_LABEL[group]}</p>
          <ul>
            {NAV.filter((n) => n.group === group).map((item) => (
              <li key={item.id}>
                <NavLink item={item} url={url} attention={item.id === "investigate" ? attention : 0} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function NavLink({ item, url, attention, onNavigate }: { item: NavItem; url: UrlState; attention: number; onNavigate: (tab: TabId) => void }) {
  const current = url.tab === item.id;
  return (
    <a
      className={current ? "pw-nav__link pw-nav__link--current" : "pw-nav__link"}
      href={buildSearch(navigateState(url, item.id))}
      aria-current={current ? "page" : undefined}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        onNavigate(item.id);
      }}
    >
      <Icon name={item.icon} size={16} />
      <span className="pw-nav__label">{item.label}</span>
      {attention > 0 && (
        <span className="pw-nav__count">
          {attention}
          <span className="pw-visually-hidden"> {attention === 1 ? "needs" : "need"} a decision</span>
        </span>
      )}
    </a>
  );
}
