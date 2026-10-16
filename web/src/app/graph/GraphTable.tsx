import { useId, useMemo, useState } from "react";
import type { LineageEdge, LineageNode } from "../../api/types";
import { Field } from "../../shared/components/Field";
import { Scroll } from "../../shared/components/Scroll";
import { edgeRows, filterRows, nodeRows, sortRows, type EdgeRow, type NodeRow, type SortDir } from "./graphModel";

interface GraphTableProps {
  nodes: LineageNode[];
  edges: LineageEdge[];
  untrustedWitness: string[];
  secretWitness: string[];
  onOpen: (id: string) => void;
  /** Called when a row's id is hovered or focused, so a canvas next to it can dim what is unrelated. */
  onHover?: (id: string | null) => void;
  /** 3 under a section heading (the case file), 2 straight under the view's title (Time travel). */
  headingLevel?: 2 | 3;
}

interface Column<T> {
  key: keyof T;
  title: string;
}

const NODE_COLUMNS: Column<NodeRow>[] = [
  { key: "id", title: "id" },
  { key: "label", title: "kind of node" },
  { key: "name", title: "key or kind" },
  { key: "trust", title: "trust" },
  { key: "flags", title: "flags" },
  { key: "agent", title: "agent" },
  { key: "session", title: "session" },
  { key: "t", title: "time" },
  { key: "witness", title: "on witness path" },
];

const EDGE_COLUMNS: Column<EdgeRow>[] = [
  { key: "from", title: "from" },
  { key: "rel", title: "relationship" },
  { key: "to", title: "to" },
  { key: "witness", title: "on witness path" },
];

interface SortState<T> {
  key: keyof T;
  dir: SortDir;
}

function SortableTable<T extends object>({ caption, columns, rows, openKeys, onOpen, onHover }: { caption: string; columns: Column<T>[]; rows: T[]; openKeys: (keyof T)[]; onOpen: (id: string) => void; onHover?: (id: string | null) => void }) {
  const [sort, setSort] = useState<SortState<T> | null>(null);
  const shown = useMemo(() => (sort ? sortRows(rows, sort.key, sort.dir) : rows), [rows, sort]);
  const toggle = (key: keyof T): void => setSort((s) => (s && s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  return (
    <Scroll label={caption}>
      <table className="pw-log__table pw-gtable">
        <caption className="pw-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => {
              const active = sort?.key === c.key;
              return (
                <th key={String(c.key)} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
                  <button type="button" className="pw-gtable__sort" onClick={() => toggle(c.key)}>
                    {c.title}
                    <span aria-hidden="true">{active ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}</span>
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => {
                const v = row[c.key];
                const text = v === null || v === undefined || v === "" ? "" : String(v);
                return (
                  <td key={String(c.key)}>
                    {openKeys.includes(c.key) && text !== "" ? (
                      <button type="button" className="pw-gtable__open" onClick={() => onOpen(text)} onMouseEnter={() => onHover?.(text)} onMouseLeave={() => onHover?.(null)} onFocus={() => onHover?.(text)} onBlur={() => onHover?.(null)}>
                        <code>{text}</code>
                      </button>
                    ) : c.key === "witness" && text !== "" ? (
                      <strong>{text}</strong>
                    ) : (
                      text
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Scroll>
  );
}

/** The graph as two tables, nodes and edges: sortable, filterable, and exactly the data the canvas draws. This is the primary
 *  accessible form of the graph (ui-redesign.md §15.8): a witness path is a word in a column, not only a colour on a line. */
export function GraphTable({ nodes, edges, untrustedWitness, secretWitness, onOpen, onHover, headingLevel = 3 }: GraphTableProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const filterId = useId();
  const [filter, setFilter] = useState("");
  const allNodes = useMemo(() => nodeRows(nodes, untrustedWitness, secretWitness), [nodes, untrustedWitness, secretWitness]);
  const allEdges = useMemo(() => edgeRows(edges, untrustedWitness, secretWitness), [edges, untrustedWitness, secretWitness]);
  const nodeShown = useMemo(() => filterRows(allNodes, filter), [allNodes, filter]);
  const edgeShown = useMemo(() => filterRows(allEdges, filter), [allEdges, filter]);
  return (
    <div className="pw-gtables">
      <Field id={filterId} label="Filter rows" hint="Matches any cell of both tables.">
        {(a11y) => <input {...a11y} type="search" className="pw-input" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      </Field>
      <p className="pw-muted" role="status">
        {nodeShown.length} of {allNodes.length} nodes · {edgeShown.length} of {allEdges.length} edges
      </p>
      <Heading className="pw-gtables__h">Nodes</Heading>
      <SortableTable caption="Nodes of the graph" columns={NODE_COLUMNS} rows={nodeShown} openKeys={["id"]} onOpen={onOpen} onHover={onHover} />
      <Heading className="pw-gtables__h">Edges</Heading>
      <SortableTable caption="Edges of the graph" columns={EDGE_COLUMNS} rows={edgeShown} openKeys={["from", "to"]} onOpen={onOpen} onHover={onHover} />
    </div>
  );
}
