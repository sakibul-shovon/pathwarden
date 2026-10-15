import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { ActionDetail, Explain, ForensicReport, HealResult } from "../api/types";
import { LineageGraph } from "../components/LineageGraph";
import { RuleOfTwoBadge } from "../components/RuleOfTwo";
import { errorText, usePoll } from "../hooks";

interface Loaded {
  action: ActionDetail;
  explain: Explain;
}

function VerdictCard({ action }: { action: ActionDetail }) {
  const gate = action.gate;
  const tone = gate.verdict === "ALLOW" ? "green" : gate.verdict === "HOLD" ? "red" : "dark";
  return (
    <div className="card verdict">
      <div className="row">
        <span className={`badge ${tone}`}>{gate.verdict}</span>
        <strong>{gate.reason}</strong>
        <span className="muted">recorded status: {action.status}</span>
      </div>
      <dl className="facts">
        <div><dt>Decision latency</dt><dd>{gate.latency_ms.toFixed(1)} ms</dd></div>
        <div><dt>LLM calls</dt><dd>{gate.llm_calls}</dd></div>
        <div><dt>Sink</dt><dd>{action.sink_id}{action.external ? " (external)" : " (internal)"}</dd></div>
      </dl>
      {gate.reason === "QUARANTINED_LINEAGE" && (
        <p className="muted">
          The payload&apos;s lineage is now quarantined, so the gate blocks it. The original verdict was
          recorded as <strong>{action.status}</strong>; the witness paths below are still drawn on the graph.
        </p>
      )}
      {gate.untrusted_witness.length > 0 && (
        <p><span className="tag u">untrusted witness</span> <code>{gate.untrusted_witness.join(" → ")}</code></p>
      )}
      {gate.secret_witness.length > 0 && (
        <p><span className="tag s">secret witness</span> <code>{gate.secret_witness.join(" → ")}</code></p>
      )}
      {gate.quarantined_ancestors.length > 0 && (
        <p><span className="tag q">quarantined ancestors</span> <code>{gate.quarantined_ancestors.join(", ")}</code></p>
      )}
    </div>
  );
}

function Diff({ held, healed }: { held: string; healed: string }) {
  const heldLines = held.split("\n");
  const healedLines = healed.split("\n");
  const inHealed = new Set(healedLines);
  const inHeld = new Set(heldLines);
  return (
    <div className="diff">
      <div>
        <h4>Held payload (main graph)</h4>
        <pre>{heldLines.map((l, i) => <span key={i} className={inHealed.has(l) ? undefined : "del"}>{l + "\n"}</span>)}</pre>
      </div>
      <div>
        <h4>Healed payload (sandbox graph)</h4>
        <pre>{healedLines.map((l, i) => <span key={i} className={inHeld.has(l) ? undefined : "add"}>{l + "\n"}</span>)}</pre>
      </div>
    </div>
  );
}

