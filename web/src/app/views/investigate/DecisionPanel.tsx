import { useState } from "react";
import type { ForensicReport, HealResult } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Dialog } from "../../../shared/components/Dialog";
import { Notice } from "../../../shared/components/Notice";
import { RuleOfTwoLetters } from "../../../shared/components/RuleOfTwoLetters";
import { StatusPill } from "../../../shared/components/StatusPill";

interface DecisionPanelProps {
  actionId: string;
  report: ForensicReport;
  /** The first lines of the healed payload, shown in the review so the person sees what would be published. */
  healedPreview: string[];
  busy: boolean;
  onRelease: () => Promise<void>;
}

/** The human decision (ui-redesign.md §13.5.9). Releasing is risk-increasing, so it is a deliberate act behind a review
 *  dialog that says what will happen, what already happened automatically, what gets published, and who is on record. */
export function DecisionPanel({ actionId, report, healedPreview, busy, onRelease }: DecisionPanelProps) {
  const [open, setOpen] = useState(false);
  return (
    <section className="pw-decision" aria-labelledby="pw-decision-title">
      <h3 id="pw-decision-title" className="pw-decision__title">
        Your decision is needed
      </h3>
      <p className="pw-prose">
        The healed run was gated in the sandbox and would be allowed. Releasing it posts it to the public release page, so it needs a
        person: Pathwarden never releases on its own.
      </p>
      <Button variant="primary" onClick={() => setOpen(true)} disabled={busy}>
        Release the healed version…
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Release the healed version?"
        actions={
          <>
            <Button data-autofocus onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              pending={busy}
              onClick={() => {
                void onRelease().finally(() => setOpen(false));
              }}
            >
              {busy ? "Releasing…" : "Release healed version"}
            </Button>
          </>
        }
      >
        <dl className="pw-review">
          <div>
            <dt>What will happen</dt>
            <dd>
              Fixer and Release re-run for the same task in the main graph (the quarantine stays applied). The new release is gated. If
              the gate allows it, it is posted to the public release page and <code>{actionId}</code> becomes superseded.
            </dd>
          </div>
          <div>
            <dt>Already done automatically</dt>
            <dd>
              {report.quarantine_id
                ? `Quarantine ${report.quarantine_id} covering ${report.quarantined_artifacts.length} artifacts (reversible in Memory).`
                : "Nothing new needed quarantining."}
            </dd>
          </div>
          <div>
            <dt>What gets published</dt>
            <dd>
              {healedPreview.length === 0 ? (
                "The healed payload (shown in the comparison above)."
              ) : (
                <pre className="pw-review__preview">{healedPreview.join("\n")}</pre>
              )}
            </dd>
          </div>
          <div>
            <dt>Who</dt>
            <dd>
              Recorded as approver: <strong>maintainer</strong>. This is a deliberate human action: the request is sent with the
              header <code>X-PW-Human: true</code>.
            </dd>
          </div>
        </dl>
      </Dialog>
    </section>
  );
}

/** What happened after the release: the new action, the old one superseded (or why not), and the new sessions' Rule of Two. */
export function ReleaseResult({ heal, oldAction }: { heal: HealResult; oldAction: string }) {
  const next = heal.actions[0];
  return (
    <section className="pw-release-result" aria-live="polite">
      {heal.superseded ? (
        <Notice variant="info">
          Healed release <code>{next?.id}</code> executed; <code>{oldAction}</code> is superseded.
        </Notice>
      ) : (
        <Notice variant="caveat">
          The healed run was not released (<code>{next?.status}</code> / <code>{next?.reason}</code>).
        </Notice>
      )}
      <ul className="pw-release-result__sessions">
        {heal.sessions.map((s) => (
          <li key={s.id}>
            <code>{s.id}</code> <span className="pw-muted">{s.agent}</span> <RuleOfTwoLetters data={s.rule_of_two} />
          </li>
        ))}
      </ul>
      {next && (
        <p>
          <StatusPill status={next.status} /> <code>{next.id}</code>
        </p>
      )}
    </section>
  );
}
