import type { LaunderingMemory } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Scroll } from "../../../shared/components/Scroll";

/** The memories that carried untrusted text into this payload, written in an earlier session (q3). Each row can jump to the
 *  moment it was written in Time travel; the moment itself comes from `GET /graph-at`, never from this page. */
export function LaunderingTable({ rows, onWhen, onOpen }: { rows: LaunderingMemory[]; onWhen: (row: LaunderingMemory) => void; onOpen?: (id: string) => void }) {
  return (
    <div>
      <p className="pw-muted pw-prose">
        Untrusted text reached this payload through team memory written in {rows.some((r) => r.written_on) ? "an earlier session" : "a session"}:
      </p>
      <Scroll label="Memories that carried untrusted text">
        <table className="pw-log__table">
          <caption className="pw-visually-hidden">Memories that carried untrusted text into the payload</caption>
          <thead>
            <tr>
              <th scope="col">memory</th>
              <th scope="col">key</th>
              <th scope="col">written by</th>
              <th scope="col">session</th>
              <th scope="col">day</th>
              <th scope="col">untrusted source</th>
              <th scope="col">
                <span className="pw-visually-hidden">when</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.memory_id}>
                <td>
                  {onOpen ? (
                    <button type="button" className="pw-gtable__open" onClick={() => onOpen(m.memory_id)}>
                      <code>{m.memory_id}</code>
                    </button>
                  ) : (
                    <code>{m.memory_id}</code>
                  )}
                </td>
                <td>{m.memory_key}</td>
                <td>{m.written_by}</td>
                <td>
                  <code>{m.written_in_session}</code>
                </td>
                <td>{m.written_on}</td>
                <td>
                  <code>{m.untrusted_source}</code>
                </td>
                <td>
                  <Button variant="quiet" size="sm" onClick={() => onWhen(m)}>
                    When was this written?
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
    </div>
  );
}
