import type { ForensicReport, LlmInfo } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Notice } from "../../../shared/components/Notice";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { StatusPill } from "../../../shared/components/StatusPill";
import { Icon } from "../../../shared/icons/Icon";
import { Working } from "../../../shared/components/Working";
import { forensicSteps } from "./caseLogic";

interface ForensicsPanelProps {
  mode: "scripted" | "llm";
  onMode: (m: "scripted" | "llm") => void;
  llm: LlmInfo | null;
  busy: boolean;
  elapsedMs: number;
  slow: boolean;
  onRun: () => void;
  report: ForensicReport | null;
}

/** Run the Forensic Agent and read what it did. The consequence of the button is stated next to it (it quarantines now), and the
 *  report is a step list whose results come straight from the report; the LLM's order of calls is not recorded, so it is not shown. */
export function ForensicsPanel({ mode, onMode, llm, busy, elapsedMs, slow, onRun, report }: ForensicsPanelProps) {
  const llmHint = llm?.configured ? `The model (${llm.model}) chooses the tools, at most 8 calls; an invalid plan falls back to the script.` : "Needs PW_LLM_API_KEY (and PW_LLM_MODEL) on the API.";
  return (
    <div className="pw-forensics">
      <Notice variant="consequence">
        Runs the Forensic Agent. It <strong>quarantines</strong> everything derived from the untrusted source in this workspace now
        (risk-reducing, and reversible in Memory) and replays Fixer and Release in a sandbox copy of the graph. It never reads content.
      </Notice>
      <div className="pw-forensics__controls">
        <SegmentedControl
          legend="Mode"
          value={mode}
          onChange={onMode}
          disabled={busy}
          options={[
            { value: "scripted", label: "Scripted" },
            { value: "llm", label: "LLM", disabled: !llm?.configured, hint: mode === "llm" || !llm?.configured ? llmHint : undefined },
          ]}
        />
        <Button variant="primary" pending={busy} onClick={onRun}>
          {busy ? "Investigating…" : "Run forensics"}
        </Button>
      </div>
      {busy && slow && <Working elapsedMs={elapsedMs}>Investigating: quarantining and replaying in a sandbox…</Working>}
      {report && <Report report={report} />}
    </div>
  );
}

function Report({ report }: { report: ForensicReport }) {
  const steps = forensicSteps(report);
  const recommended = report.recommendation === "APPROVE_HEALED_RELEASE";
  return (
    <section className="pw-report" aria-label="Forensic report">
      <h3 className="pw-report__title">{report.mode === "llm" ? "What the investigation found" : "What the Forensic Agent did"}</h3>
      {report.mode === "llm" && (
        <p className="pw-muted">The model chose which tools to call (at most 8); the order of the calls is not recorded, so none is shown.</p>
      )}
      {report.fallback_used && (
        <Notice variant="caveat">The model&apos;s plan was invalid or over budget, so the scripted plan ran instead.</Notice>
      )}
      <ol className="pw-report__steps">
        {steps.map((s) => (
          <li key={s.title}>
            <span className="pw-report__step">{s.title}</span>
            <span className={s.result === null ? "pw-muted" : undefined}>{s.result ?? "not reached"}</span>
          </li>
        ))}
      </ol>
      <p className="pw-muted">
        Mode {report.mode} · {report.llm_calls} LLM calls
      </p>
      <p className="pw-report__rec">
        <StatusPill status={report.recommendation} family={recommended ? "allow" : "neutral"} label={recommended ? "Recommended: release the healed version" : "No healed version to recommend"} />
        {!recommended && (
          <span className="pw-muted">
            {" "}
            <Icon name="info" size={14} /> A person must look at this: the sandbox verdict was not ALLOW, or no untrusted source was found.
          </span>
        )}
      </p>
    </section>
  );
}
