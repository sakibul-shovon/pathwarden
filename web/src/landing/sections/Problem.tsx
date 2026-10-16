import { AgentLanes } from "../../app/views/run/AgentLanes";
import { ReleaseSheet } from "../../app/views/run/ReleaseSheet";
import type { LandingStory } from "../story";
import { Section } from "./Section";

/** The leak is not in any one agent. The three agents are the recorded sessions with the Rule-of-Two letters the API computed from the
 *  graph (the same component as the app), and the release page is what an outsider saw with the guard off. */
export function Problem({ story }: { story: LandingStory }) {
  return (
    <Section
      id="problem"
      eyebrow="The problem"
      title="The leak isn't in any one agent. It's in the path between them."
      lead={
        <p>
          Each session of the recorded run passes the Rule of Two. The secret still reaches the public release page, because shared team memory carried an instruction from
          the untrusted side to the secret side.
        </p>
      }
    >
      <div className="pw-problem">
        <div className="pw-problem__agents">
          <AgentLanes sessions={story.guard_off.run.sessions} />
        </div>
        <blockquote className="pw-problem__quote">
          <p>
            Meta&apos;s Agents Rule of Two says an agent &ldquo;must satisfy no more than two&rdquo; of three properties: <strong>[A]</strong> untrustworthy inputs, <strong>[B]</strong> sensitive
            systems or private data, <strong>[C]</strong> changing state or communicating externally, &ldquo;within a session&rdquo;.
          </p>
          <footer>
            <a href="https://ai.meta.com/blog/practical-ai-agent-security/" target="_blank" rel="noreferrer noopener">
              Meta, Agents Rule of Two, 31 Oct 2025 ↗
            </a>
          </footer>
        </blockquote>
        <div className="pw-problem__sheet">
          <ReleaseSheet posted={story.guard_off.posted} markLeaks held={false} />
          <p className="pw-muted pw-problem__note">The public release page after the unguarded run. The values are synthetic (<code>PWDEMO-…-NOT-A-REAL-KEY</code>).</p>
        </div>
      </div>
      <p className="pw-prose pw-problem__para">
        The rule is checked per agent and per session. Here it is satisfied three times and the system leaks anyway, across agents (and, in the sleeper scenario, across days). The
        same class of failure was disclosed by Invariant Labs against the official GitHub MCP server, where a malicious public issue led an agent to leak private-repository data:{" "}
        <a href="https://invariantlabs.ai/blog/mcp-github-vulnerability" target="_blank" rel="noreferrer noopener">
          the disclosure ↗
        </a>
        .
      </p>
    </Section>
  );
}
