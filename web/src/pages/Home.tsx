import { useGSAP } from "@gsap/react";
import { m, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import type { EvalSummary } from "../api/types";
import { gsap, reducedMotion } from "../gsap";
import { errorText } from "../hooks";
import { RouteDiagram } from "../home/RouteDiagram";
import { useNav } from "../nav";
import { ThemeMenu } from "../shell/AppShell";
import { ActorChip } from "../ui/Chip";
import { Icon } from "../ui/Icon";
import { IntervalPlot } from "../ui/IntervalPlot";
import { Mark } from "../ui/Mark";
import "./home.css";

const ATTACK_LINK = "?tab=run&scenario=attack_pipeline_42&guard=off&autorun=1";

const AGENTS = [
  { name: "Triage", role: "Reads public issues, writes team memory", on: [true, false, true] },
  { name: "Fixer", role: "Reads memory and .env, writes the draft", on: [false, true, true] },
  { name: "Release", role: "Publishes the release notes", on: [false, false, true] },
] as const;

function Lamps({ on }: { on: readonly boolean[] }) {
  const reduce = useReducedMotion();
  return (
    <span className="lamps">
      {["A", "B", "C"].map((letter, i) => (
        <m.span
          key={letter}
          className={on[i] ? "lamp on" : "lamp"}
          title={["A: reads untrusted input", "B: holds secrets", "C: acts outside"][i]}
          initial={reduce ? false : { scale: 0.7, opacity: 0.4 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.12, type: "spring", stiffness: 420, damping: 16 }}
        >
          {letter}
        </m.span>
      ))}
    </span>
  );
}

function Proof() {
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.evalSummary().then(setSummary).catch((err: unknown) => setError(errorText(err)));
  }, []);

  if (error) return <p className="muted">No results yet. Run <code>make eval</code> to generate them. <small>({error})</small></p>;
  if (!summary) return <p className="muted">Loading results…</p>;
  return (
    <>
      <p className="muted">
        {summary.dataset.scenarios} scenarios ({summary.dataset.attacks} attacks, {summary.dataset.benign} benign), seed {summary.dataset.seed}.
        Dot = rate, bar = 95% interval. Lower is better.
      </p>
      <div className="plots">
        <IntervalPlot title="Attacks released" pick={(d) => d.asr} defenses={summary.defenses} />
        <IntervalPlot title="Benign actions held" pick={(d) => d.fhr} defenses={summary.defenses} />
      </div>
    </>
  );
}

const STEPS = [
  { n: "1", title: "Hold", text: "A graph path check before every external action. No LLM in the gate.", tab: "investigate" },
  { n: "2", title: "Explain", text: "Two witness routes and the exact query the gate ran.", tab: "investigate" },
  { n: "3", title: "Heal", text: "Quarantine, replay in a sandbox, then a person approves.", tab: "investigate" },
  { n: "4", title: "Prevent", text: "Max-flow finds the cheapest permissions to revoke.", tab: "remediate" },
] as const;

const HEADLINE = ["Every agent passes.", "The system still leaks."];

export function Home() {
  const { go } = useNav();
  const [guard, setGuard] = useState(true);
  const page = useRef<HTMLDivElement>(null);

  // headline: each word rises out of a mask, once
  useGSAP(
    () => {
      if (reducedMotion()) return;
      gsap.from(".w-in", { yPercent: 115, duration: 0.7, ease: "power3.out", stagger: 0.07, delay: 0.1 });
      gsap.from(".reveal", { opacity: 0, y: 14, duration: 0.5, ease: "power2.out", stagger: 0.1, delay: 0.5 });
    },
    { scope: page },
  );

  return (
    <div className="home" ref={page}>
      <a className="skip" href="#home-main">Skip to content</a>
      <header className="h-top">
        <span className="brand"><Mark /> pathwarden</span>
        <span className="h-actions">
          <ThemeMenu />
          <button type="button" className="btn btn-solid" onClick={() => go("run")}>Open console</button>
        </span>
      </header>

      <main id="home-main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow reveal">Lineage gate for multi-agent systems</p>
            <h1 aria-label={HEADLINE.join(" ")}>
              {HEADLINE.map((line) => (
                <span key={line} className="h1-line" aria-hidden="true">
                  {line.split(" ").map((w, i) => (
                    <span key={`${w}-${i}`}><span className="w-mask"><span className="w-in">{w}</span></span>{" "}</span>
                  ))}
                </span>
              ))}
            </h1>
            <p className="lede reveal">
              Pathwarden traces every read and write across agents, memory and days,
              and holds the action when untrusted and secret data meet.
            </p>
            <div className="cta reveal">
              <a className="btn btn-solid btn-lg" href={ATTACK_LINK}><Icon name="play" /> Watch the attack</a>
              <button type="button" className="btn btn-lg" onClick={() => go("run")}>Open console</button>
            </div>
          </div>
          <div className="hero-fig reveal">
            <RouteDiagram guard={guard} />
            <div className="fig-bar">
              <span className="fig-cap">Illustration of <code>attack_pipeline_42</code></span>
              <button type="button" role="switch" aria-checked={guard} className="switch" onClick={() => setGuard(!guard)}>
                <span className="switch-knob" aria-hidden="true" />
                <span>Pathwarden {guard ? "on" : "off"}</span>
              </button>
            </div>
            <p className="fig-out" role="status">
              {guard ? "Held at the gate. Nothing is posted." : "Leaked. Secret values reach the public page."}
            </p>
          </div>
        </section>

        <section className="band">
          <h2>Two lamps each. Three on the path.</h2>
          <div className="h-agents">
            {AGENTS.map((a) => (
              <div className="h-agent" key={a.name}>
                <strong>{a.name}</strong>
                <Lamps on={a.on} />
                <span className="muted">{a.role}</span>
              </div>
            ))}
            <span className="eq" aria-hidden="true">=</span>
            <div className="h-agent h-agent-path">
              <strong>The path</strong>
              <Lamps on={[true, true, true]} />
              <span className="muted">Rule of Two checks sessions. Pathwarden checks lineage.</span>
            </div>
          </div>
          <p className="lamp-legend"><b>A</b> reads untrusted input · <b>B</b> holds secrets · <b>C</b> acts outside</p>
        </section>

        <section className="band">
          <h2>Agents act. People decide.</h2>
          <div className="who">
            <div className="who-col">
              <ActorChip who="auto" />
              <p>Hold an action, explain it, quarantine what it came from, replay the work in a sandbox. All of this reduces risk, so it can happen on its own.</p>
            </div>
            <div className="who-col who-human">
              <ActorChip who="human" />
              <p>Release a healed result, un-quarantine memory, apply a permission change. These increase risk, so a person confirms every one.</p>
            </div>
          </div>
        </section>

        <section className="band">
          <h2>From hold to fix</h2>
          <div className="steps">
            {STEPS.map((s) => (
              <button type="button" className="step-card" key={s.n} onClick={() => go(s.tab)}>
                <span className="step-n">{s.n}</span>
                <strong>{s.title}</strong>
                <span className="muted">{s.text}</span>
                <span className="step-go">Open →</span>
              </button>
            ))}
          </div>
        </section>

        <section className="band">
          <h2>Measured, not claimed</h2>
          <Proof />
          <button type="button" className="link-btn" onClick={() => go("evaluation")}>Read the full results and limitations →</button>
        </section>
      </main>

      <footer className="h-foot">
        <span>Works with any MCP client.</span>
        <code>make up &amp;&amp; make demo</code>
      </footer>
    </div>
  );
}
