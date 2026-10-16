import { Button } from "../shared/components/Button";
import { CodeBlock } from "../shared/components/CodeBlock";
import { ErrorPanel } from "../shared/components/ErrorPanel";
import type { HealthState } from "./useHealth";

/** Shown instead of a view when nothing can be loaded (ui-redesign.md §13.2): says what is down and how to fix it. */
export function Unreachable({ health, onRetry }: { health: Extract<HealthState, { status: "unreachable" | "db_down" | "error" }>; onRetry: () => void }) {
  const dbDown = health.status === "db_down";
  return (
    <div className="pw-unreachable">
      <ErrorPanel
        title={dbDown ? "FalkorDB is not answering" : "Can't reach the Pathwarden API"}
        code={dbDown ? "falkordb_unavailable" : health.status === "error" ? health.code : "unreachable"}
        recovery={<Button variant="primary" onClick={onRetry}>Retry</Button>}
      >
        {dbDown ? (
          <p>The API is running but the database is not. Start it, then retry.</p>
        ) : (
          <p>
            The browser got no usable answer from the API. Running locally, start the database and the API, then retry;
            on a hosted deployment the API is down.
          </p>
        )}
        <p className="pw-muted">{health.detail}</p>
      </ErrorPanel>
      <h2 className="pw-t-lg">Start it locally</h2>
      <CodeBlock label="start commands" code={dbDown ? "make up" : "make up\nmake api"} />
    </div>
  );
}
