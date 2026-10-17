import { AnimatePresence, m } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, PUBLIC_PAGE_SINK } from "../api/client";
import type { PostedEntry, RunResult, ScenarioInfo } from "../api/types";
import { errorText } from "../hooks";
import { useNav } from "../nav";
import { ViewHeader } from "../shell/AppShell";
import { AgentPipeline, type PipelineOutcome } from "../run/AgentPipeline";
import { ActivityFeed } from "../run/ActivityFeed";
import { useReplay } from "../run/useReplay";
import { Icon } from "../ui/Icon";

export interface RunInitial {
  scenario: string;
  guard: boolean;
  autorun: boolean;
}

const LEAK = /PWDEMO-|### Checksum/;

interface Outcome {
  kind: Exclude<PipelineOutcome, null>;
  id: string;
  reason: string;
}

/** Same decision as before the redesign: the last action held/blocked, or a posted line carrying a fake secret. */
function outcomeOf(result: RunResult, posted: PostedEntry[]): Outcome | null {
  const last = result.actions[result.actions.length - 1];
  if (!last) return null;
  if (last.status === "held" || last.status === "blocked") return { kind: "held", id: last.id, reason: last.reason };
  if (posted.some((p) => LEAK.test(p.content))) return { kind: "leaked", id: last.id, reason: last.reason };
  return { kind: "posted", id: last.id, reason: last.reason };
}

function VerdictSlab({ outcome, onInvestigate, onRerun, guard }: { outcome: Outcome; onInvestigate: () => void; onRerun: () => void; guard: boolean }) {
  const { kind } = outcome;
  return (
    <m.div
      className={`slab slab-${kind}`}
      role="status"
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <span className="slab-icon"><Icon name={kind === "posted" ? "check" : kind === "held" ? "hold" : "alert"} size={28} /></span>
      <div className="slab-text">
        <strong className="slab-word">{kind === "held" ? "HELD" : kind === "leaked" ? "LEAKED" : "POSTED"}</strong>
        <span>
          <code>{outcome.id}</code> ({outcome.reason}){" "}
          {kind === "held" && "Nothing was posted."}
          {kind === "leaked" && "The public release page now shows secret values, although every agent session passed the Rule of Two."}
          {kind === "posted" && "A clean release note was published."}
        </span>
        {kind === "leaked" && (
          <span className="muted">
            The Rule of Two checks one session at a time. This leak crossed three sessions through shared memory, so no single check saw it.
          </span>
        )}
      </div>
      <div className="slab-actions">
        {kind === "held" && <button type="button" className="btn btn-solid" onClick={onInvestigate}>Investigate this <Icon name="forward" /></button>}
        {kind === "leaked" && !guard && <button type="button" className="btn btn-solid" onClick={onRerun}>Run again with the guard on</button>}
      </div>
    </m.div>
  );
}

