import { useCallback, useEffect, useRef, useState } from "react";
import { api, PUBLIC_PAGE_SINK } from "../../../api/client";
import type { LlmInfo, PostedEntry, RunResult, ScenarioInfo } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Dialog } from "../../../shared/components/Dialog";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorPanel } from "../../../shared/components/ErrorPanel";
import { Notice } from "../../../shared/components/Notice";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { useElapsed } from "../../../shared/lib/useElapsed";
import { useMediaQuery } from "../../../shared/lib/useMediaQuery";
import { describeError } from "../../errorCatalogue";
import type { GuideStep } from "../../guide";
import { completeStep } from "../../guideStore";
import { MCP_SUFFIX } from "../../navModel";
import { buildSearch, parseUrl, type TabId, type UrlState } from "../../url";
import { AgentLanes } from "./AgentLanes";
import { EventLog } from "./EventLog";
import { LivePanel } from "./LivePanel";
import { OutcomeStrip } from "./OutcomeStrip";
import { ReleaseSheet } from "./ReleaseSheet";
import { RunStatus } from "./RunStatus";
import { ScenarioList } from "./ScenarioList";
import { StoryGuide } from "./StoryGuide";
import { outcomeOf, type Outcome } from "./runLogic";
import "./run.css";

export interface RunInitial {
  scenario: string;
  guard: boolean;
  autorun: boolean;
  mode: "scripted" | "live";
}

interface RunViewProps {
  initial: RunInitial;
  workspace: string;
  onNavigate: (tab: TabId, patch?: Partial<UrlState>) => void;
}

/** Reproduce a demo scenario with or without the guard (ui-redesign.md §13.4). Everything shown comes from the run's
 *  `RunResult` and the mock public page; the only thing computed here is the wording of the outcome (`runLogic.ts`). */
