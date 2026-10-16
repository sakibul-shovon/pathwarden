import { CodeBlock } from "../../../shared/components/CodeBlock";
import { Icon } from "../../../shared/icons/Icon";
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

function Rail({ kind, steps, query, queryName, onHover, onOpen }: RailProps) {
  // a chip is a button only when something happens on hover or activation (the landing page's plate is a static figure)
  const interactive = Boolean(onHover || onOpen);
  const n = stepCount(steps.map((s) => s.id));
  const title = kind === "untrusted" ? "Untrusted path" : "Secret path";
  return (
    <section className={`pw-path pw-path--${kind}`} aria-label={title}>
      <h3 className="pw-path__head">
        <span className="pw-path__glyph" aria-hidden="true" />
        {title}
        <span className="pw-path__meta">
          {steps.length === 0 ? "none" : `${n} ${n === 1 ? "step" : "steps"}`} · computed by <code>{queryName}</code>
        </span>
      </h3>
      {steps.length === 0 ? (
        <p className="pw-muted">No {kind} path: the gate found none for this payload.</p>
      ) : (
        <ol className="pw-path__steps">
          {steps.map((s, i) => (
            <li key={s.id} className={s.isSource ? "pw-step pw-step--source" : "pw-step"}>
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
    </section>
  );
}

/** The signature component: the two proofs of a hold, each an ordered list from the payload to its source, named by the
 *  key people know (`team_convention:42`) with the id after it. Solid line = untrusted, dotted = secret (also in text). */
export function WitnessPaths({ untrusted, secret, queries, onHover, onOpen }: WitnessPathsProps) {
  return (
    <div className="pw-paths">
      <Rail kind="untrusted" steps={untrusted} query={queries[Q_UNTRUSTED]} queryName={Q_UNTRUSTED} onHover={onHover} onOpen={onOpen} />
      <Rail kind="secret" steps={secret} query={queries[Q_SECRET]} queryName={Q_SECRET} onHover={onHover} onOpen={onOpen} />
    </div>
  );
}
