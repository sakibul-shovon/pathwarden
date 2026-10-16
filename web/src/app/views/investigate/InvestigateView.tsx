import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, PUBLIC_PAGE_SINK } from "../../../api/client";
import type { ActionDetail, Explain, ForensicReport, HealResult, LaunderingMemory, LlmInfo, PostedEntry } from "../../../api/types";
import { LineageGraph } from "../../../components/LineageGraph";
import { Button } from "../../../shared/components/Button";
import { ErrorPanel } from "../../../shared/components/ErrorPanel";
import { Notice } from "../../../shared/components/Notice";
import { Skeleton } from "../../../shared/components/Skeleton";
import { useElapsed } from "../../../shared/lib/useElapsed";
import { usePoll } from "../../../hooks";
import { describeError } from "../../errorCatalogue";
import { completeStep } from "../../guideStore";
import type { TabId, UrlState } from "../../url";
import { ReleaseSheet } from "../run/ReleaseSheet";
import { canRelease, initialSelection, needsDecision, stepCount, whySentence, witnessSteps } from "./caseLogic";
import { DecisionPanel, ReleaseResult } from "./DecisionPanel";
import { ForensicsPanel } from "./ForensicsPanel";
import { LaunderingTable } from "./LaunderingTable";
import { PayloadDiff, type DiffSide } from "./PayloadDiff";
import { ReviewQueue } from "./ReviewQueue";
import { VerdictPair } from "./VerdictPair";
import { WitnessPaths } from "./WitnessPaths";
import "./investigate.css";

interface Loaded {
  action: ActionDetail;
  explain: Explain;
}

interface InvestigateViewProps {
  workspace: string;
  /** The action named in the URL (`?action=`), opened first. */
  initialAction: string | null;
  autoForensics: boolean;
  autoHeal: boolean;
  onNavigate: (tab: TabId, patch?: Partial<UrlState>) => void;
  /** Reflect the open action in the address bar (replaces the history entry). */
  onSelectAction: (id: string) => void;
}

const Section = ({ n, id, title, children }: { n: number; id: string; title: string; children: ReactNode }) => (
  <section className="pw-case__section" aria-labelledby={id}>
    <h2 id={id} className="pw-case__h">
      <span className="pw-case__n" aria-hidden="true">
        {n}
      </span>
      {title}
    </h2>
    {children}
  </section>
);

/** Review queue and case file of an action (ui-redesign.md §13.5). All evidence comes from the API: the verdict, the two
 *  witness paths, the lineage, the memories that carried the text, the forensic report; this view only arranges and words it. */
