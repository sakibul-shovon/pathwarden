import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import type { ActionDetail, Explain, ForensicReport, HealResult } from "../api/types";
import { LineageGraph } from "../components/LineageGraph";
import { RuleOfTwoBadge } from "../components/RuleOfTwo";
import { errorText } from "../hooks";
import { ResponsePlan } from "../investigate/ResponsePlan";
import { useActions } from "../shell/actions";
import { useHealth } from "../shell/health";
import { ViewHeader } from "../shell/AppShell";
import { Chip, StatusChip } from "../ui/Chip";
import { CodeBlock } from "../ui/CodeBlock";
import { Icon } from "../ui/Icon";
import { useNav } from "../nav";

interface Loaded {
  action: ActionDetail;
  explain: Explain;
}

function PathList({ title, ids, kind }: { title: string; ids: string[]; kind: "u" | "s" }) {
  if (ids.length === 0) return null;
  return (
    <div className={`path path-${kind}`}>
      <h3><span className={`tag ${kind}`}>{title}</span></h3>
      <ol>
        {ids.map((id, i) => (
          <li key={`${id}-${i}`}>
            <code>{id}</code>
            {i === ids.length - 1 && <span className="muted"> · source</span>}
          </li>
        ))}
      </ol>
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
        <pre>{heldLines.map((l, i) => <span key={i} className={inHealed.has(l) ? "ctx" : "del"}><i aria-hidden="true">{inHealed.has(l) ? " " : "−"}</i>{l + "\n"}</span>)}</pre>
      </div>
      <div>
        <h4>Healed payload (sandbox graph)</h4>
        <pre>{healedLines.map((l, i) => <span key={i} className={inHeld.has(l) ? "ctx" : "add"}><i aria-hidden="true">{inHeld.has(l) ? " " : "+"}</i>{l + "\n"}</span>)}</pre>
      </div>
    </div>
  );
}

