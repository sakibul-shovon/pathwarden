import type { SessionView } from "../../../api/types";
import { RuleOfTwoLetters } from "../../../shared/components/RuleOfTwoLetters";

const AGENTS = [
  { id: "triage", title: "Triage", role: "Reads public issues, records structured tasks and team memory" },
  { id: "fixer", title: "Fixer", role: "Reads tasks, team conventions and deploy config; writes the changelog draft" },
  { id: "release", title: "Release", role: "Reads the changelog draft and publishes the release notes" },
] as const;

/** One lane per agent with the Rule-of-Two letters of each of its sessions (computed by the API from the graph, q5). */
export function AgentLanes({ sessions }: { sessions: SessionView[] }) {
  const allGreen = sessions.every((s) => s.rule_of_two.green);
  return (
    <section aria-labelledby="pw-agents-title">
      <h2 id="pw-agents-title" className="pw-run__h">
        Agents
      </h2>
      <p className="pw-muted pw-prose">
        Meta&apos;s Rule of Two is checked per agent session.{" "}
        {allGreen
          ? "Each session below passes it, yet the system can still leak, because shared memory carries the attack between agents and across days."
          : "At least one session below violates it."}
      </p>
      <p className="pw-r2__legend">A untrusted input · B secrets · C changes state or communicates outside</p>
      <div className="pw-lanes">
        {AGENTS.map((agent) => (
          <div key={agent.id} className="pw-lane">
            <h3 className="pw-lane__name">{agent.title}</h3>
            <p className="pw-muted pw-lane__role">{agent.role}</p>
            <ul className="pw-lane__sessions">
              {sessions
                .filter((s) => s.agent === agent.id)
                .map((s) => (
                  <li key={s.id}>
                    <code>{s.id}</code> <span className="pw-muted">{s.day}</span> <RuleOfTwoLetters data={s.rule_of_two} />
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