function Report({ report }: { report: ForensicReport }) {
  return (
    <div className="card">
      <h3>Forensic report</h3>
      <dl className="facts">
        <div><dt>Untrusted source</dt><dd><code>{report.untrusted_source || "(none found)"}</code></dd></div>
        <div><dt>Quarantine</dt><dd>{report.quarantine_id ?? "nothing new to quarantine"}</dd></div>
        <div><dt>Quarantined artifacts</dt><dd>{report.quarantined_artifacts.length}</dd></div>
        <div><dt>Affected actions</dt><dd>{report.affected_actions.join(", ") || "—"}</dd></div>
        <div>
          <dt>Sandbox re-run</dt>
          <dd>{report.sandbox ? `${report.sandbox.new_action_id}: ${report.sandbox.verdict} / ${report.sandbox.reason}` : "—"}</dd>
        </div>
        <div><dt>Mode</dt><dd>{report.mode} · LLM calls {report.llm_calls} · fallback {String(report.fallback_used)}</dd></div>
      </dl>
      <p>
        Recommendation:{" "}
        <span className={report.recommendation === "APPROVE_HEALED_RELEASE" ? "badge green" : "badge red"}>
          {report.recommendation}
        </span>
      </p>
      {report.laundering_memories.length > 0 && (
        <table>
          <thead><tr><th>poisoned memory</th><th>key</th><th>written by</th><th>session</th><th>day</th></tr></thead>
          <tbody>
            {report.laundering_memories.map((m) => (
              <tr key={m.memory_id}>
                <td><code>{m.memory_id}</code></td><td>{m.memory_key}</td><td>{m.written_by}</td>
                <td><code>{m.written_in_session}</code></td><td>{m.written_on}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function InvestigateTab({
  autoForensics,
  autoHeal,
}: {
  autoForensics: boolean;
  autoHeal: boolean;
}) {
  const actions = usePoll(api.actions, 3000);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [report, setReport] = useState<ForensicReport | null>(null);
  const [diff, setDiff] = useState<{ held: string; healed: string } | null>(null);
  const [heal, setHeal] = useState<HealResult | null>(null);
  const [busy, setBusy] = useState<"forensics" | "heal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [autoDone, setAutoDone] = useState(false);

  // select the first action that needs attention
  useEffect(() => {
    const list = actions.data;
    if (selected !== null || !list || list.length === 0) return;
    const attention = list.find((a) => a.status === "held" || a.status === "blocked");
    setSelected((attention ?? list[0])?.id ?? null);
  }, [actions.data, selected]);

  // load the verdict and the explanation of the selected action
  useEffect(() => {
    if (selected === null) return;
    let cancelled = false;
    Promise.all([api.action(selected), api.explain(selected)])
      .then(([action, explain]) => {
        if (!cancelled) setLoaded({ action, explain });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selected, version]);

  const runForensics = useCallback(async (id: string) => {
    setBusy("forensics");
    setError(null);
    try {
      const result = await api.forensics(id);
      setReport(result);
      if (result.diff) {
        const [held, healed] = await Promise.all([
          api.artifact(result.diff.held_payload_id, "main"),
          api.artifact(result.diff.healed_payload_id, "sandbox"),
        ]);
        setDiff({ held: held.content, healed: healed.content });
      }
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }, []);

  const approveHeal = useCallback(
    async (id: string) => {
      setBusy("heal");
      setError(null);
      try {
        setHeal(await api.healApprove(id));
        setVersion((v) => v + 1);
        actions.reload();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(null);
      }
    },
    [actions],
  );

  useEffect(() => {
    if (autoForensics && !autoDone && loaded) {
      setAutoDone(true);
      void runForensics(loaded.action.id);
    }
  }, [autoForensics, autoDone, loaded, runForensics]);

  // deep-link hook (?autoheal=1): approve the healed release once the report recommends it
  useEffect(() => {
    if (autoHeal && loaded && report?.recommendation === "APPROVE_HEALED_RELEASE" && !heal && busy === null) {
      void approveHeal(loaded.action.id);
    }
  }, [autoHeal, loaded, report, heal, busy, approveHeal]);

  const select = (id: string): void => {
    setSelected(id);
    setLoaded(null);
    setReport(null);
    setDiff(null);
    setHeal(null);
    setError(null);
  };

  const list = actions.data ?? [];
  return (
    <section aria-label="Investigate">
      {error && <div className="banner red" role="alert">{error}</div>}
      {actions.error && <div className="banner red" role="alert">{actions.error}</div>}
      <div className="split">
        <aside className="card">
          <h3>Actions</h3>
          {list.length === 0 ? (
            <p className="muted">No actions yet. Run a scenario in the Run tab first.</p>
          ) : (
            <ul className="actions">
              {list.map((a) => (
                <li key={a.id}>
                  <button type="button" className={a.id === selected ? "item active" : "item"} onClick={() => select(a.id)}>
                    <code>{a.id}</code> <span className={`status ${a.status}`}>{a.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="main">
          {!loaded && selected && <p className="muted">Loading {selected}…</p>}
          {loaded && (
            <>
              <VerdictCard action={loaded.action} />

              <div className="card">
                <h3>Lineage of the payload</h3>
                <LineageGraph
                  nodes={loaded.explain.subgraph.nodes}
                  edges={loaded.explain.subgraph.edges}
                  untrustedWitness={loaded.explain.gate.untrusted_witness}
                  secretWitness={loaded.explain.gate.secret_witness}
                />
                {Object.entries(loaded.explain.queries).map(([name, text]) => (
                  <details key={name}>
                    <summary>{name} (read-only; exactly what the gate runs)</summary>
                    <pre className="query">{text}</pre>
                  </details>
                ))}
              </div>

              {loaded.explain.laundering.length > 0 && (
                <div className="card">
                  <h3>Memory laundering</h3>
                  <p className="muted">
                    Untrusted text reached this payload through shared team memory, written in an earlier session:
                  </p>
                  <table>
                    <thead><tr><th>memory</th><th>key</th><th>written by</th><th>session</th><th>day</th><th>untrusted source</th></tr></thead>
                    <tbody>
                      {loaded.explain.laundering.map((m) => (
                        <tr key={m.memory_id}>
                          <td><code>{m.memory_id}</code></td><td>{m.memory_key}</td><td>{m.written_by}</td>
                          <td><code>{m.written_in_session}</code></td><td>{m.written_on}</td><td><code>{m.untrusted_source}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="card">
                <h3>Forensics</h3>
                <p className="muted">
                  Finds the poisoned memory, quarantines everything derived from the untrusted source (reversible),
                  re-runs the work in a sandbox copy of the graph and gates the result. It never reads content.
                </p>
                <div className="row">
                  <label>
                    Mode
                    <select disabled><option>scripted</option></select>
                  </label>
                  <button type="button" className="primary" disabled={busy !== null} onClick={() => void runForensics(loaded.action.id)}>
                    {busy === "forensics" ? "Investigating…" : "Run forensics"}
                  </button>
                  <span className="muted">(LLM mode arrives in P8)</span>
                </div>
              </div>

              {report && <Report report={report} />}
              {report && diff && (
                <div className="card">
                  <h3>Held vs healed</h3>
                  <Diff held={diff.held} healed={diff.healed} />
                </div>
              )}

              {report?.recommendation === "APPROVE_HEALED_RELEASE" && !heal && (
                <div className="card">
                  <h3>Release</h3>
                  <p>Releasing is a risk-increasing action, so it needs a human decision.</p>
                  <button type="button" className="primary" disabled={busy !== null} onClick={() => void approveHeal(loaded.action.id)}>
                    {busy === "heal" ? "Releasing…" : "Approve healed release"}
                  </button>
                </div>
              )}

              {heal && (
                <div className={heal.superseded ? "banner green" : "banner red"} role="status">
                  {heal.superseded
                    ? `Healed release ${heal.actions[0]?.id} executed; ${loaded.action.id} is superseded.`
                    : `The healed run was not released (${heal.actions[0]?.status} / ${heal.actions[0]?.reason}).`}
                  <div>
                    {heal.sessions.map((s) => (
                      <span key={s.id} className="inline"><code>{s.id}</code> <RuleOfTwoBadge data={s.rule_of_two} /></span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
