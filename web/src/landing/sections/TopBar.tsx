import { Wordmark } from "../../shared/components/Wordmark";
import { ctaFor, NAV, type Probe } from "../landingLogic";

/** Orientation: the wordmark, the sections, and the one action the probe allows. A thin bar with no blur; on a phone the links
 *  fold into a native disclosure. */
export function TopBar({ probe }: { probe: Probe }) {
  const cta = ctaFor(probe);
  const links = NAV.map((l) => (
    <a key={l.label} href={l.href} className="pw-topnav__link" {...(l.external ? { target: "_blank", rel: "noreferrer noopener" } : {})}>
      {l.label}
      {l.external && <span aria-hidden="true"> ↗</span>}
      {l.external && <span className="pw-visually-hidden"> (opens in a new tab)</span>}
    </a>
  ));
  return (
    <header className="pw-top">
      <div className="pw-top__inner">
        <a href="#top" className="pw-top__brand" aria-label="Pathwarden, top of the page">
          <Wordmark size={20} />
        </a>
        <nav className="pw-topnav pw-topnav--wide" aria-label="Sections">
          {links}
        </nav>
        <a className="pw-btn pw-btn--primary pw-btn--sm pw-top__cta pw-ctabtn" href={cta.primary.href}>
          {cta.primary.label}
        </a>
        <details className="pw-top__menu">
          <summary>Menu</summary>
          <nav className="pw-topnav pw-topnav--stack" aria-label="Sections (menu)">
            {links}
          </nav>
        </details>
      </div>
    </header>
  );
}
