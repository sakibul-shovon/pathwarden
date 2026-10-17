import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import type { SessionView, TimelineRow } from "../api/types";
import { gsap, reducedMotion } from "../gsap";
import { RuleOfTwoBadge } from "../components/RuleOfTwo";
import { Chip } from "../ui/Chip";

export type PipelineOutcome = "held" | "leaked" | "posted" | null;
type AgentId = "triage" | "fixer" | "release";

interface Edge {
  id: string;
  d: string;
}

// One drawing of the demo pipeline (Triage -> team memory -> Fixer -> draft -> Release -> gate -> public page).
const EDGES: Edge[] = [
  { id: "issue-triage", d: "M92 90 H150" },
  { id: "triage-memory", d: "M270 90 H345" },
  { id: "memory-fixer", d: "M400 116 V234" },
  { id: "env-fixer", d: "M92 260 H340" },
  { id: "fixer-draft", d: "M460 260 Q580 260 580 199" },
  { id: "draft-release", d: "M604 175 H670" },
  { id: "release-gate", d: "M790 175 H846" },
  { id: "gate-page", d: "M858 175 H905" },
];

interface Hop {
  edge: string;
  tone: "untrusted" | "secret" | "plain";
}

/** Which edge a recorded event travels along (presentation only; nothing here decides a verdict). */
function hopFor(row: TimelineRow, outcome: PipelineOutcome): Hop | null {
  const source = row.detail.split(" -> ")[0] ?? "";
  switch (row.op) {
    case "read_source":
      if (source.startsWith("src:issue")) return { edge: "issue-triage", tone: "untrusted" };
      if (source.startsWith("src:env")) return { edge: "env-fixer", tone: "secret" };
      return null;
    case "write":
      if (row.agent === "triage") return { edge: "triage-memory", tone: "plain" };
      if (row.agent === "fixer") return { edge: "fixer-draft", tone: "plain" };
      return null;
    case "load":
      if (row.agent === "fixer") return { edge: "memory-fixer", tone: "plain" };
      if (row.agent === "release") return { edge: "draft-release", tone: "plain" };
      return null;
    case "propose":
      return { edge: "release-gate", tone: "plain" };
    case "gate":
      return outcome === "posted" || outcome === "leaked" ? { edge: "gate-page", tone: "plain" } : null;
    default:
      return null;
  }
}

export function agentState(agent: AgentId, rows: TimelineRow[], step: number, playing: boolean, outcome: PipelineOutcome): { label: string; tone: "idle" | "working" | "done" | "held" } {
  const seen = rows.slice(0, step);
  const mine = seen.filter((r) => r.agent === agent);
  if (mine.length === 0) return { label: "Waiting", tone: "idle" };
  const last = seen[seen.length - 1];
  if (playing && last?.agent === agent) return { label: "Working", tone: "working" };
  const finished = step >= rows.length;
  if (agent === "release" && finished && outcome === "held") return { label: "Held at the gate", tone: "held" };
  return { label: "Done", tone: "done" };
}

const AGENTS: { id: AgentId; title: string; role: string }[] = [
  { id: "triage", title: "Triage", role: "Reads public issues, records structured tasks and team memory" },
  { id: "fixer", title: "Fixer", role: "Reads tasks, team conventions and deploy config; writes the changelog draft" },
  { id: "release", title: "Release", role: "Reads the changelog draft and publishes the release notes" },
];

