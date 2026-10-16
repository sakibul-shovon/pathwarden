import { useCallback, useState } from "react";
import type { LineageEdge, LineageNode } from "../../api/types";
import { Dialog } from "../../shared/components/Dialog";
import { IdChip } from "../../shared/components/IdChip";
import { StatusPill } from "../../shared/components/StatusPill";
import { isLeakLine } from "../views/run/runLogic";
import { describeError } from "../errorCatalogue";
import { incidentEdges, relationMeaning } from "./graphModel";

interface NodeDrawerProps {
  /** The node to show; `null` keeps the drawer closed. */
  node: LineageNode | null;
  nodes: LineageNode[];
  edges: LineageEdge[];
  untrustedWitness: string[];
  secretWitness: string[];
  /** Fetches the artifact's content. It is called only when the person opens "Show content" (the gate never reads content). */
  loadContent: (id: string) => Promise<string>;
  /** Show the edges and what they mean. Off where the caller has the node but not its edges (the memory ledger). */
  showEdges?: boolean;
  onClose: () => void;
  onOpenNode: (id: string) => void;
}

const nameOf = (nodes: LineageNode[], id: string): string => {
  const n = nodes.find((x) => x.id === id);
  return n && n.label !== "Source" ? n.key || n.kind || id : id;
};

type Content = { state: "idle" } | { state: "loading" } | { state: "ready"; text: string } | { state: "error"; message: string };

/** "Show content": the request is made on the first opening, never before. Lines that match the display leak check are labelled. */
function ContentDisclosure({ id, loadContent }: { id: string; loadContent: (id: string) => Promise<string> }) {
  const [content, setContent] = useState<Content>({ state: "idle" });
  const onToggle = useCallback(
    (event: React.SyntheticEvent<HTMLDetailsElement>) => {
      if (!event.currentTarget.open || content.state !== "idle") return;
      setContent({ state: "loading" });
      loadContent(id).then(
        (text) => setContent({ state: "ready", text }),
        (err: unknown) => setContent({ state: "error", message: describeError(err).title }),
      );
    },
    [content.state, id, loadContent],
  );
  return (
    <details className="pw-drawer__content" onToggle={onToggle}>
      <summary>Show content</summary>
      <p className="pw-muted">The text of this artifact. It is shown here only: the gate and the Forensic Agent never read it.</p>
      {content.state === "loading" && <p role="status">Loading…</p>}
      {content.state === "error" && <p role="alert">Could not load the content: {content.message}</p>}
      {content.state === "ready" && (
        <pre className="pw-drawer__pre">
          {content.text.split("\n").map((line, i) => (
            <span key={i} className={isLeakLine(line) ? "pw-release__line--leak" : undefined}>
              {line}
              {isLeakLine(line) && <span className="pw-release__flag">secret value</span>}
              {"\n"}
            </span>
          ))}
        </pre>
      )}
    </details>
  );
}

/** Everything the page knows about one node (ui-redesign.md §13.10): what it is, its flags, who wrote it and when, the
 *  relationships in and out in plain words, and its content on request. */
export function NodeDrawer({ node, nodes, edges, untrustedWitness, secretWitness, loadContent, showEdges = true, onClose, onOpenNode }: NodeDrawerProps) {
  const incident = node ? incidentEdges(node.id, edges) : { incoming: [], outgoing: [] };
  const rels = [...new Set([...incident.incoming, ...incident.outgoing].map((e) => e.rel))].sort();
  const isArtifact = node !== null && node.label !== "Source";
  const title = node ? (node.label === "Source" ? node.id : node.key || node.kind || node.id) : "";
  const neighbours = (list: LineageEdge[], side: "src" | "dst") => (
    <ul className="pw-drawer__edges">
      {list.map((e, i) => (
        <li key={i}>
          <code>{e.rel}</code>{" "}
          <button type="button" className="pw-gtable__open" onClick={() => onOpenNode(e[side])}>
            {nameOf(nodes, e[side])} <code>{e[side]}</code>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <Dialog open={node !== null} onClose={onClose} title={title} variant="drawer">
      {node && (
        <div className="pw-drawer">
          <p className="pw-drawer__id">
            <IdChip id={node.id} copyable />
          </p>
          <dl className="pw-facts">
            <div>
              <dt>Kind</dt>
              <dd>{node.label === "Source" ? "source" : `artifact${node.kind ? ` · ${node.kind}` : ""}`}</dd>
            </div>
            {node.trust && (
              <div>
                <dt>Trust</dt>
                <dd>{node.trust}</dd>
              </div>
            )}
            {(node.agent_id || node.session_id) && (
              <div>
                <dt>Written by</dt>
                <dd>
                  {[node.agent_id, node.session_id].filter(Boolean).join(" · ")}
                  {node.created_at !== null && ` · t=${node.created_at}`}
                </dd>
              </div>
            )}
          </dl>
          <p className="pw-drawer__flags">
            {node.sanitized && <StatusPill status="sanitized" family="neutral" />}
            {node.approved && <StatusPill status="approved" family="allow" />}
            {node.quarantined && <StatusPill status="quarantined" family="block" />}
            {untrustedWitness.includes(node.id) && <StatusPill status="on the untrusted path" family="hold" />}
            {secretWitness.includes(node.id) && <StatusPill status="on the secret path" family="hold" />}
          </p>

          {!showEdges && <p className="pw-muted">The edges of this entry are in the case file of an action that used it, and in Time travel.</p>}
          {showEdges && (
            <>
              <h3 className="pw-drawer__h">Made from</h3>
              {incident.outgoing.length === 0 ? <p className="pw-muted">Nothing: this is where the lineage ends.</p> : neighbours(incident.outgoing, "dst")}
              <h3 className="pw-drawer__h">Used to make</h3>
              {incident.incoming.length === 0 ? <p className="pw-muted">Nothing in this graph was made from it.</p> : neighbours(incident.incoming, "src")}
            </>
          )}

          {showEdges && rels.length > 0 && (
            <>
              <h3 className="pw-drawer__h">What the relationships mean</h3>
              <dl className="pw-drawer__glossary">
                {rels.map((r) => (
                  <div key={r}>
                    <dt>
                      <code>{r}</code>
                    </dt>
                    <dd>{relationMeaning(r)}</dd>
                  </div>
                ))}
              </dl>
              <p className="pw-muted">Edges point from the newer artifact to what it was made from.</p>
            </>
          )}

          {isArtifact && <ContentDisclosure key={node.id} id={node.id} loadContent={loadContent} />}
        </div>
      )}
    </Dialog>
  );
}
