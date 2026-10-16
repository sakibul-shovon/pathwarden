import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../../api/client";
import type { AgentWitness, ApplyResult, Candidate, CapState, EvalSummary, Topology } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Dialog } from "../../../shared/components/Dialog";
import { ErrorPanel } from "../../../shared/components/ErrorPanel";
import { Notice } from "../../../shared/components/Notice";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { Skeleton } from "../../../shared/components/Skeleton";
import { describeError } from "../../errorCatalogue";
import { CapabilityFigure } from "../../graph/CapabilityFigure";
import { completeStep } from "../../guideStore";
import { AgentInspector } from "./AgentInspector";
import { CapabilityTable } from "./CapabilityTable";
import { CutComparison } from "./CutComparison";
import { appliedSentence, cheapestVerified, optimumSentence, reviewRows, revokeLabel, toxicCount } from "./remediateLogic";
import "./remediate.css";

const TOPOLOGIES: Topology[] = ["enterprise12", "tinyqueue3"];
const NONE: string[] = [];

type Busy = "suggest" | "apply" | "reset" | null;

interface RemediateViewProps {
  initialTopology: Topology;
  /** Reflect the topology in the address bar (replaces the history entry). */
  onChangeTopology: (topology: Topology) => void;
}

/** Least-privilege remediation (ui-redesign.md §13.8): which agents are toxic, the complete cuts the API computed with max flow and
 *  verified on a temporary copy, and a human-confirmed Apply. Every number comes from the API; nothing is typed here. */