export function InvestigateView({ workspace, initialAction, autoForensics, autoHeal, onNavigate, onSelectAction }: InvestigateViewProps) {
  const actions = usePoll(api.actions, 3000);
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [report, setReport] = useState<ForensicReport | null>(null);
  const [diff, setDiff] = useState<{ held: DiffSide; healed: DiffSide } | null>(null);
  const [heal, setHeal] = useState<HealResult | null>(null);
  const [postedAfter, setPostedAfter] = useState<PostedEntry[]>([]);
  const [busy, setBusy] = useState<"forensics" | "heal" | null>(null);
  const [version, setVersion] = useState(0);
  /** The action asked for in the URL when it is not in this workspace (a run resets it and ids start again). */
  const [staleLink, setStaleLink] = useState<string | null>(null);
  const [mode, setMode] = useState<"scripted" | "llm">("scripted");
  const [llm, setLlm] = useState<LlmInfo | null>(null);
  const { elapsedMs, slow } = useElapsed(busy === "forensics");
  const autoForensicsDone = useRef(false);

  useEffect(() => {
    api.health().then((h) => setLlm(h.llm)).catch(() => setLlm(null));
  }, []);

  // open the action named in the URL, else the first one that needs a decision
  useEffect(() => {
    const list = actions.data;
    if (selected !== null || !list) return;
    const id = initialSelection(list, initialAction);
    if (id !== null) {
      setSelected(id);
      if (id !== initialAction) {
        if (initialAction !== null) setStaleLink(initialAction);
        onSelectAction(id);
      }
    }
  }, [actions.data, selected, initialAction, onSelectAction]);

  // the verdict (computed now) and the explanation of the open action
  useEffect(() => {
    if (selected === null) return;
    let cancelled = false;
    Promise.all([api.action(selected), api.explain(selected)])
      .then(([action, explain]) => {
        if (cancelled) return;
        setLoaded({ action, explain });
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, version]);

  useEffect(() => {
    if (loaded && needsDecision(loaded.action.status)) completeStep("case");
  }, [loaded]);

  const select = useCallback(
    (id: string) => {
      setSelected(id);
      setStaleLink(null);
      setLoaded(null);
      setLoadError(null);
      setError(null);
      setReport(null);
      setDiff(null);
      setHeal(null);
      setPostedAfter([]);
      onSelectAction(id);
    },
    [onSelectAction],
  );

  const runForensics = useCallback(async (id: string, forensicMode: "scripted" | "llm") => {
    setBusy("forensics");
    setError(null);
    try {
      const result = await api.forensics(id, forensicMode);
      setReport(result);
      completeStep("heal");
      if (result.diff) {
        const side = async (artifactId: string, graph: "main" | "sandbox"): Promise<DiffSide> => {
          try {
            return { id: artifactId, content: (await api.artifact(artifactId, graph)).content, error: null };
          } catch (err) {
            return { id: artifactId, content: null, error: describeError(err).title };
          }
        };
        const [held, healed] = await Promise.all([side(result.diff.held_payload_id, "main"), side(result.diff.healed_payload_id, "sandbox")]);
        setDiff({ held, healed });
      }
      setVersion((v) => v + 1);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  }, []);

  const approveHeal = useCallback(
    async (id: string) => {
      setBusy("heal");
      setError(null);
      try {
        const result = await api.healApprove(id);
        setHeal(result);
        setPostedAfter(await api.sink(PUBLIC_PAGE_SINK));
        setVersion((v) => v + 1);
        actions.reload();
      } catch (err) {
        setError(err);
      } finally {
        setBusy(null);
      }
    },
    [actions],
  );

  // deep links: `?autoforensics=1` investigates once the case is open; `?autoheal=1` releases once the report recommends it
  useEffect(() => {
    if (autoForensics && !autoForensicsDone.current && loaded) {
      autoForensicsDone.current = true;
      void runForensics(loaded.action.id, "scripted");
    }
  }, [autoForensics, loaded, runForensics]);
  useEffect(() => {
    if (autoHeal && loaded && report?.recommendation === "APPROVE_HEALED_RELEASE" && !heal && busy === null) void approveHeal(loaded.action.id);
  }, [autoHeal, loaded, report, heal, busy, approveHeal]);

  const whenWritten = useCallback(
    async (_row: LaunderingMemory) => {
      try {
        const max = await api.timelineMax();
        const g = await api.graphAt(max.t);
        onNavigate("time", { t: g.markers.poisoned_memory_written?.t ?? max.t });
      } catch (err) {
        setError(err);
      }
    },
    [onNavigate],
  );

  const view = useMemo(() => {
    if (!loaded) return null;
    const { action, explain } = loaded;
    const nodes = explain.subgraph.nodes;
    const g = explain.gate;
    return {
      why: whySentence({
        reason: g.reason,
        status: action.status,
        untrustedWitness: g.untrusted_witness,
        secretWitness: g.secret_witness,
        quarantinedAncestors: g.quarantined_ancestors,
        payloadId: action.payload_id,
        nodes,
        laundering: explain.laundering,
      }),
      untrusted: witnessSteps(g.untrusted_witness, nodes, explain.laundering),
      secret: witnessSteps(g.secret_witness, nodes, explain.laundering),
      artifacts: nodes.filter((n) => n.label === "Artifact").length,
      sources: nodes.filter((n) => n.label === "Source").length,
    };
  }, [loaded]);

  const missing = loadError instanceof ApiError && loadError.status === 404 && selected !== null;
  const described = !missing && loadError ? describeError(loadError) : null;
  const heldNow = loaded?.action;
  const healedPreview = diff?.healed.content ? diff.healed.content.split("\n").slice(0, 6) : [];
  const showRelease = report !== null && heldNow && canRelease(report, heldNow.status, heal !== null);
  const toNew = (): void => onNavigate("run", { scenario: "attack_pipeline_42", guard: true });

  return (
    <div className="pw-case">
      <aside className="pw-case__queue" aria-label="Actions">
        {actions.error && <ErrorPanel title="Could not load the actions" code="load_error">{actions.error}</ErrorPanel>}
        <ReviewQueue actions={actions.data} workspace={workspace} selected={selected} onSelect={select} onRun={toNew} />
      </aside>

      <div className="pw-case__main">
        {staleLink !== null && (
          <Notice variant="caveat">
            <code>{staleLink}</code> is not in this workspace: every run starts from a clean graph and the ids begin again, so a saved link can
            point at an action that no longer exists. <code>{selected}</code> is open instead.
          </Notice>
        )}
        {missing && (
          <Notice variant="caveat">
            {selected} no longer exists: the workspace was reset by a new run.{" "}
            <Button size="sm" onClick={() => select(initialSelection(actions.data ?? [], null) ?? "")} disabled={(actions.data ?? []).length === 0}>
              Show current actions
            </Button>
          </Notice>
        )}
        {described && <ErrorPanel title={described.title} code={described.code}>{described.hint && <p>{described.hint}</p>}{described.detail && <p className="pw-muted">{described.detail}</p>}</ErrorPanel>}
        {selected !== null && !loaded && !loadError && <Skeleton lines={6} height={18} />}

        {heldNow && loaded && view && (
          <>
            <header className="pw-case__head">
              <h2 className="pw-case__title">
                Case <code>{heldNow.id}</code>
              </h2>
            </header>
            <VerdictPair action={heldNow} />

            <Section n={1} id="pw-why" title="Why">
              {view.why ? <p className="pw-case__why">{view.why}</p> : <p className="pw-case__why">The gate reason is <code>{loaded.explain.gate.reason}</code>.</p>}
            </Section>

            <Section n={2} id="pw-paths" title="Witness paths">
              {view.untrusted.length === 0 && view.secret.length === 0 ? (
                <p className="pw-muted">No witness paths: the gate found no complete untrusted-and-secret pair.</p>
              ) : null}
              <WitnessPaths untrusted={view.untrusted} secret={view.secret} queries={loaded.explain.queries} />
            </Section>

            <Section n={3} id="pw-lineage" title="Lineage">
              <figure className="pw-case__figure">
                <LineageGraph
                  nodes={loaded.explain.subgraph.nodes}
                  edges={loaded.explain.subgraph.edges}
                  untrustedWitness={loaded.explain.gate.untrusted_witness}
                  secretWitness={loaded.explain.gate.secret_witness}
                />
                <figcaption className="pw-muted">
                  Lineage of {heldNow.id}: {view.artifacts} artifacts, {view.sources} sources, {loaded.explain.subgraph.edges.length} edges. Untrusted path{" "}
                  {stepCount(loaded.explain.gate.untrusted_witness)} steps, secret path {stepCount(loaded.explain.gate.secret_witness)} steps.
                </figcaption>
              </figure>
            </Section>

            {loaded.explain.laundering.length > 0 && (
              <Section n={4} id="pw-laundering" title="How it got there">
                <LaunderingTable rows={loaded.explain.laundering} onWhen={(r) => void whenWritten(r)} />
              </Section>
            )}

            <Section n={5} id="pw-forensics" title="Forensics">
              <ForensicsPanel
                mode={mode}
                onMode={setMode}
                llm={llm}
                busy={busy === "forensics"}
                elapsedMs={elapsedMs}
                slow={slow}
                onRun={() => void runForensics(heldNow.id, mode)}
                report={report}
              />
            </Section>

            {diff && (
              <Section n={6} id="pw-diff" title="Held vs healed">
                <PayloadDiff held={diff.held} healed={diff.healed} />
              </Section>
            )}

            {(showRelease || heal) && (
              <Section n={7} id="pw-decision" title="Decision">
                {heal ? (
                  <>
                    <ReleaseResult heal={heal} oldAction={heldNow.id} />
                    <ReleaseSheet posted={postedAfter} markLeaks={false} held={false} />
                  </>
                ) : (
                  report && <DecisionPanel actionId={heldNow.id} report={report} healedPreview={healedPreview} busy={busy === "heal"} onRelease={() => approveHeal(heldNow.id)} />
                )}
              </Section>
            )}
            {error !== null && (
              <ErrorPanel title={describeError(error).title} code={describeError(error).code}>
                {describeError(error).hint && <p>{describeError(error).hint}</p>}
                {describeError(error).detail && <p className="pw-muted">{describeError(error).detail}</p>}
              </ErrorPanel>
            )}
          </>
        )}
      </div>
    </div>
  );
}
