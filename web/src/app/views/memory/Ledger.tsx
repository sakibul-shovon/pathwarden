import type { MemoryEntry } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { Scroll } from "../../../shared/components/Scroll";
import { StatusPill } from "../../../shared/components/StatusPill";
import { Icon } from "../../../shared/icons/Icon";
import { releaseBlockedReason } from "./memoryLogic";

interface LedgerProps {
  entries: MemoryEntry[];
  /** A request is in flight: every action waits. */
  busy: boolean;
  onOpen: (entry: MemoryEntry) => void;
  onRelease: (entry: MemoryEntry) => void;
}

/** The team-memory ledger as a real table. On a phone the rows become stacked cards (each cell carries its own label), so
 *  nothing is hidden and nothing scrolls sideways. State is a word and an icon, never only a colour. */
export function Ledger({ entries, busy, onOpen, onRelease }: LedgerProps) {
  return (
    <Scroll label="Team memory ledger">
      <table className="pw-ledger">
      <caption className="pw-visually-hidden">Entries of shared team memory</caption>
      <thead>
        <tr>
          <th scope="col">Entry</th>
          <th scope="col">Kind</th>
          <th scope="col">Written by</th>
          <th scope="col">Untrusted origins</th>
          <th scope="col">State</th>
          <th scope="col">
            <span className="pw-visually-hidden">Action</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {entries.map((m) => {
          const blocked = releaseBlockedReason(m);
          return (
            <tr key={m.memory_id} className={m.quarantined ? "pw-ledger__row pw-ledger__row--sealed" : "pw-ledger__row"}>
              <td data-label="Entry">
                <button type="button" className="pw-ledger__open" onClick={() => onOpen(m)}>
                  <strong>{m.key}</strong> <code>{m.memory_id}</code>
                </button>
              </td>
              <td data-label="Kind">{m.kind}</td>
              <td data-label="Written by">
                {m.written_by}
                {m.written_on ? ` · ${m.written_on}` : ""}
              </td>
              <td data-label="Untrusted origins">
                {m.untrusted_origins.length === 0 ? (
                  <span className="pw-muted">none</span>
                ) : (
                  <span className="pw-ledger__origins">
                    {m.untrusted_origins.map((o) => (
                      <code key={o} className="pw-ledger__origin">
                        <Icon name="diamond" size={12} /> {o}
                      </code>
                    ))}
                  </span>
                )}
              </td>
              <td data-label="State">
                {m.quarantined ? (
                  <>
                    <span className="pw-status pw-status--block">
                      <Icon name="lock" size={14} />
                      <span>QUARANTINED</span>
                    </span>
                    {m.quarantine_id && <code className="pw-ledger__qid">{m.quarantine_id}</code>}
                  </>
                ) : (
                  <StatusPill status="ACTIVE" family="allow" />
                )}
              </td>
              <td data-label="Action">
                {m.quarantined && (
                  <div className="pw-ledger__action">
                    <Button variant="danger" size="sm" disabled={blocked !== null || busy} onClick={() => onRelease(m)}>
                      {m.quarantine_id ? `Release quarantine ${m.quarantine_id}…` : "Release quarantine…"}
                    </Button>
                    {blocked && <p className="pw-ledger__why">{blocked}</p>}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
    </Scroll>
  );
}
