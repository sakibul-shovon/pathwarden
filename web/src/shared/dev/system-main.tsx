import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../styles/index.css";
import { Button } from "../components/Button";
import { CodeBlock } from "../components/CodeBlock";
import { Dialog } from "../components/Dialog";
import { EmptyState } from "../components/EmptyState";
import { ErrorPanel } from "../components/ErrorPanel";
import { Figure } from "../components/Figure";
import { IdChip } from "../components/IdChip";
import { Notice } from "../components/Notice";
import { RuleOfTwoLetters } from "../components/RuleOfTwoLetters";
import { SegmentedControl } from "../components/SegmentedControl";
import { Sheet } from "../components/Sheet";
import { Skeleton } from "../components/Skeleton";
import { StatusPill } from "../components/StatusPill";
import { ICON_PATHS, Icon, type IconName } from "../icons/Icon";

/** Development-only page that shows every primitive in the current theme. Not part of the production build. */
const TOKENS = ["--paper", "--sheet", "--ink", "--ink-2", "--ink-3", "--line", "--line-strong", "--untrusted", "--secret", "--allow", "--hold", "--highlight"];
const QUERY = "MATCH p = (a:Artifact {id: $payload})-[:DERIVED_FROM*1..16]->(s:Source {trust: 'untrusted'})\nRETURN [n IN nodes(p) | n.id] LIMIT 1";
const RELEASE = "## Release notes\n- Fixed: Queue overflow (#42)\nDEPLOY_TOKEN=PWDEMO-TOKEN-b81e44d0-NOT-A-REAL-KEY";

type Theme = "system" | "light" | "dark";

function System() {
  const [guard, setGuard] = useState<"on" | "off">("on");
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [theme, setTheme] = useState<Theme>("system");
  const applyTheme = (t: Theme): void => {
    setTheme(t);
    if (t === "system") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  };
  return (
    <main style={{ maxWidth: 1000, margin: "0 auto", padding: 24, display: "grid", gap: 24 }}>
      <h1>Design system</h1>
      <SegmentedControl
        legend="Theme"
        value={theme}
        onChange={applyTheme}
        options={[
          { value: "system", label: "System" },
          { value: "light", label: "Light" },
          { value: "dark", label: "Dark" },
        ]}
      />
      <section>
        <h2 className="pw-eyebrow">Colour tokens</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
          {TOKENS.map((t) => (
            <span key={t} className="pw-chip" style={{ gap: 8 }}>
              <span style={{ width: 16, height: 16, background: `var(${t})`, border: "1px solid var(--line-strong)" }} />
              <code>{t}</code>
            </span>
          ))}
        </div>
      </section>
      <section>
        <h2 className="pw-eyebrow">Typography</h2>
        <p className="pw-display" style={{ fontSize: 40, margin: "8px 0" }}>
          Every agent passes its safety check.
        </p>
        <p>
          IBM Plex Sans body text — the system still leaks. <code>team_convention:42</code> in IBM Plex Mono.
        </p>
        <p className="pw-eyebrow">Eyebrow · provenance gate</p>
      </section>
      <section>
        <h2 className="pw-eyebrow">Buttons</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          <Button variant="primary">Run scenario</Button>
          <Button>Suggest cuts</Button>
          <Button variant="quiet">Hide guide</Button>
          <Button variant="danger">Revoke 4 flows</Button>
          <Button variant="primary" pending>
            Running…
          </Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
        </div>
      </section>
      <section>
        <h2 className="pw-eyebrow">Status (five families, icon + word)</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {["held", "blocked", "executed", "allowed", "proposed", "rejected", "superseded", "HOLD", "BLOCK", "ALLOW"].map((s) => (
            <StatusPill key={s} status={s} />
          ))}
          <StatusPill status="marker" family="marked" label="poisoned memory written" />
        </div>
      </section>
      <section>
        <h2 className="pw-eyebrow">Rule of Two, chips, controls</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          <RuleOfTwoLetters data={{ A: true, B: false, C: true, green: true }} legend />
          <RuleOfTwoLetters data={{ A: true, B: true, C: true, green: false }} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <IdChip id="act-0001" copyable />
            <IdChip id="src:issue:42" />
            <IdChip id="team_convention:42" copyable />
          </div>
          <SegmentedControl
            legend="Guard"
            value={guard}
            onChange={setGuard}
            options={[
              { value: "on", label: "On", hint: "The gate runs before every external action." },
              { value: "off", label: "Off", hint: "Nothing is checked: an attack will execute." },
            ]}
          />
        </div>
      </section>
      <section>
        <h2 className="pw-eyebrow">Notices, empty, error, skeleton</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          <Notice variant="info">Each run starts from a clean workspace graph.</Notice>
          <Notice variant="consequence">Quarantines everything derived from the untrusted source. Reversible in Memory.</Notice>
          <Notice variant="caveat">Quarantine and approval flags show current values, not history.</Notice>
          <EmptyState action={<Button variant="primary">Run attack_pipeline_42</Button>}>
            No actions in tinyqueue yet. Run a scenario to create one.
          </EmptyState>
          <ErrorPanel title="FalkorDB is not answering" code="falkordb_unavailable" recovery={<Button>Retry</Button>}>
            The API is running but the database is not. Start it with <code>make up</code>.
          </ErrorPanel>
          <Skeleton lines={3} />
        </div>
      </section>
      <section>
        <h2 className="pw-eyebrow">Sheet, figure, code</h2>
        <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
          <Sheet title="Public release page (mock)">
            <pre>{RELEASE}</pre>
          </Sheet>
          <Figure n={1} caption="Lineage of act-0001." source="q2a_untrusted_witness, q2b_secret_witness">
            <p>plate</p>
          </Figure>
          <CodeBlock label="query" code={QUERY} />
        </div>
      </section>
      <section>
        <h2 className="pw-eyebrow">Dialog and drawer</h2>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Button onClick={() => setDialog(true)}>Open review dialog</Button>
          <Button onClick={() => setDrawer(true)}>Open drawer</Button>
        </div>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Release the healed version?"
          actions={
            <>
              <Button data-autofocus onClick={() => setDialog(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => setDialog(false)}>
                Release healed version
              </Button>
            </>
          }
        >
          <p>
            <strong>What will happen.</strong> Fixer and Release re-run for issue:42 in the main graph.
          </p>
        </Dialog>
        <Dialog open={drawer} onClose={() => setDrawer(false)} title="team_convention:42" variant="drawer">
          <p>memory · triage · Mon</p>
        </Dialog>
      </section>
      <section>
        <h2 className="pw-eyebrow">Icons</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          {(Object.keys(ICON_PATHS) as IconName[]).map((n) => (
            <span key={n} style={{ display: "grid", justifyItems: "center", gap: 4, width: 72 }}>
              <Icon name={n} size={24} />
              <code style={{ fontSize: 11 }}>{n}</code>
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root not found");
createRoot(root).render(
  <StrictMode>
    <System />
  </StrictMode>,
);