export function RunView({ initial, workspace, onNavigate }: RunViewProps) {
  const [scenarios, setScenarios] = useState<ScenarioInfo[] | null>(null);
  const [scenario, setScenario] = useState(initial.scenario);
  const [guard, setGuard] = useState(initial.guard);
  const [mode, setMode] = useState<"scripted" | "live">(initial.mode);
  const [llm, setLlm] = useState<LlmInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [posted, setPosted] = useState<PostedEntry[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confirmMcp, setConfirmMcp] = useState(false);
  const [setupOpen, setSetupOpen] = useState(true);
  const wide = useMediaQuery("(min-width: 1100px)");
  const { elapsedMs, slow } = useElapsed(busy);
  const outcomeHeading = useRef<HTMLHeadingElement>(null);
  const autorunDone = useRef(false);
  const isMcp = workspace.endsWith(MCP_SUFFIX);

  const run = useCallback(async (name: string, withGuard: boolean, runMode: "scripted" | "live") => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await api.run(name, withGuard, runMode);
      const page = await api.sink(PUBLIC_PAGE_SINK);
      setResult(outcome);
      setPosted(page);
      setSetupOpen(false);
      const o = outcomeOf(outcome, page);
      setAnnouncement(`Run finished: ${o.kind.toUpperCase()}${o.actionId ? ` ${o.actionId}` : ""}${o.reason ? ` (${o.reason})` : ""}.`);
    } catch (err) {
      setError(err);
      setResult(null);
      if (err instanceof Error && "code" in err && ["live_not_available", "llm_not_configured"].includes(String((err as { code: unknown }).code))) setMode("scripted");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    api.scenarios().then((list) => {
      setScenarios(list);
      setScenario((current) => (list.some((s) => s.name === current) || !list[0] ? current : list[0].name));
    }).catch(setError);
    api.health().then((h) => setLlm(h.llm)).catch(() => setLlm(null));
  }, []);

  // `?autorun=1` runs exactly once per page load (React StrictMode runs effects twice in development)
  useEffect(() => {
    if (initial.autorun && !autorunDone.current) {
      autorunDone.current = true;
      void run(initial.scenario, initial.guard, initial.mode);
    }
  }, [initial, run]);

  const outcome: Outcome | null = result ? outcomeOf(result, posted) : null;

  // complete the story steps this view can see, and move focus to the verdict so keyboard users land on it
  useEffect(() => {
    if (!outcome || !result) return;
    if (outcome.kind === "leaked") completeStep("leak");
    if (outcome.kind === "held" && result.guard) completeStep("hold");
    outcomeHeading.current?.focus();
  }, [outcome?.kind, outcome?.actionId, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = (): void => {
    if (isMcp) setConfirmMcp(true);
    else void run(scenario, guard, mode);
  };

  const applyStep = (step: GuideStep): void => {
    if (step.tab === "run") {
      if (step.preset.scenario) setScenario(step.preset.scenario);
      if (step.preset.guard !== undefined) setGuard(step.preset.guard);
      setSetupOpen(true);
    } else {
      onNavigate(step.tab, step.preset);
    }
  };

  // a real link, so "Open case" can be opened in a new tab or copied; a plain click navigates in the page
  const caseHref = (id: string): string => buildSearch({ ...parseUrl(""), tab: "investigate", ws: workspace, action: id });
  const liveHint = llm?.configured
    ? `Real language-model agents (${llm.model}); uses provider tokens and can take minutes.`
    : "Needs PW_LLM_API_KEY (and PW_LLM_MODEL) on the API.";
  const described = error ? describeError(error) : null;
  const showSetup = wide || setupOpen;

  return (
    <div className="pw-run">
      <div className="pw-run__setup">
        {!showSetup && (
          <div className="pw-run__summary">
            <span>
              <code>{scenario}</code> · guard {guard ? "on" : "off"} · {mode}
            </span>
            <Button size="sm" onClick={() => setSetupOpen(true)}>
              Change
            </Button>
          </div>
        )}
        {showSetup && (
          <div className="pw-run__panel">
            <ScenarioList scenarios={scenarios ?? []} loading={scenarios === null && !error} value={scenario} onChange={setScenario} disabled={busy} />
            <SegmentedControl
              legend="Pathwarden guard"
              value={guard ? "on" : "off"}
              onChange={(v) => setGuard(v === "on")}
              disabled={busy}
              options={[
                { value: "on", label: "On", hint: "The gate runs before every external action." },
                { value: "off", label: "Off", hint: "Nothing is checked: an attack will execute and leak." },
              ]}
            />
            <SegmentedControl
              legend="Agents"
              value={mode}
              onChange={setMode}
              disabled={busy}
              options={[
                { value: "scripted", label: "Scripted", hint: "A deterministic simulation of an agent that follows the injected instruction. No key, no cost." },
                { value: "live", label: "Live", disabled: !llm?.configured, hint: mode === "live" || !llm?.configured ? liveHint : undefined },
              ]}
            />
            <Notice variant="info">
              Each run starts from a clean workspace graph: earlier actions in this workspace are replaced.
              {isMcp && " This workspace shows the lineage that the MCP gateway wrote; a run here replaces it."}
            </Notice>
            <Button variant="primary" pending={busy} disabled={!scenario} onClick={start}>
              {busy ? "Running…" : isMcp ? "Run a scripted scenario here…" : "Run scenario"}
            </Button>
          </div>
        )}
      </div>

      <div className="pw-run__result">
        <div role="status" className="pw-visually-hidden">
          {announcement}
        </div>
        <StoryGuide onApply={applyStep} />
        {described && (
          <ErrorPanel title={described.title} code={described.code} recovery={<Button onClick={start}>Try again</Button>}>
            {described.hint && <p>{described.hint}</p>}
            {described.detail && <p className="pw-muted">{described.detail}</p>}
          </ErrorPanel>
        )}
        {busy && slow && <RunStatus scenario={scenario} guard={guard} mode={mode} model={llm?.model ?? null} elapsedMs={elapsedMs} />}
        {!result && !busy && !described && (
          <EmptyState>Pick a scenario and run it. Each run starts from a clean workspace graph.</EmptyState>
        )}
        {result && outcome && (
          <>
            <OutcomeStrip
              ref={outcomeHeading}
              outcome={outcome}
              caseHref={outcome.kind === "held" || outcome.kind === "blocked" ? (outcome.actionId ? caseHref(outcome.actionId) : null) : null}
              onOpenCase={(id) => onNavigate("investigate", { action: id })}
            />
            {result.live && <LivePanel live={result.live} />}
            <AgentLanes sessions={result.sessions} />
            <ReleaseSheet posted={posted} markLeaks={outcome.kind === "leaked"} held={outcome.kind === "held" || outcome.kind === "blocked"} />
            <EventLog rows={result.timeline} sessions={result.sessions} />
          </>
        )}
      </div>

      <Dialog
        open={confirmMcp}
        onClose={() => setConfirmMcp(false)}
        title="Run a scripted scenario in the MCP workspace?"
        actions={
          <>
            <Button data-autofocus onClick={() => setConfirmMcp(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmMcp(false);
                void run(scenario, guard, mode);
              }}
            >
              Replace the lineage and run
            </Button>
          </>
        }
      >
        <p>
          This workspace shows the lineage that the MCP gateway wrote (<code>make demo-mcp</code>). Running a scenario here resets
          it and replaces that lineage with a scripted run.
        </p>
      </Dialog>
    </div>
  );
}
