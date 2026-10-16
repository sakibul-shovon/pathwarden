import type { LiveInfo } from "../../../api/types";
import { stopLabel } from "./runLogic";

/** What the live (language-model) agents did: the model, the tokens it used, and why each session ended. The raw stop
 *  reason is kept next to its label. Whether a model follows a hidden instruction is up to the model, not scripted. */
export function LivePanel({ live }: { live: LiveInfo }) {
  return (
    <section aria-labelledby="pw-live-title">
      <h2 id="pw-live-title" className="pw-run__h">
        Live agents
      </h2>
      <p className="pw-muted pw-prose">
        Real language-model agents (<code>{live.model}</code>) played the three roles; the model was not told anything about
        security. Whether it follows a hidden instruction is up to the model: nothing here is scripted.
      </p>
      <dl className="pw-facts">
        <div>
          <dt>Model calls</dt>
          <dd>{live.llm.calls}</dd>
        </div>
        <div>
          <dt>Prompt tokens</dt>
          <dd>{live.llm.prompt_tokens}</dd>
        </div>
        <div>
          <dt>Completion tokens</dt>
          <dd>{live.llm.completion_tokens}</dd>
        </div>
      </dl>
      <div className="pw-scroll">
        <table className="pw-log__table">
          <thead>
            <tr>
              <th scope="col">session</th>
              <th scope="col">agent</th>
              <th scope="col">model steps</th>
              <th scope="col">ended</th>
            </tr>
          </thead>
          <tbody>
            {live.sessions.map((s) => (
              <tr key={s.session}>
                <td>
                  <code>{s.session}</code>
                </td>
                <td>{s.agent}</td>
                <td>{s.steps}</td>
                <td>
                  {stopLabel(s.stopped)} <code className="pw-muted">{s.stopped}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