export function InvestigateTab({
  autoForensics,
  autoHeal,
  onAutoConsumed,
}: {
  autoForensics: boolean;
  autoHeal: boolean;
  onAutoConsumed?: (name: "autoforensics" | "autoheal") => void;
}) {
  const { go } = useNav();
  const actions = useActions();
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [report, setReport] = useState<ForensicReport | null>(null);
  const [diff, setDiff] = useState<{ held: string; healed: string } | null>(null);
  const [heal, setHeal] = useState<HealResult | null>(null);
  const [busy, setBusy] = useState<"forensics" | "heal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [autoDone, setAutoDone] = useState(false);
  const { liveReady, model } = useHealth();
  const [fMode, setFMode] = useState<"scripted" | "llm">("scripted");

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

  const runForensics = useCallback(async (id: string, mode: "scripted" | "llm" = "scripted") => {
    setBusy("forensics");
    setError(null);
    try {
      const result = await api.forensics(id, mode);
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

  const reloadActions = actions.reload;
  const approveHeal = useCallback(
    async (id: string) => {
      setBusy("heal");
      setError(null);
      try {
        setHeal(await api.healApprove(id));
        setVersion((v) => v + 1);
        reloadActions();
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(null);
      }
    },
    [reloadActions],
  );

  useEffect(() => {
    if (autoForensics && !autoDone && loaded) {
      setAutoDone(true);
      onAutoConsumed?.("autoforensics");
      void runForensics(loaded.action.id);
    }
  }, [autoForensics, autoDone, loaded, runForensics, onAutoConsumed]);

  // deep-link hook (?autoheal=1): approve the healed release once the report recommends it
  useEffect(() => {
    if (autoHeal && loaded && report?.recommendation === "APPROVE_HEALED_RELEASE" && !heal && busy === null) {
      onAutoConsumed?.("autoheal");
      void approveHeal(loaded.action.id);
    }
  }, [autoHeal, loaded, report, heal, busy, approveHeal, onAutoConsumed]);

  const select = (id: string): void => {
    setSelected(id);
    setLoaded(null);
    setReport(null);
    setDiff(null);
    setHeal(null);
    setError(null);
  };

  const list = actions.data ?? [];
  const needs = list.filter((a) => a.status === "held" || a.status === "blocked");
  const resolved = list.filter((a) => !(a.status === "held" || a.status === "blocked"));
  const gate = loaded?.explain.gate;
  const summary = useMemo(
    () =>
      loaded && gate
        ? `Lineage of ${loaded.action.payload_id}: ${loaded.explain.subgraph.nodes.length} nodes. Untrusted route of ${gate.untrusted_witness.length} steps, secret route of ${gate.secret_witness.length} steps. The routes are listed as text beside the graph.`
        : undefined,
    [loaded, gate],
  );

  const row = (a: (typeof list)[number]) => (
    <li key={a.id}>
      <button type="button" className={a.id === selected ? "inbox-item active" : "inbox-item"} aria-current={a.id === selected ? "true" : undefined} onClick={() => select(a.id)}>
        <code>{a.id}</code>
        <StatusChip status={a.status} />
        <span className="muted inbox-payload">{a.payload_id}</span>
      </button>
    </li>
  );

  return (
    <section aria-label="Investigate">
      <ViewHeader id="investigate" />
      {error && <div className="notice notice-hold" role="alert"><Icon name="alert" /> {error}</div>}
      {actions.error && <div className="notice notice-hold" role="alert"><Icon name="alert" /> {actions.error}</div>}

      <div className="split">
        <aside className="panel inbox" aria-label="Actions">
          <h2>Inbox</h2>
          {list.length === 0 ? (
            <div className="empty-mini">
              <p className="muted">No actions yet.</p>
              <button type="button" className="btn btn-solid" onClick={() => go("run")}>Run a scenario</button>
            </div>
          ) : (
            <>
              <p className="inbox-caption">Needs review <span className="badge-count">{needs.length}</span></p>
              <ul className="inbox-list">{needs.map(row)}</ul>
              {needs.length === 0 && <p className="muted">Nothing needs review.</p>}
              {resolved.length > 0 && (
                <>
                  <p className="inbox-caption">Resolved</p>
                  <ul className="inbox-list">{resolved.map(row)}</ul>
                </>
              )}
            </>
          )}
          <p className="muted inbox-poll"><span className="pulse-dot" aria-hidden="true" /> Checks for new actions every 3 s</p>
        </aside>

        <div className="case">
          {!loaded && selected && (
            <div className="panel skeleton-panel" aria-busy="true">
              <span className="skeleton sk-title" /><span className="skeleton sk-line" /><span className="skeleton sk-graph" />
              <span className="sr-only">Loading {selected}…</span>
            </div>
          )}
          {loaded && gate && (
            <>
              <m.div className={`panel verdict verdict-${gate.verdict}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26 }}>
                <div className="verdict-top">
                  <StatusChip status={gate.verdict} />
                  <strong className="verdict-reason">{gate.reason}</strong>
                  <span className="muted">recorded status: <StatusChip status={loaded.action.status} /></span>
                </div>
                <dl className="facts">
                  <div><dt>Decision latency</dt><dd className="mono">{gate.latency_ms.toFixed(1)} ms</dd></div>
                  <div><dt>LLM calls</dt><dd className="mono">{gate.llm_calls}</dd></div>
                  <div><dt>Sink</dt><dd>{loaded.action.sink_id}{loaded.action.external ? " (external)" : " (internal)"}</dd></div>
                </dl>
                {gate.reason === "QUARANTINED_LINEAGE" && (
                  <p className="muted">
                    The payload&apos;s lineage is now quarantined, so the gate blocks it. The original verdict was
                    recorded as <strong>{loaded.action.status}</strong>; the witness paths below are still drawn on the graph.
                  </p>
                )}
                {gate.quarantined_ancestors.length > 0 && (
                  <p><span className="tag q">quarantined ancestors</span> <code>{gate.quarantined_ancestors.join(", ")}</code></p>
                )}
              </m.div>

              <div className="panel">
                <div className="panel-head"><h2>Lineage of the payload</h2><span className="muted">Why it was stopped</span></div>
                <div className="lineage-grid">
                  <LineageGraph
                    nodes={loaded.explain.subgraph.nodes}
                    edges={loaded.explain.subgraph.edges}
                    untrustedWitness={gate.untrusted_witness}
                    secretWitness={gate.secret_witness}
                    summary={summary}
                  />
                  <div className="evidence">
                    <h3>Evidence as text</h3>
                    <PathList title="untrusted witness" ids={gate.untrusted_witness} kind="u" />
                    <PathList title="secret witness" ids={gate.secret_witness} kind="s" />
                    {gate.untrusted_witness.length === 0 && gate.secret_witness.length === 0 && <p className="muted">No witness paths for this verdict.</p>}
                  </div>
                </div>
                {Object.entries(loaded.explain.queries).map(([name, text]) => (
                  <details key={name} className="disclosure">
                    <summary>{name} (read-only; exactly what the gate runs)</summary>
                    <CodeBlock text={text} label={name} />
                  </details>
                ))}
              </div>

              {loaded.explain.laundering.length > 0 && (
                <div className="panel">
                  <h2>Memory laundering</h2>
                  <p className="muted">Untrusted text reached this payload through shared team memory, written in an earlier session:</p>
                  <div className="scroll">
                    <table>
                      <thead><tr><th>memory</th><th>key</th><th>written by</th><th>session</th><th>day</th><th>untrusted source</th></tr></thead>
                      <tbody>
                        {loaded.explain.laundering.map((mem) => (
                          <tr key={mem.memory_id}>
                            <td><code>{mem.memory_id}</code></td><td>{mem.memory_key}</td><td>{mem.written_by}</td>
                            <td><code>{mem.written_in_session}</code></td><td>{mem.written_on}</td><td><code>{mem.untrusted_source}</code></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="panel">
                <div className="panel-head">
                  <h2>Forensic Agent</h2>
                  <fieldset className="segmented" aria-label="Forensic mode">
                    <label><input type="radio" name="fmode" checked={fMode === "scripted"} onChange={() => setFMode("scripted")} disabled={busy !== null} /> Scripted</label>
                    <label title={liveReady ? "A real model chooses the tools (at most 8 calls)" : "Needs PW_LLM_MODEL and PW_LLM_API_KEY on the API"} className={liveReady ? undefined : "is-disabled"}>
                      <input type="radio" name="fmode" checked={fMode === "llm"} onChange={() => setFMode("llm")} disabled={busy !== null || !liveReady} /> LLM{" "}
                      <span className="muted">{liveReady ? `(${model ?? "model"})` : "(needs an LLM key)"}</span>
                    </label>
                  </fieldset>
                </div>
                <p className="muted">
                  Finds the poisoned memory, quarantines everything derived from the untrusted source (reversible),
                  re-runs the work in a sandbox copy of the graph and gates the result. It never reads content.
                </p>
                <ResponsePlan report={report} busy={busy === "forensics"} heal={heal} />
                <div className="plan-actions">
                  <button type="button" className="btn btn-solid" disabled={busy !== null} onClick={() => void runForensics(loaded.action.id, fMode)}>
                    <Icon name="bolt" /> {busy === "forensics" ? "Investigating…" : report ? "Run forensics again" : "Run forensics"}
                  </button>
                  {report?.fallback_used && (
                    <Chip tone="hold" icon="alert" title="The model's plan was rejected, so the scripted plan ran">Fallback: scripted plan used</Chip>
                  )}
                  {report && (
                    <span className="muted">
                      Mode {report.mode} · LLM calls {report.llm_calls} · fallback {String(report.fallback_used)} · affected actions {report.affected_actions.join(", ") || "—"}
                    </span>
                  )}
                </div>
              </div>

              {report && diff && (
                <div className="panel">
                  <h2>Held vs healed</h2>
                  <Diff held={diff.held} healed={diff.healed} />
                </div>
              )}

              <AnimatePresence>
                {report?.recommendation === "APPROVE_HEALED_RELEASE" && !heal && (
                  <m.div className="panel approve" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.26 }}>
                    <div className="approve-text">
                      <h2><Icon name="user" /> Your decision</h2>
                      <p>Releasing is a risk-increasing action, so it needs a person.</p>
                      <p className="muted">
                        It publishes the healed release from the sandbox run. The held action <code>{loaded.action.id}</code> becomes superseded only if the new release is executed.
                      </p>
                    </div>
                    <button type="button" className="btn btn-solid" disabled={busy !== null} onClick={() => void approveHeal(loaded.action.id)}>
                      {busy === "heal" ? "Releasing…" : "Approve healed release"}
                    </button>
                  </m.div>
                )}
              </AnimatePresence>

              {heal && (
                <m.div className={heal.superseded ? "notice notice-allow" : "notice notice-hold"} role="status" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <Icon name={heal.superseded ? "check" : "alert"} />
                  <div>
                    {heal.superseded
                      ? `Healed release ${heal.actions[0]?.id} executed; ${loaded.action.id} is superseded.`
                      : `The healed run was not released (${heal.actions[0]?.status} / ${heal.actions[0]?.reason}).`}
                    <div className="notice-sessions">
                      {heal.sessions.map((s) => (
                        <span key={s.id} className="inline"><code>{s.id}</code> <RuleOfTwoBadge data={s.rule_of_two} /></span>
                      ))}
                    </div>
                    {heal.superseded && (
                      <div className="notice-next">
                        <button type="button" className="btn btn-quiet" onClick={() => go("memory")}>Review team memory <Icon name="forward" /></button>
                        <button type="button" className="btn btn-quiet" onClick={() => go("remediate")}>Prevent this class of leak <Icon name="forward" /></button>
                      </div>
                    )}
                  </div>
                </m.div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
