import type { CapEdge, CapNode } from "../../../api/types";
import { Button } from "../../../shared/components/Button";
import { agentRows } from "./remediateLogic";
import { Scroll } from "../../../shared/components/Scroll";

interface CapabilityTableProps {
  nodes: CapNode[];
  edges: CapEdge[];
  selected: string | null;
  onSelect: (agent: string) => void;
}

/** The capability graph as two tables, so an agent can be chosen without the canvas. Toxicity is a word and a revoked flow says
 *  revoked. */
export function CapabilityTable({ nodes, edges, selected, onSelect }: CapabilityTableProps) {
  const rows = agentRows(nodes);
  return (
    <div className="pw-captables">
      <Scroll label="Nodes of the capability graph">
        <table className="pw-log__table">
          <caption className="pw-visually-hidden">Nodes of the capability graph</caption>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Kind</th>
              <th scope="col">Trust</th>
              <th scope="col">Sink</th>
              <th scope="col">Toxic</th>
              <th scope="col">
                <span className="pw-visually-hidden">Select</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name} aria-selected={r.name === selected || undefined}>
                <td>
                  <code>{r.name}</code>
                </td>
                <td>{r.kind}</td>
                <td>{r.trust}</td>
                <td>{r.external}</td>
                <td>{r.toxic && <strong>{r.toxic}</strong>}</td>
                <td>
                  {r.kind === "agent" && (
                    <Button size="sm" variant="quiet" aria-pressed={r.name === selected} onClick={() => onSelect(r.name)}>
                      Why?
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
      <Scroll label="Flows of the capability graph">
        <table className="pw-log__table">
          <caption className="pw-visually-hidden">Flows of the capability graph</caption>
          <thead>
            <tr>
              <th scope="col">From</th>
              <th scope="col">To</th>
              <th scope="col">Flow id</th>
              <th scope="col">Cost</th>
              <th scope="col">State</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((e) => (
              <tr key={e.cap_id}>
                <td>
                  <code>{e.src}</code>
                </td>
                <td>
                  <code>{e.dst}</code>
                </td>
                <td>
                  <code>{e.cap_id}</code>
                </td>
                <td>{e.cost}</td>
                <td>{e.revoked ? <strong>revoked</strong> : "active"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Scroll>
    </div>
  );
}
