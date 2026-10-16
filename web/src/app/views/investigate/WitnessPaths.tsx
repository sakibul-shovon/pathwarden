import type { ReactNode } from "react";
import { CodeBlock } from "../../../shared/components/CodeBlock";
import { Icon } from "../../../shared/icons/Icon";
import { revealedSteps, useTraceFrame } from "../../../shared/lib/motion";
import { stepCount, type PathStep } from "./caseLogic";

interface WitnessPathsProps {
  untrusted: PathStep[];
  secret: PathStep[];
  /** The exact text of the two gate queries, as the API returns it. */
  queries: Record<string, string>;
  /** A chip is hovered or focused (the graph dims what is unrelated) or left (`null`). */
  onHover?: (id: string | null) => void;
  /** A chip is activated: the node drawer opens. */
  onOpen?: (id: string) => void;
  /** Play the witness trace once for each new value: the chips appear in order from the payload to the source, both rails together. */
  trace?: string | null;
  /** Hold the trace on its first step until this is true (the landing page waits until the figure is half visible). */
  traceReady?: boolean;
  /** Name each rail with a heading (the case file) or only with a label (a captioned figure, which may appear more than once on a page). */
  headings?: boolean;
}

const Q_UNTRUSTED = "q2a_untrusted_witness";
const Q_SECRET = "q2b_secret_witness";

interface RailProps {
  kind: "untrusted" | "secret";
  steps: PathStep[];
  query: string | undefined;
  queryName: string;
  onHover?: (id: string | null) => void;
  onOpen?: (id: string) => void;
  /** How many steps are shown: all of them unless a trace is playing. */
  revealed: number;
  headings: boolean;
}

const chip = (s: PathStep) => (
  <>
    <span className="pw-step__label">
      {s.isSource && <Icon name="diamond" size={14} />} {s.label}
    </span>
    {s.label !== s.id && <code className="pw-step__id">{s.id}</code>}
    {s.tags.length > 0 && <span className="pw-step__tags">{s.tags.join(" · ")}</span>}
  </>
);

const Wrap = ({ className, title, headings, children }: { className: string; title: string; headings: boolean; children: ReactNode }) =>
  headings ? (
    <section className={className} aria-label={title}>
      {children}
    </section>
  ) : (
    <div className={className} role="group" aria-label={title}>
      {children}
    </div>
  );

const Head = ({ headings, children }: { headings: boolean; children: ReactNode }) =>
  headings ? <h3 className="pw-path__head">{children}</h3> : <p className="pw-path__head">{children}</p>;

function Rail({ kind, steps, query, queryName, onHover, onOpen, revealed, headings }: RailProps) {
  // a chip is a button only when something happens on hover or activation (the landing page's plate is a static figure)
  const interactive = Boolean(onHover || onOpen);
  const n = stepCount(steps.map((s) => s.id));
  const title = kind === "untrusted" ? "Untrusted path" : "Secret path";
  return (
    <Wrap className={`pw-path pw-path--${kind}`} title={title} headings={headings}>
      <Head headings={headings}>
        <span className="pw-path__glyph" aria-hidden="true" />
        {title}
        <span className="pw-path__meta">
          {steps.length === 0 ? "none" : `${n} ${n === 1 ? "step" : "steps"}`} · computed by <code>{queryName}</code>
        </span>
      </Head>
      {steps.length === 0 ? (
        <p className="pw-muted">No {kind} path: the gate found none for this payload.</p>
      ) : (
        <ol className="pw-path__steps">
          {steps.map((s, i) => (
            <li key={s.id} className={[s.isSource ? "pw-step pw-step--source" : "pw-step", i >= revealed ? "pw-step--pending" : ""].filter(Boolean).join(" ")}>
              {interactive ? (
                <button
                  type="button"
                  className="pw-step__btn"
                  onClick={() => onOpen?.(s.id)}
                  onMouseEnter={() => onHover?.(s.id)}
                  onMouseLeave={() => onHover?.(null)}
                  onFocus={() => onHover?.(s.id)}
                  onBlur={() => onHover?.(null)}
                >
                  {chip(s)}
                </button>
              ) : (
                <span className="pw-step__btn pw-step__btn--static">{chip(s)}</span>
              )}
              {i < steps.length - 1 && <Icon name="arrow-right" size={14} className="pw-step__arrow" />}
            </li>
          ))}
        </ol>
      )}
      {query && (
        <details className="pw-path__query">
          <summary>Show the query (read-only: exactly what the gate runs)</summary>
          <CodeBlock code={query} label={queryName} />
          <p className="pw-muted">Paste it into the FalkorDB Browser with the parameters of this action to run it yourself.</p>
        </details>
      )}
    </Wrap>
  );
}

/** The signature component: the two proofs of a hold, each an ordered list from the payload to its source, named by the
 *  key people know (`team_convention:42`) with the id after it. Solid line = untrusted, dotted = secret (also in text). */
export function WitnessPaths({ untrusted, secret, queries, onHover, onOpen, trace = null, traceReady = true, headings = true }: WitnessPathsProps) {
  const frame = useTraceFrame(trace, Math.max(untrusted.length, secret.length), traceReady);
  return (
    <div className="pw-paths">
      <Rail kind="untrusted" steps={untrusted} query={queries[Q_UNTRUSTED]} queryName={Q_UNTRUSTED} onHover={onHover} onOpen={onOpen} revealed={revealedSteps(frame, untrusted.length)} headings={headings} />
      <Rail kind="secret" steps={secret} query={queries[Q_SECRET]} queryName={Q_SECRET} onHover={onHover} onOpen={onOpen} revealed={revealedSteps(frame, secret.length)} headings={headings} />
    </div>
  );
}
