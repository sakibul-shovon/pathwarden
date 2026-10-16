import { README } from "../landingData";
import { EVIDENCE, FOOTER, licenseStatus } from "../landingLogic";

/** Navigation and disclosure. No sponsor logos (trademark and endorsement risk), no invented badges; the licence status is the repository's own sentence. */
export function Footer({ generated }: { generated: string }) {
  return (
    <footer className="pw-lfoot">
      <div className="pw-lfoot__cols">
        {FOOTER.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="pw-lfoot__h">{col.title}</h2>
            <ul>
              {col.links.map((l) => (
                <li key={l.label}>
                  <a href={l.href} target="_blank" rel="noreferrer noopener">
                    {l.label} <span aria-hidden="true">↗</span>
                    <span className="pw-visually-hidden"> (opens in a new tab)</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div>
          <h2 className="pw-lfoot__h">Hackathon</h2>
          <p>Built during Graph Hacks 2026, organised by WeMakeDevs and FalkorDB. Entered in Track 01 and Track 02.</p>
        </div>
        <div>
          <h2 className="pw-lfoot__h">Disclosure</h2>
          <ul>
            <li>
              <a href={EVIDENCE.disclosure} target="_blank" rel="noreferrer noopener">
                AI-assistance disclosure <span aria-hidden="true">↗</span>
                <span className="pw-visually-hidden"> (opens in a new tab)</span>
              </a>
            </li>
            <li>All data is synthetic; secrets are <code>PWDEMO-…-NOT-A-REAL-KEY</code>.</li>
            <li>Licence: {licenseStatus(README)}.</li>
          </ul>
        </div>
      </div>
      <p className="pw-muted pw-lfoot__gen">The figures were recorded {generated}.</p>
    </footer>
  );
}
