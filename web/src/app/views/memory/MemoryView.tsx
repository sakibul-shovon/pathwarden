import { useCallback, useMemo, useState } from "react";
import { api } from "../../../api/client";
import type { MemoryEntry } from "../../../api/types";
import { usePoll } from "../../../hooks";
import { Button } from "../../../shared/components/Button";
import { Dialog } from "../../../shared/components/Dialog";
import { EmptyState } from "../../../shared/components/EmptyState";
import { ErrorPanel } from "../../../shared/components/ErrorPanel";
import { Notice } from "../../../shared/components/Notice";
import { SegmentedControl } from "../../../shared/components/SegmentedControl";
import { Term } from "../../../shared/components/Term";
import { Skeleton } from "../../../shared/components/Skeleton";
import { describeError } from "../../errorCatalogue";
import { NodeDrawer } from "../../graph/NodeDrawer";
import type { TabId } from "../../url";
import { Ledger } from "./Ledger";
import { FILTER_LABEL, filterCounts, filterEntries, memoryNode, releaseSuccess, sharedQuarantine, type MemoryFilter } from "./memoryLogic";
import "./memory.css";

const NONE: never[] = [];

/** Memory hygiene (ui-redesign.md §13.6): who wrote each team-memory entry, from which untrusted origin, and whether it is
 *  quarantined. Releasing a quarantine puts risk back, so it is a deliberate act behind a review dialog. */
export function MemoryView({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const memory = usePoll(api.memory, 3000);
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const [opened, setOpened] = useState<MemoryEntry | null>(null);
  const [releasing, setReleasing] = useState<MemoryEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const entries = memory.data;
  const counts = useMemo(() => filterCounts(entries ?? []), [entries]);
  const shown = useMemo(() => filterEntries(entries ?? [], filter), [entries, filter]);
  const drawerNode = useMemo(() => (opened ? memoryNode(opened) : null), [opened]);
  const drawerNodes = useMemo(() => (drawerNode ? [drawerNode] : NONE), [drawerNode]);
  const loadContent = useCallback((id: string) => api.artifact(id, "main").then((a) => a.content), []);
  const closeDrawer = useCallback(() => setOpened(null), []);

  const release = async (entry: MemoryEntry): Promise<void> => {
    if (entry.quarantine_id === null) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      setSuccess(releaseSuccess(await api.releaseQuarantine(entry.quarantine_id)));
      memory.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
      setReleasing(null);
    }
  };

  const failure = error ? describeError(error) : null;
  const sealedTogether = releasing?.quarantine_id ? sharedQuarantine(entries ?? [], releasing.quarantine_id) : [];

  return (
    <div className="pw-memory">
      <p className="pw-muted pw-prose">
        Every entry written to shared team memory. An <em>untrusted origin</em> means the entry descends from an untrusted source without passing the
        <Term term="sanitized">sanitizer</Term>; the list comes from the q8 inventory, not from reading the text.
      </p>

      {memory.error && entries === null && <ErrorPanel title="Could not load team memory" code="load_error">{memory.error}</ErrorPanel>}
      {failure && (
        <ErrorPanel title={failure.title} code={failure.code}>
          {failure.hint && <p>{failure.hint}</p>}
          {failure.detail && <p className="pw-muted">{failure.detail}</p>}
        </ErrorPanel>
      )}
      {success && <Notice variant="info">{success}</Notice>}

      {entries === null && !memory.error && <Skeleton lines={5} height={36} />}

      {entries !== null && entries.length === 0 && (
        <EmptyState action={<Button variant="primary" onClick={() => onNavigate("run")}>Open Run</Button>}>
          No team-memory entries yet. Run a scenario: Triage writes to team memory.
        </EmptyState>
      )}

      {entries !== null && entries.length > 0 && (
        <>
          <SegmentedControl
            legend="Show"
            value={filter}
            onChange={setFilter}
            options={(Object.keys(FILTER_LABEL) as MemoryFilter[]).map((f) => ({ value: f, label: `${FILTER_LABEL[f]} (${counts[f]})` }))}
          />
          <p className="pw-muted" role="status">
            {shown.length} of {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </p>
          {shown.length === 0 ? (
            <EmptyState>No entry matches this filter.</EmptyState>
          ) : (
            <Ledger entries={shown} busy={busy} onOpen={setOpened} onRelease={setReleasing} />
          )}
        </>
      )}

      <NodeDrawer
        node={drawerNode}
        nodes={drawerNodes}
        edges={NONE}
        untrustedWitness={NONE}
        secretWitness={NONE}
        showEdges={false}
        loadContent={loadContent}
        onClose={closeDrawer}
        onOpenNode={() => undefined}
      />

      <Dialog
        open={releasing !== null}
        onClose={() => setReleasing(null)}
        title={releasing?.quarantine_id ? `Release quarantine ${releasing.quarantine_id}?` : "Release quarantine?"}
        actions={
          <>
            <Button data-autofocus onClick={() => setReleasing(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" pending={busy} onClick={() => releasing && void release(releasing)}>
              {busy ? "Releasing…" : `Release quarantine ${releasing?.quarantine_id ?? ""}`}
            </Button>
          </>
        }
      >
        {releasing && (
          <dl className="pw-review">
            <div>
              <dt>What will happen</dt>
              <dd>
                Every artifact this quarantine covers becomes usable again, so the gate stops blocking on the quarantine. Its other checks (the untrusted-and-secret
                check, missing provenance, unknown sinks) still apply.
              </dd>
            </div>
            <div>
              <dt>What changes</dt>
              <dd>
                {sealedTogether.length > 0
                  ? `The team-memory entries sealed together in this ledger: ${sealedTogether.map((e) => e.key).join(", ")}. Artifacts outside the ledger that the quarantine covers are restored too.`
                  : "The artifacts the quarantine covers."}{" "}
                This changes the state of the demo workspace.
              </dd>
            </div>
            <div>
              <dt>Who</dt>
              <dd>
                Recorded as a human action: the request is sent with the header <code>X-PW-Human: true</code>.
              </dd>
            </div>
          </dl>
        )}
      </Dialog>
    </div>
  );
}