export function RemediateView({ initialTopology, onChangeTopology }: RemediateViewProps) {
  const [topology, setTopology] = useState<Topology>(initialTopology);
  const [state, setState] = useState<CapState | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [witness, setWitness] = useState<AgentWitness | null>(null);
  const [applied, setApplied] = useState<ApplyResult | null>(null);
  const [evalSummary, setEvalSummary] = useState<EvalSummary | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<unknown>(null);
  const [applying, setApplying] = useState<Candidate | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showAs, setShowAs] = useState<"graph" | "table">("graph");

  const load = useCallback((name: Topology) => {
    let cancelled = false;
    setError(null);
    api
      .capState(name)
      .then((s) => {
        if (!cancelled) setState(s);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setState(null);
    setCandidates(null);
    setPreview(null);
    setSelected(null);
    setWitness(null);
    setApplied(null);
    return load(topology);
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
        if (!cancelled) setError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, topology]);

  // story step 6 is done when the four candidate cuts are shown
  useEffect(() => {
    if (candidates && candidates.length > 0) completeStep("remediate");
  }, [candidates]);

  async function run<T>(what: Exclude<Busy, null>, action: () => Promise<T>): Promise<T | null> {
    setBusy(what);
    setError(null);
    try {
      return await action();
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setBusy(null);
    }
  }

  const changeTopology = (next: Topology): void => {
    setTopology(next);
    onChangeTopology(next);
  };

  const suggest = async (): Promise<void> => {
    const result = await run("suggest", () => api.capSuggest(topology));
    if (result) {
      setCandidates(result.candidates);
      setApplied(null);
    }
  };

  const apply = async (candidate: Candidate): Promise<void> => {
    const result = await run("apply", () => api.capApply(topology, candidate.cap_ids));
    setApplying(null);
    if (result) {
      setApplied(result);
      setCandidates(null);
      setPreview(null);
      load(topology);
    }
  };

  const reset = async (): Promise<void> => {
    const next = await run("reset", () => api.capReset(topology));
    setResetting(false);
    if (next) {
      setState(next);
      setCandidates(null);
      setPreview(null);
      setApplied(null);
      setWitness(null);
      setSelected(null);
    }
  };

  const best = useMemo(() => (candidates ? cheapestVerified(candidates) : undefined), [candidates]);
  const previewed = candidates?.find((c) => c.id === preview);
  const cut = useMemo(() => previewed?.cap_ids ?? NONE, [previewed]);
  const failure = error ? describeError(error) : null;
  const optimum = optimumSentence(evalSummary?.remediation?.[topology]);

  return (
    <div className="pw-remediate">
      <div className="pw-remediate__controls">
        <SegmentedControl legend="Topology" value={topology} onChange={changeTopology} disabled={busy !== null} options={TOPOLOGIES.map((t) => ({ value: t, label: t }))} />
        <p className="pw-remediate__toxic" role="status">
          {state ? <strong>{toxicCount(state)}</strong> : "Loading…"}
        </p>
        <Button variant="primary" pending={busy === "suggest"} disabled={busy !== null || state === null} onClick={() => void suggest()}>
          {busy === "suggest" ? "Computing…" : "Suggest cuts"}
        </Button>
        <Button disabled={busy !== null} onClick={() => setResetting(true)}>
          Reset topology…
        </Button>
      </div>
      <p className="pw-muted pw-prose">
        An agent is <strong>toxic</strong> when it can receive untrusted data, can receive secrets and can reach an external sink. Each candidate cut is a
        complete fix, computed with <code>algo.maxFlow</code> and verified on a temporary copy of the graph. Apply changes the demo topology; Reset restores it.
      </p>
      {busy === "suggest" && (
        <p role="status" className="pw-muted">
          Computing four cuts with algo.maxFlow and verifying each on a copy of the graph…
        </p>
      )}

      {failure && (
        <ErrorPanel title={failure.title} code={failure.code}>
          {failure.hint && <p>{failure.hint}</p>}
          {failure.detail && <p className="pw-muted">{failure.detail}</p>}
        </ErrorPanel>
      )}

      {state === null && !failure && <Skeleton lines={1} height={320} />}

      {state && (
        <div className="pw-remediate__body">
          <div className="pw-remediate__graph">
            <SegmentedControl
              legend="Show as"
              value={showAs}
              onChange={setShowAs}
              options={[
                { value: "graph", label: "Graph" },
                { value: "table", label: "Table" },
              ]}
            />
            {showAs === "graph" ? (
              <CapabilityFigure nodes={state.nodes} edges={state.edges} selected={selected} cut={cut} onSelect={setSelected} source={`GET /remediation/${state.topology}`} />
            ) : (
              <CapabilityTable nodes={state.nodes} edges={state.edges} selected={selected} onSelect={setSelected} />
            )}
          </div>
          <AgentInspector selected={selected} witness={witness} />
        </div>
      )}

      {applied && (
        <Notice variant="info">
          {appliedSentence(applied)} The graph shows the revoked flows dashed and faded.
        </Notice>
      )}

      <section aria-labelledby="pw-cuts-title" className="pw-remediate__cuts">
        <h2 id="pw-cuts-title" className="pw-remediate__h">
          Cut comparison
        </h2>
        <CutComparison candidates={candidates} best={best} preview={preview} busy={busy !== null} optimum={optimum} onPreview={setPreview} onApply={setApplying} />
      </section>

      <Dialog
        open={applying !== null}
        onClose={() => setApplying(null)}
        title={applying ? `Apply ${applying.id}: revoke ${applying.cap_ids.length} ${applying.cap_ids.length === 1 ? "flow" : "flows"}?` : "Apply cut?"}
        actions={
          <>
            <Button data-autofocus onClick={() => setApplying(null)} disabled={busy === "apply"}>
              Cancel
            </Button>
            <Button variant="danger" pending={busy === "apply"} onClick={() => applying && void apply(applying)}>
              {busy === "apply" ? "Revoking…" : applying ? revokeLabel(applying) : "Revoke"}
            </Button>
          </>
        }
      >
        {applying && (
          <dl className="pw-review">
            <div>
              <dt>What will happen</dt>
              <dd>These flows are revoked in the {topology} topology; each agent that is toxic now is checked again afterwards.</dd>
            </div>
            <div>
              <dt>Flows revoked (total cost {applying.total_cost})</dt>
              <dd>
                <ul className="pw-review__list">
                  {reviewRows(applying).map((r) => (
                    <li key={r.id}>
                      <code>{r.text}</code>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt>What changes</dt>
              <dd>This changes the demo topology for everyone using it. Reset restores it from the YAML file.</dd>
            </div>
            <div>
              <dt>Who</dt>
              <dd>
                Recorded as a human action: the request is sent with the header <code>X-PW-Human: true</code>.
              </dd>
            </div>
          </dl>
        )}
      </Dialog>

      <Dialog
        open={resetting}
        onClose={() => setResetting(false)}
        title={`Reset ${topology}?`}
        actions={
          <>
            <Button data-autofocus onClick={() => setResetting(false)} disabled={busy === "reset"}>
              Cancel
            </Button>
            <Button variant="danger" pending={busy === "reset"} onClick={() => void reset()}>
              {busy === "reset" ? "Resetting…" : "Reset topology"}
            </Button>
          </>
        }
      >
        <dl className="pw-review">
          <div>
            <dt>What will happen</dt>
            <dd>The {topology} topology is restored from its YAML file: every flow revoked so far comes back.</dd>
          </div>
          <div>
            <dt>Who</dt>
            <dd>
              Recorded as a human action: the request is sent with the header <code>X-PW-Human: true</code>.
            </dd>
          </div>
        </dl>
      </Dialog>
    </div>
  );
}
