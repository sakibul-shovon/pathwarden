import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { AgentWitness, ApplyResult, Candidate, CapState, EvalSummary, Topology } from "../api/types";
import { CapabilityFigure } from "../app/graph/CapabilityFigure";
import { errorText } from "../hooks";

const TOPOLOGIES: Topology[] = ["enterprise12", "tinyqueue3"];

function Names({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="muted">none</span>;
  return <span className="pill-list">{items.map((n) => <code key={n}>{n}</code>)}</span>;
}

/** Least-privilege remediation (plan §15): which agents are toxic, the four provable max-flow cuts,
 *  and a human-confirmed Apply. Every number comes from the API; nothing is typed here. */
export function RemediateTab({ initialTopology }: { initialTopology: Topology }) {
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
    const ok = window.confirm(
      `Apply ${candidate.id} (cost ${candidate.total_cost})?\n\nIt revokes ${candidate.cap_ids.length} flow(s):\n` +
        `${candidate.cap_ids.join("\n")}\n\nThis changes the demo topology; use Reset to restore it.`,
    );
    if (!ok) return;
    const result = await run("apply", () => api.capApply(topology, candidate.cap_ids));
    if (result) {
      setApplied(result);
      setCandidates(null);
      setPreview(null);
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

  return (
    <>
      <div className="card">
        <div className="row-sel">
          <label>
            Topology{" "}
            <select value={topology} onChange={(e) => setTopology(e.target.value as Topology)}>
              {TOPOLOGIES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <button type="button" className="primary" disabled={busy !== null || state === null} onClick={() => void suggest()}>
            Suggest cuts
          </button>
          <button type="button" className="secondary" disabled={busy !== null} onClick={() => void reset()}>
            Reset topology
          </button>
          {busy && <span className="muted">{busy}…</span>}
        </div>
        <p className="muted">
          An agent is <strong>toxic</strong> when it can receive untrusted data, can receive secrets and can reach an
          external sink. Each candidate cut is a complete fix and is verified on a temporary copy of the graph.
          Apply changes the demo topology; Reset restores it.
        </p>
      </div>

      {error && <div className="banner red">{error}</div>}

      {state && (
        <div className="card">
          <h3>Capability graph: {state.topology}</h3>
          <p>
            Toxic agents ({state.toxic_agents.length}): <Names items={state.toxic_agents} />
          </p>
          <CapabilityFigure
            nodes={state.nodes}
            edges={state.edges}
            selected={selected}
            cut={previewed?.cap_ids ?? []}
            onSelect={setSelected}
            source={`GET /remediation/${state.topology}`}
          />
          {witness && selected === witness.agent && (
            <div className="card">
              <h4>Witness for <code>{witness.agent}</code> {witness.toxic ? <span className="badge red">TOXIC</span> : <span className="badge green">not toxic</span>}</h4>
              <dl className="facts">
                <div><dt>reachable from untrusted (path)</dt><dd><Names items={witness.from_untrusted} /></dd></div>
                <div><dt>reachable from secret (path)</dt><dd><Names items={witness.from_secret} /></dd></div>
                <div><dt>reaches outside (path)</dt><dd><Names items={witness.to_external} /></dd></div>
              </dl>
            </div>
          )}
          {selected === null && <p className="muted">Click an agent to see why it is (or is not) toxic.</p>}
        </div>
      )}

      {applied && (
        <div className="banner green">
          <strong>Applied:</strong> revoked {applied.revoked} flow(s) ({applied.cap_ids.join(", ")}). Toxic agents before:{" "}
          <Names items={applied.toxic_before} /> after: <Names items={applied.toxic_after} />
        </div>
      )}

      {candidates && (
        <div className="card scroll">
          <h3>Candidate cuts</h3>
          <table>
            <thead>
              <tr><th>candidate</th><th className="num">cost</th><th className="num">max flow</th><th className="num">flows</th><th>verified</th><th>revokes</th><th /></tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className={best?.id === c.id ? "best" : undefined}>
                  <td>{c.id}: {c.name}{best?.id === c.id ? " (cheapest verified)" : ""}</td>
                  <td className="num">{c.total_cost}</td>
                  <td className="num">{c.max_flow}</td>
                  <td className="num">{c.cap_ids.length}</td>
                  <td>{c.verified ? <span className="badge green">verified</span> : <span className="badge red">{c.invalid_reason ?? "not verified"}</span>}</td>
                  <td><Names items={c.cap_ids} /></td>
                  <td>
                    <button type="button" className="step" onClick={() => setPreview(preview === c.id ? null : c.id)}>
                      {preview === c.id ? "Hide cut" : "Show cut"}
                    </button>{" "}
                    <button type="button" className="danger" disabled={!c.verified || !c.needs_cut || busy !== null} onClick={() => void apply(c)}>
                      Apply
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {optimum && optimum.optimum_cost !== null && (
            <p className="muted">
              From the last <code>make eval</code>: best candidate {optimum.best_candidate_cost}, brute-force optimum{" "}
              {optimum.optimum_cost}{optimum.gap ? ` (gap ${optimum.gap}: a cheaper mixed cut exists that no single candidate finds)` : " (the candidate is optimal)"}.
            </p>
          )}
        </div>
      )}
    </>
  );
}
