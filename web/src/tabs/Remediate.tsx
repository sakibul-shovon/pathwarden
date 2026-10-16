import { animate } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { AgentWitness, ApplyResult, Candidate, CapState, EvalSummary, Topology } from "../api/types";
import { CapabilityGraph } from "../components/CapabilityGraph";
import { reducedMotion } from "../gsap";
import { errorText } from "../hooks";
import { ViewHeader } from "../shell/AppShell";
import { Chip } from "../ui/Chip";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

const TOPOLOGIES: Topology[] = ["enterprise12", "tinyqueue3"];

function Names({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="muted">none</span>;
  return <span className="pill-list">{items.map((n) => <code key={n}>{n}</code>)}</span>;
}

/** A number that counts from one value to another (instant with reduced motion). */
function Tween({ from, to }: { from: number; to: number }) {
  const [value, setValue] = useState(reducedMotion() ? to : from);
  useEffect(() => {
    if (reducedMotion()) {
      setValue(to);
      return;
    }
    const controls = animate(from, to, { duration: 0.9, ease: "easeOut", onUpdate: (v) => setValue(Math.round(v)) });
    return () => controls.stop();
  }, [from, to]);
  return <strong className="mono tween">{value}</strong>;
}

/** Least-privilege remediation (plan §15): which agents are toxic, the four provable max-flow cuts,
 *  and a human-confirmed Apply. Every number comes from the API; nothing is typed here. */
export function RemediateTab({ initialTopology }: { initialTopology: Topology }) {
  const toast = useToast();
  const [topology, setTopology] = useState<Topology>(initialTopology);
  const [state, setState] = useState<CapState | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [witness, setWitness] = useState<AgentWitness | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [evalSummary, setEvalSummary] = useState<EvalSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Candidate | null>(null);

  const load = useCallback((name: Topology) => {
    setError(null);
    api.capState(name).then(setState).catch((err: unknown) => setError(errorText(err)));
  }, []);

  useEffect(() => {
    setState(null);
    setCandidates(null);
    setPreview(null);
    setSelected(null);
    setWitness(null);
    setApplied(null);
    load(topology);
  }, [topology, load]);

  // the brute-force optimum of the last `make eval`, shown next to the candidates (optional)
  useEffect(() => {
    api.evalSummary().then(setEvalSummary).catch(() => setEvalSummary(null));
  }, []);

  useEffect(() => {
    if (selected === null) return;
    let cancelled = false;
    api
      .capWitness(topology, selected)
      .then((w) => {
        if (!cancelled) setWitness(w);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorText(err));
      });
    return () => {
      cancelled = true;
    };
  }, [selected, topology]);

  async function run<T>(what: string, action: () => Promise<T>): Promise<T | null> {
    setBusy(what);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(errorText(err));
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function suggest(): Promise<void> {
    const result = await run("suggest", () => api.capSuggest(topology));
    if (result) {
      setCandidates(result.candidates);
      setApplied(null);
    }
  }

  async function apply(candidate: Candidate): Promise<void> {
    setConfirm(null);
    const result = await run("apply", () => api.capApply(topology, candidate.cap_ids));
    if (result) {
      setApplied(result);
      setCandidates(null);
      setPreview(null);
      toast(`Applied ${candidate.id}: revoked ${result.revoked} flow(s).`);
      load(topology);
    }
  }

  async function reset(): Promise<void> {
    const next = await run("reset", () => api.capReset(topology));
    if (next) {
      setState(next);
      setCandidates(null);
      setPreview(null);
      setApplied(null);
      setWitness(null);
    }
  }

  const best = candidates ? candidates.filter((c) => c.verified).sort((a, b) => a.total_cost - b.total_cost)[0] : undefined;
  const optimum = evalSummary?.remediation?.[topology];
  const previewed = candidates?.find((c) => c.id === preview);
  const maxCost = candidates ? Math.max(...candidates.map((c) => c.total_cost), 1) : 1;
  const agents = state?.nodes.filter((n) => n.kind === "agent") ?? [];

  return (
    <section aria-label="Remediate">
      <ViewHeader id="remediate" />

      <div className="panel">
        <div className="row-sel">
          <label className="field-inline">
            <span>Topology</span>
            <select value={topology} onChange={(e) => setTopology(e.target.value as Topology)}>
              {TOPOLOGIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button type="button" className="btn btn-solid" disabled={busy !== null || state === null} onClick={() => void suggest()}>
            <Icon name="scissors" /> Suggest cuts
          </button>
          <button type="button" className="btn" disabled={busy !== null} onClick={() => void reset()}>Reset topology</button>
          {busy && <span className="muted" role="status">{busy}…</span>}
        </div>
        <p className="muted">
          An agent is <strong>toxic</strong> when it can receive untrusted data, can receive secrets and can reach an
          external sink. Each candidate cut is a complete fix and is verified on a temporary copy of the graph.
          Apply changes the demo topology; Reset restores it.
        </p>
      </div>

      {error && <div className="notice notice-hold" role="alert"><Icon name="alert" /> {error}</div>}

      {state && (
        <div className="panel">
          <div className="panel-head"><h2>Capability graph: {state.topology}</h2></div>
          <div className="toxic-row">
            <span>Toxic agents ({state.toxic_agents.length}):</span>
            {state.toxic_agents.length === 0 && <span className="muted">none</span>}
            {state.toxic_agents.map((a) => (
              <button key={a} type="button" className={a === selected ? "agent-btn toxic active" : "agent-btn toxic"} aria-pressed={a === selected} onClick={() => setSelected(a)}>
                <Icon name="alert" size={14} /> {a}
              </button>
            ))}
          </div>
          <details className="disclosure">
            <summary>All agents ({agents.length}): pick one to see its witness</summary>
            <div className="toxic-row">
              {agents.map((a) => (
                <button key={a.name} type="button" className={a.name === selected ? "agent-btn active" : "agent-btn"} aria-pressed={a.name === selected} onClick={() => setSelected(a.name)}>
                  {a.name}
                </button>
              ))}
            </div>
          </details>
          <div className="cap-grid">
            <CapabilityGraph nodes={state.nodes} edges={state.edges} selected={selected} cut={previewed?.cap_ids ?? []} onSelect={setSelected} />
            <div className="witness" aria-live="polite">
              {witness && selected === witness.agent ? (
                <>
                  <h3>Witness for <code>{witness.agent}</code> {witness.toxic ? <Chip tone="hold" icon="alert">TOXIC</Chip> : <Chip tone="allow" icon="check">not toxic</Chip>}</h3>
                  <dl className="facts facts-col">
                    <div><dt>reachable from untrusted (path)</dt><dd><Names items={witness.from_untrusted} /></dd></div>
                    <div><dt>reachable from secret (path)</dt><dd><Names items={witness.from_secret} /></dd></div>
                    <div><dt>reaches outside (path)</dt><dd><Names items={witness.to_external} /></dd></div>
                  </dl>
                </>
              ) : (
                <p className="muted">Pick an agent (a button above, or a box on the graph) to see why it is, or is not, toxic.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {applied && (
        <div className="notice notice-allow result" role="status">
          <Icon name="check" />
          <div>
            <strong>Applied:</strong> revoked {applied.revoked} flow(s) ({applied.cap_ids.join(", ")}).
            <div className="result-count">
              Toxic agents <Tween from={applied.toxic_before.length} to={applied.toxic_before.length} /> → <Tween from={applied.toxic_before.length} to={applied.toxic_after.length} />
            </div>
            <div>Before: <Names items={applied.toxic_before} /> After: <Names items={applied.toxic_after} /></div>
          </div>
        </div>
      )}

      {candidates && (
        <div className="panel">
          <h2>Candidate cuts</h2>
          <div className="cards">
            {candidates.map((c) => (
              <article key={c.id} className={best?.id === c.id ? "cut-card best" : "cut-card"}>
                <header>
                  <h3>{c.id}: {c.name}</h3>
                  {best?.id === c.id && <Chip tone="allow" icon="check">cheapest verified</Chip>}
                </header>
                <div className="cost" aria-label={`cost ${c.total_cost}`}>
                  <span className="cost-bar"><span style={{ width: `${(c.total_cost / maxCost) * 100}%` }} /></span>
                  <strong className="mono">{c.total_cost}</strong>
                </div>
                <dl className="facts">
                  <div><dt>max flow</dt><dd className="mono">{c.max_flow}</dd></div>
                  <div><dt>flows</dt><dd className="mono">{c.cap_ids.length}</dd></div>
                  <div><dt>verified</dt><dd>{c.verified ? <Chip tone="allow" icon="check">verified</Chip> : <Chip tone="hold" icon="alert">{c.invalid_reason ?? "not verified"}</Chip>}</dd></div>
                </dl>
                <details className="disclosure">
                  <summary>Revokes {c.cap_ids.length} flow(s)</summary>
                  <Names items={c.cap_ids} />
                </details>
                <div className="card-actions">
                  <button type="button" className="btn" aria-pressed={preview === c.id} onClick={() => setPreview(preview === c.id ? null : c.id)}>
                    {preview === c.id ? "Hide cut" : "Show cut"}
                  </button>
                  <button type="button" className="btn btn-danger" disabled={!c.verified || !c.needs_cut || busy !== null} onClick={() => setConfirm(c)}>
                    Apply…
                  </button>
                </div>
              </article>
            ))}
          </div>
          {optimum && optimum.optimum_cost !== null && (
            <p className="muted">
              From the last <code>make eval</code>: best candidate {optimum.best_candidate_cost}, brute-force optimum{" "}
              {optimum.optimum_cost}{optimum.gap ? ` (gap ${optimum.gap}: a cheaper mixed cut exists that no single candidate finds)` : " (the candidate is optimal)"}.
            </p>
          )}
        </div>
      )}

      <Dialog
        open={confirm !== null}
        title={confirm ? `Apply ${confirm.id} (cost ${confirm.total_cost})?` : ""}
        onClose={() => setConfirm(null)}
        actions={
          <>
            <button type="button" className="btn" data-autofocus onClick={() => setConfirm(null)}>Cancel</button>
            <button type="button" className="btn btn-danger-solid" onClick={() => confirm && void apply(confirm)}>Apply</button>
          </>
        }
      >
        {confirm && (
          <>
            <p>It revokes {confirm.cap_ids.length} flow(s):</p>
            <ul className="revoke-list">
              {confirm.edges.length > 0
                ? confirm.edges.map((e) => <li key={e.cap_id}><code>{e.src}</code> → <code>{e.dst}</code> <span className="muted">(cost {e.cost})</span></li>)
                : confirm.cap_ids.map((id) => <li key={id}><code>{id}</code></li>)}
            </ul>
            <p className="muted">This changes the demo topology; use Reset to restore it. Applying a permission change is risk-increasing for the people who rely on it, so it needs a person.</p>
          </>
        )}
      </Dialog>
    </section>
  );
}
