import { useState } from "react";
import { api } from "../api/client";
import type { MemoryEntry } from "../api/types";
import { errorText, usePoll } from "../hooks";

/** Memory hygiene (plan §19 tab 4): who wrote each team-memory entry, from which untrusted origin,
 *  and whether it is quarantined. Releasing a quarantine is a human, risk-increasing action. */
export function MemoryTab() {
  const memory = usePoll(api.memory, 3000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function release(entry: MemoryEntry): Promise<void> {
    if (entry.quarantine_id === null) return;
    const ok = window.confirm(
      `Release quarantine ${entry.quarantine_id}?\n\nEvery artifact it covers becomes usable again, so the ` +
        "gate stops blocking on the quarantine (its other checks still apply). This changes the demo state.",
    );
    if (!ok) return;
    setBusy(entry.quarantine_id);
    setError(null);
    try {
      const result = await api.releaseQuarantine(entry.quarantine_id);
      setNotice(`Released ${result.quarantine_id}: ${result.released} artifact(s) restored.`);
      memory.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  const rows = memory.data ?? [];
  return (
    <div className="card">
      <h3>Team memory</h3>
      <p className="muted">
        Every entry written to shared team memory. An <em>untrusted origin</em> means the entry descends from
        an untrusted source without passing the sanitizer. The data comes from the q8 inventory.
      </p>
      {memory.error && <div className="banner red">{memory.error}</div>}
      {error && <div className="banner red">{error}</div>}
      {notice && <div className="banner green">{notice}</div>}
      {memory.data !== null && rows.length === 0 ? (
        <p className="muted">No memory entries yet. Run a scenario on the Run tab first.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>entry</th><th>key</th><th>kind</th><th>written by</th><th>day</th>
                <th>untrusted origins</th><th>state</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.memory_id}>
                  <td><code>{m.memory_id}</code></td>
                  <td>{m.key}</td>
                  <td>{m.kind}</td>
                  <td>{m.written_by}</td>
                  <td>{m.written_on}</td>
                  <td>
                    {m.untrusted_origins.length === 0
                      ? <span className="muted">none</span>
                      : m.untrusted_origins.map((o) => <code key={o} className="inline">{o}</code>)}
                  </td>
                  <td>
                    {m.quarantined
                      ? <span className="badge dark">QUARANTINED</span>
                      : <span className="badge green">active</span>}
                  </td>
                  <td>
                    {m.quarantined && (
                      <button
                        type="button"
                        className="danger"
                        disabled={m.quarantine_id === null || busy !== null}
                        title={m.quarantine_id === null ? "the quarantine id is unknown (the API was restarted); run forensics again" : undefined}
                        onClick={() => void release(m)}
                      >
                        Release quarantine
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
