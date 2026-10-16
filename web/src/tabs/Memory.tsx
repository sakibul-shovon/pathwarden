import { useState } from "react";
import { api } from "../api/client";
import type { MemoryEntry } from "../api/types";
import { errorText, usePoll } from "../hooks";
import { useNav } from "../nav";
import { ViewHeader } from "../shell/AppShell";
import { Chip } from "../ui/Chip";
import { Dialog } from "../ui/Dialog";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

type Filter = "all" | "untrusted" | "quarantined";

/** Memory hygiene (plan §19 tab 4): who wrote each team-memory entry, from which untrusted origin,
 *  and whether it is quarantined. Releasing a quarantine is a human, risk-increasing action. */
export function MemoryTab() {
  const { go } = useNav();
  const toast = useToast();
  const memory = usePoll(api.memory, 3000);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [pending, setPending] = useState<MemoryEntry | null>(null);

  async function release(entry: MemoryEntry): Promise<void> {
    if (entry.quarantine_id === null) return;
    setPending(null);
    setBusy(entry.quarantine_id);
    setError(null);
    try {
      const result = await api.releaseQuarantine(entry.quarantine_id);
      const text = `Released ${result.quarantine_id}: ${result.released} artifact(s) restored.`;
      setNotice(text);
      toast(text);
      memory.reload();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(null);
    }
  }

  const all = memory.data ?? [];
  const rows = all.filter((m) => (filter === "untrusted" ? m.untrusted_origins.length > 0 : filter === "quarantined" ? m.quarantined : true));
  const covered = pending ? all.filter((m) => m.quarantine_id === pending.quarantine_id && m.quarantine_id !== null).length : 0;

  const chip = (id: Filter, label: string, count: number) => (
    <button type="button" className="filter" aria-pressed={filter === id} onClick={() => setFilter(id)}>{label} <span className="badge-count">{count}</span></button>
  );

  return (
    <section aria-label="Memory">
      <ViewHeader id="memory" />
      <div className="panel">
        <div className="panel-head">
          <h2>Team memory</h2>
          <div className="filters" role="group" aria-label="Filter entries">
            {chip("all", "All", all.length)}
            {chip("untrusted", "From untrusted origin", all.filter((m) => m.untrusted_origins.length > 0).length)}
            {chip("quarantined", "Quarantined", all.filter((m) => m.quarantined).length)}
          </div>
        </div>
        <p className="muted">
          An <em>untrusted origin</em> means the entry descends from an untrusted source without passing the sanitizer.
          The data comes from the q8 inventory.
        </p>
        {memory.error && <div className="notice notice-hold" role="alert"><Icon name="alert" /> {memory.error}</div>}
        {error && <div className="notice notice-hold" role="alert"><Icon name="alert" /> {error}</div>}
        {notice && <div className="notice notice-allow" role="status"><Icon name="check" /> {notice}</div>}

        {memory.data !== null && all.length === 0 ? (
          <div className="empty">
            <p><strong>No memory entries yet.</strong></p>
            <p className="muted">Run a scenario on the Run tab first.</p>
            <button type="button" className="btn btn-solid" onClick={() => go("run")}>Go to Run</button>
          </div>
        ) : (
          <div className="scroll">
            <table className="table-cards">
              <caption className="sr-only">Team memory entries</caption>
              <thead>
                <tr><th>entry</th><th>key</th><th>kind</th><th>written by</th><th>day</th><th>untrusted origins</th><th>state</th><th><span className="sr-only">actions</span></th></tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.memory_id}>
                    <td data-label="entry"><code>{m.memory_id}</code></td>
                    <td data-label="key"><strong>{m.key}</strong></td>
                    <td data-label="kind">{m.kind}</td>
                    <td data-label="written by"><span className="agent-tag">{m.written_by}</span></td>
                    <td data-label="day">{m.written_on}</td>
                    <td data-label="untrusted origins">
                      {m.untrusted_origins.length === 0
                        ? <span className="muted">none</span>
                        : m.untrusted_origins.map((o) => <Chip key={o} tone="untrusted" icon="source"><code>{o}</code></Chip>)}
                    </td>
                    <td data-label="state">
                      {m.quarantined ? <Chip tone="quarantine" icon="lock">QUARANTINED</Chip> : <Chip tone="allow" icon="check">active</Chip>}
                    </td>
                    <td>
                      {m.quarantined && (
                        <button
                          type="button"
                          className="btn btn-danger"
                          disabled={m.quarantine_id === null || busy !== null}
                          title={m.quarantine_id === null ? "the quarantine id is unknown (the API was restarted); run forensics again" : undefined}
                          onClick={() => setPending(m)}
                        >
                          Release quarantine
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && all.length > 0 && <p className="muted">No entries match this filter.</p>}
          </div>
        )}
      </div>

      <Dialog
        open={pending !== null}
        title={`Release quarantine ${pending?.quarantine_id ?? ""}?`}
        onClose={() => setPending(null)}
        actions={
          <>
            <button type="button" className="btn" data-autofocus onClick={() => setPending(null)}>Cancel</button>
            <button type="button" className="btn btn-danger-solid" onClick={() => pending && void release(pending)}>Release</button>
          </>
        }
      >
        <p>Every artifact it covers becomes usable again, so the gate stops blocking on the quarantine (its other checks still apply). This changes the demo state.</p>
        <p className="muted">{covered} entr{covered === 1 ? "y" : "ies"} in this list {covered === 1 ? "is" : "are"} covered by this quarantine.</p>
        <p className="muted">This is a risk-increasing action, so it needs a person.</p>
      </Dialog>
    </section>
  );
}
