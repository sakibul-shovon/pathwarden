import { useCallback, useEffect, useState } from "react";
import { api, PUBLIC_PAGE_SINK } from "../api/client";
import type { PostedEntry, RunResult, ScenarioInfo, SessionView } from "../api/types";
import { RuleOfTwoBadge } from "../components/RuleOfTwo";
import { errorText } from "../hooks";

export interface RunInitial {
  scenario: string;
  guard: boolean;
  autorun: boolean;
}

const AGENTS = [
  { id: "triage", title: "Triage", role: "Reads public issues, records structured tasks and team memory" },
  { id: "fixer", title: "Fixer", role: "Reads tasks, team conventions and deploy config; writes the changelog draft" },
  { id: "release", title: "Release", role: "Reads the changelog draft and publishes the release notes" },
] as const;

const LEAK = /PWDEMO-|### Checksum/;

function Outcome({ result, posted }: { result: RunResult; posted: PostedEntry[] }) {
  const last = result.actions[result.actions.length - 1];
  if (!last) return null;
  const leaked = posted.some((p) => LEAK.test(p.content));
  if (last.status === "held" || last.status === "blocked") {
    return (
      <div className="banner red" role="status">
        <strong>HELD</strong> {last.id}: {last.reason}. Nothing was posted. Investigate it in the Investigate tab.
      </div>
    );
  }
  if (leaked) {
    return (
      <div className="banner red" role="status">
        <strong>LEAKED</strong> {last.id} ({last.reason}): the public release page now shows secret values,
        although every agent session passed the Rule of Two.
      </div>
    );
  }
  return (
    <div className="banner green" role="status">
      <strong>POSTED</strong> {last.id} ({last.reason}): a clean release note was published.
    </div>
  );
}

function SessionRow({ s }: { s: SessionView }) {
  return (
    <li>
      <code>{s.id}</code> <span className="muted">{s.day}</span> <RuleOfTwoBadge data={s.rule_of_two} />
    </li>
  );
}

export function RunTab({ initial }: { initial: RunInitial }) {
  const [scenarios, setScenarios] = useState<ScenarioInfo[]>([]);
  const [scenario, setScenario] = useState(initial.scenario);
  const [guard, setGuard] = useState(initial.guard);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [posted, setPosted] = useState<PostedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (name: string, withGuard: boolean) => {
      setBusy(true);
      setError(null);
      try {
        const outcome = await api.run(name, withGuard, "scripted");
        setResult(outcome);
        setPosted(await api.sink(PUBLIC_PAGE_SINK));
      } catch (err) {
        setError(errorText(err));
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  useEffect(() => {
    api
      .scenarios()
      .then((list) => {
        setScenarios(list);
        if (!list.some((s) => s.name === initial.scenario) && list[0]) setScenario(list[0].name);
      })
      .catch((err: unknown) => setError(errorText(err)));
    if (initial.autorun) void run(initial.scenario, initial.guard);
  }, [initial, run]);

  const current = scenarios.find((s) => s.name === scenario);

  return (
    <section aria-label="Run">
      <div className="card controls">
        <label>
          Scenario
          <select value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={busy}>
            {scenarios.map((s) => (
              <option key={s.name} value={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={guard} onChange={(e) => setGuard(e.target.checked)} disabled={busy} />
          Pathwarden guard <strong>{guard ? "ON" : "OFF"}</strong>
        </label>
        <fieldset className="mode">
          <legend>Mode</legend>
          <label><input type="radio" checked readOnly /> scripted</label>
          <label title="Live LLM agents arrive in phase P8">
            <input type="radio" disabled /> live <span className="muted">(arrives in P8)</span>
          </label>
        </fieldset>
        <button type="button" className="primary" onClick={() => void run(scenario, guard)} disabled={busy || !scenario}>
          {busy ? "Running…" : "Run"}
        </button>
        {current && <p className="muted desc">{current.description}</p>}
      </div>

      {error && <div className="banner red" role="alert">{error}</div>}
      {result && <Outcome result={result} posted={posted} />}

      {result && (
        <>
          <h2>Agents</h2>
          <p className="muted">
            Meta&apos;s Rule of Two is checked per agent session. Each session below passes it, yet the system can still
            leak, because shared memory carries the attack between agents and across days.
          </p>
          <div className="agents">
            {AGENTS.map((agent) => (
              <div className="card" key={agent.id}>
                <h3>{agent.title}</h3>
                <p className="muted">{agent.role}</p>
                <ul className="sessions">
                  {result.sessions.filter((s) => s.agent === agent.id).map((s) => (
                    <SessionRow key={s.id} s={s} />
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <h2>Public release page</h2>
          <div className="card">
            {posted.length === 0 ? (
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
          </div>

          <h2>Timeline</h2>
          <div className="card scroll">
            <table>
              <thead><tr><th>t</th><th>agent</th><th>operation</th><th>detail</th></tr></thead>
              <tbody>
                {result.timeline.map((row) => (
                  <tr key={row.t} className={row.op === "gate" ? "gate-row" : undefined}>
                    <td>{row.t}</td><td>{row.agent}</td><td>{row.op}</td><td><code>{row.detail}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