export function RunTab({ initial, onAutoRun }: { initial: RunInitial; onAutoRun?: () => void }) {
  const { go } = useNav();
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [scenario, setScenario] = useState(initial.scenario);
  const [guard, setGuard] = useState(initial.guard);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<RunResult | null>(null);
  const [posted, setPosted] = useState<PostedEntry[]>([]);
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const run = useCallback(async (name: string, withGuard: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const outcome = await api.run(name, withGuard, "scripted");
      const page = await api.sink(PUBLIC_PAGE_SINK);
      setResult(outcome);
      setPosted(page);
      setRunId((n) => n + 1);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    api
      .scenarios()
      .then((list) => {
        setScenarios(list);
        if (!list.some((s) => s.name === initial.scenario) && list[0]) setScenario(list[0].name);
      })
      .catch((err: unknown) => setError(errorText(err)));
    if (initial.autorun && !autoStarted.current) {
      autoStarted.current = true;
      onAutoRun?.();
      void run(initial.scenario, initial.guard);
    }
    // mount only: the deep-link values are read once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // elapsed timer while a request is pending (an honest "working" signal; the API does not stream)
  useEffect(() => {
    if (!busy) return;
    setElapsed(0);
    const start = performance.now();
    const timer = window.setInterval(() => setElapsed((performance.now() - start) / 1000), 100);
    return () => window.clearInterval(timer);
  }, [busy]);

  const rows = result?.timeline ?? [];
  const replay = useReplay(rows.length, runId);
  const outcome = useMemo(() => (result ? outcomeOf(result, posted) : null), [result, posted]);
  const finished = result !== null && replay.step >= rows.length;
  const current = scenarios.find((s) => s.name === scenario);
  const issue = /(\d+)/.exec(result?.scenario ?? scenario)?.[1] ?? "";

  const groups = {
    attacks: scenarios.filter((s) => s.expected.status !== "executed"),
    benign: scenarios.filter((s) => s.expected.status === "executed"),
  };

  return (
    <section aria-label="Run">
      <ViewHeader id="run" />

      <div className="panel command" data-guard={guard ? "on" : "off"}>
        <div className="command-row">
          <label className="field-inline">
            <span>Scenario</span>
            <select value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={busy}>
              {groups.attacks.length > 0 && (
                <optgroup label="Attacks (expected: held)">
                  {groups.attacks.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </optgroup>
              )}
              {groups.benign.length > 0 && (
                <optgroup label="Benign controls (expected: executed)">
                  {groups.benign.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </optgroup>
              )}
            </select>
          </label>

          <button type="button" role="switch" aria-checked={guard} className="switch" onClick={() => setGuard(!guard)} disabled={busy}>
            <span className="switch-knob" aria-hidden="true" />
            <span>Pathwarden guard <strong>{guard ? "ON" : "OFF"}</strong></span>
          </button>

          <fieldset className="segmented" aria-label="Mode">
            <label><input type="radio" checked readOnly /> Scripted</label>
            <label title="Live LLM agents arrive in phase P8" className="is-disabled">
              <input type="radio" disabled /> Live <span className="muted">(arrives in P8)</span>
            </label>
          </fieldset>

          <button type="button" className="btn btn-solid btn-run" onClick={() => void run(scenario, guard)} disabled={busy || !scenario}>
            <Icon name="play" /> {busy ? "Running…" : "Run"}
          </button>
        </div>
        {current && <p className="muted command-desc">{current.description}</p>}
        {!guard && <p className="command-warn"><Icon name="alert" size={16} /> The guard is off: nothing stops an external action. This is the leak the product exists to prevent.</p>}
        <AnimatePresence>
          {busy && (
            <m.div className="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <span className="progress-bar" />
              <span className="progress-text">Running <code>{scenario}</code> · {elapsed.toFixed(1)} s</span>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {error && <div className="notice notice-hold" role="alert"><Icon name="alert" /> {error}</div>}

      {!result && !busy && (
        <div className="empty">
          <svg viewBox="0 0 220 70" aria-hidden="true"><path d="M5 18h120q40 0 40 25" className="ln-u" /><path d="M5 55h120q40 0 40-12" className="ln-s" /><rect x="190" y="14" width="7" height="46" rx="3" fill="currentColor" /></svg>
          <p><strong>Nothing has run yet.</strong></p>
          <p className="muted">Pick a scenario and press Run to see what the agents did.</p>
        </div>
      )}

      {result && (
        <>
          <div className="replay-bar" aria-live="off">
            {replay.playing ? (
              <>
                <span className="replay-label"><Icon name="bolt" size={16} /> Replaying the recorded run · event {replay.step} of {rows.length}</span>
                <span className="replay-track"><m.span className="replay-fill" animate={{ width: `${(replay.step / Math.max(rows.length, 1)) * 100}%` }} transition={{ duration: 0.2 }} /></span>
                <button type="button" className="btn btn-quiet" onClick={replay.skip}>Skip</button>
              </>
            ) : (
              <>
                <span className="replay-label muted">Recorded run · {rows.length} events. The API answers when a run is finished, so this is a replay.</span>
                <button type="button" className="btn btn-quiet" onClick={replay.restart}><Icon name="play" size={16} /> Replay</button>
              </>
            )}
          </div>

          <AgentPipeline rows={rows} sessions={result.sessions} step={replay.step} playing={replay.playing} outcome={outcome?.kind ?? null} issue={issue} />

          <AnimatePresence>
            {finished && outcome && (
              <VerdictSlab key={runId} outcome={outcome} guard={result.guard} onInvestigate={() => go("investigate")} onRerun={() => { setGuard(true); void run(result.scenario, true); }} />
            )}
          </AnimatePresence>

          <div className="two-col">
            <ActivityFeed rows={rows} step={replay.step} playing={replay.playing} />
            <div className="panel">
              <div className="panel-head"><h2>Public release page</h2><span className="muted">sink:public_release_page</span></div>
              {!finished ? (
                <p className="muted">Waiting for Release…</p>
              ) : posted.length === 0 ? (
                <p className="muted">Nothing has been posted.</p>
              ) : (
                posted.map((p) => (
                  <pre key={p.action_id} className="posted">
                    {p.content.split("\n").map((line, i) => (
                      <span key={i} className={LEAK.test(line) ? "leak-line" : undefined}>{line + "\n"}</span>
                    ))}
                  </pre>
                ))
              )}
              {finished && posted.some((p) => LEAK.test(p.content)) && (
                <p className="leak-note"><Icon name="alert" size={16} /> Highlighted lines carry the demo's fake secrets (<code>PWDEMO-…</code>).</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