export function AgentPipeline({
  rows,
  sessions,
  step,
  playing,
  outcome,
  issue,
}: {
  rows: TimelineRow[];
  sessions: SessionView[];
  step: number;
  playing: boolean;
  outcome: PipelineOutcome;
  issue: string;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const previous = useRef(0);
  const total = rows.length;

  // a packet travels along the edge of the event that was just revealed (GSAP + MotionPath)
  useGSAP(
    () => {
      const prev = previous.current;
      previous.current = step;
      if (!svg.current || reducedMotion() || step === 0 || step !== prev + 1) return;
      const row = rows[step - 1];
      if (!row) return;
      const hop = hopFor(row, outcome);
      if (hop) {
        const path = svg.current.querySelector<SVGPathElement>(`#edge-${hop.edge}`);
        const layer = svg.current.querySelector<SVGGElement>("#packets");
        if (path && layer) {
          const packet = document.createElementNS("http://www.w3.org/2000/svg", "circle");
          packet.setAttribute("r", "7");
          packet.setAttribute("class", `packet packet-${hop.tone}`);
          layer.appendChild(packet);
          gsap.to(packet, {
            motionPath: { path, align: path, alignOrigin: [0.5, 0.5] },
            duration: 0.55,
            ease: "power1.inOut",
            onComplete: () => packet.remove(),
          });
          gsap.fromTo(path, { strokeWidth: 5 }, { strokeWidth: 2, duration: 0.8, ease: "power2.out" });
        }
      }
      if (row.op === "gate") {
        gsap.fromTo("#pl-gate", { scaleY: 1 }, { scaleY: 1.25, yoyo: true, repeat: 3, duration: 0.12, transformOrigin: "50% 50%" });
        if (svg.current.querySelector("#pl-verdict")) {
          gsap.fromTo("#pl-verdict", { scale: 0.2, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: "back.out(2.2)", transformOrigin: "50% 50%" });
        }
      }
    },
    { dependencies: [step], scope: svg },
  );

  const gateReached = rows.slice(0, step).some((r) => r.op === "gate");
  const lastRow = step > 0 ? rows[step - 1] : undefined;
  const working = playing ? lastRow?.agent : undefined;
  const sourceName = issue ? `Issue #${issue}` : "Issue";

  return (
    <div className="pipeline">
      <div className="pipeline-scroll">
      <svg ref={svg} viewBox="0 40 1000 300" className="pipeline-svg" role="img" aria-label="The agent pipeline: Triage reads a public issue and writes team memory, Fixer reads memory and the deploy environment and writes a changelog draft, Release proposes publishing it, and the gate decides.">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10z" className="arrow" />
          </marker>
        </defs>
        {EDGES.map((e) => (
          <path key={e.id} id={`edge-${e.id}`} d={e.d} className="edge" markerEnd="url(#arrow)" />
        ))}

        {/* sources */}
        <g>
          <path d="M60 60 L90 90 L60 120 L30 90Z" className="node-src node-u" />
          <text x="60" y="95" textAnchor="middle" className="svg-b">U</text>
          <text x="60" y="142" textAnchor="middle" className="svg-s">{sourceName}</text>
          <path d="M60 230 L90 260 L60 290 L30 260Z" className="node-src node-s" />
          <text x="60" y="265" textAnchor="middle" className="svg-b">S</text>
          <text x="60" y="312" textAnchor="middle" className="svg-s">.env file</text>
        </g>

        {/* agents */}
        {[
          { id: "triage", x: 150, y: 64, w: 120, label: "Triage" },
          { id: "fixer", x: 340, y: 234, w: 120, label: "Fixer" },
          { id: "release", x: 670, y: 149, w: 120, label: "Release" },
        ].map((a) => (
          <g key={a.id} className={`node-agent${working === a.id ? " is-working" : ""}${rows.slice(0, step).some((r) => r.agent === a.id) ? " is-seen" : ""}`}>
            <rect x={a.x} y={a.y} width={a.w} height="52" rx="10" />
            <text x={a.x + a.w / 2} y={a.y + 31} textAnchor="middle" className="svg-b">{a.label}</text>
          </g>
        ))}

        <g className="node-store">
          <rect x="345" y="64" width="110" height="52" rx="10" />
          <text x="400" y="95" textAnchor="middle" className="svg-b">Team memory</text>
        </g>
        <g className="node-draft">
          <circle cx="580" cy="175" r="24" />
          <text x="580" y="181" textAnchor="middle" className="svg-b">Draft</text>
        </g>

        {/* gate and page */}
        <g id="pl-gate" className={`node-gate${gateReached ? (outcome === "held" ? " gate-held" : " gate-open") : ""}`}>
          <rect x="846" y="135" width="12" height="80" rx="4" />
        </g>
        <text x="852" y="236" textAnchor="middle" className="svg-s">Gate</text>
        {gateReached && outcome === "held" && (
          <g id="pl-verdict">
            <path d="M840 92 h24 l14 14 v22 l-14 14 h-24 l-14 -14 v-22z" className="octa" />
            <text x="852" y="123" textAnchor="middle" className="svg-inv">HOLD</text>
          </g>
        )}
        <g className={`node-page${gateReached && outcome === "leaked" ? " page-leak" : ""}`}>
          <rect x="905" y="130" width="80" height="90" rx="8" />
          <rect x="914" y="142" width="62" height="6" rx="3" className="skel" />
          <rect x="914" y="156" width="46" height="6" rx="3" className="skel" />
          {gateReached && outcome === "leaked" && <rect x="914" y="172" width="62" height="9" rx="3" className="leak-bar" />}
          {gateReached && outcome === "leaked" && <rect x="914" y="186" width="50" height="9" rx="3" className="leak-bar" />}
        </g>
        <text x="945" y="240" textAnchor="middle" className="svg-s">Public page</text>

        <g id="packets" />
      </svg>
      </div>

      <ul className="pipeline-legend" aria-label="Legend">
        <li><span className="dot dot-untrusted" /> data from an untrusted source</li>
        <li><span className="dot dot-secret" /> data from a secret source</li>
        <li><span className="dot dot-plain" /> data an agent wrote or loaded</li>
      </ul>

      <div className="agent-cards">
        {AGENTS.map((agent) => {
          const state = agentState(agent.id, rows, step, playing, outcome);
          const mine = sessions.filter((s) => s.agent === agent.id);
          return (
            <section key={agent.id} className={`agent-card agent-${state.tone}`} aria-label={agent.title}>
              <div className="agent-card-head">
                <h3>{agent.title}</h3>
                <Chip tone={state.tone === "held" ? "hold" : state.tone === "done" ? "allow" : state.tone === "working" ? "ink" : "muted"} icon={state.tone === "held" ? "hold" : state.tone === "done" ? "check" : state.tone === "working" ? "bolt" : "clock"}>
                  {state.label}
                </Chip>
              </div>
              <p className="muted">{agent.role}</p>
              <ul className="sessions">
                {mine.map((s) => (
                  <li key={s.id}>
                    <code>{s.id}</code> <span className="muted">{s.day}</span> <RuleOfTwoBadge data={s.rule_of_two} />
                  </li>
                ))}
                {mine.length === 0 && <li className="muted">No session in this run</li>}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="sr-only" role="status">{playing ? `Replaying event ${step} of ${total}` : ""}</p>
    </div>
  );
}
