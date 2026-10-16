import { CodeBlock } from "../../shared/components/CodeBlock";
import { mcpRefusal, type Plate } from "../landingLogic";
import { Section } from "./Section";

const HOPS = [
  { name: "MCP client", note: "an agent, unchanged" },
  { name: "Pathwarden gateway", note: "one process per agent; runs the gate" },
  { name: "Upstream MCP servers", note: "called only when the gate allows" },
] as const;

/** Fit: the same gate in front of real MCP tool calls. The quoted message is built from the recorded action with the format of `api/mcp/gateway.py`. */
export function Mcp({ plate }: { plate: Plate }) {
  return (
    <Section
      id="mcp"
      eyebrow="Works with MCP clients"
      title="The same gate in front of MCP tools"
      lead={<p>The gateway sits between a client and its upstream servers. A held call returns a tool error, and the upstream tool is never called.</p>}
    >
      <ol className="pw-hops" aria-label="Path of a tool call">
        {HOPS.map((h, i) => (
          <li key={h.name}>
            <strong>{h.name}</strong>
            <span className="pw-muted">{h.note}</span>
            {i < HOPS.length - 1 && <span className="pw-hops__arrow" aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
      <figure className="pw-fig">
        <CodeBlock code={mcpRefusal(plate)} label="the tool error" />
        <figcaption className="pw-fig__caption">
          The tool error a held call returns, in the format of <code>api/mcp/gateway.py</code>, filled in with the recorded action. <code>make demo-mcp</code> runs this end to end; the demo clients are
          scripted.
        </figcaption>
      </figure>
    </Section>
  );
}
