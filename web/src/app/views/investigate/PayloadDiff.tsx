import { isLeakLine } from "../run/runLogic";
import { diffLines, type DiffLine } from "./caseLogic";

export interface DiffSide {
  id: string;
  /** The content, or the reason it could not be fetched (the other side is still shown). */
  content: string | null;
  error: string | null;
}

const GUTTER: Record<DiffLine["mark"], { sign: string; word: string }> = {
  same: { sign: " ", word: "" },
  removed: { sign: "−", word: "removed: " },
  added: { sign: "+", word: "added: " },
};

function Side({ title, side, lines }: { title: string; side: DiffSide; lines: DiffLine[] | null }) {
  return (
    <div className="pw-diff__side">
      <h3 className="pw-diff__title">
        {title} <code>{side.id}</code>
      </h3>
      {lines === null ? (
        <p className="pw-diff__error">Could not load this payload: {side.error ?? "unknown error"}</p>
      ) : (
        <pre className="pw-diff__body">
          {lines.map((l, i) => (
            <span key={i} className={`pw-diff__line pw-diff__line--${l.mark}`}>
              <span className="pw-diff__gutter" aria-hidden="true">
                {GUTTER[l.mark].sign}
              </span>
              <span className="pw-visually-hidden">{GUTTER[l.mark].word}</span>
              {l.text}
              {l.mark === "removed" && isLeakLine(l.text) && <span className="pw-release__flag">secret value</span>}
              {"\n"}
            </span>
          ))}
        </pre>
      )}
    </div>
  );
}

/** Held (main graph) next to healed (sandbox graph). Lines present on one side only carry a − or + in a gutter, so the
 *  difference never depends on colour. The content is shown only here: the gate and the Forensic Agent never read it. */
export function PayloadDiff({ held, healed }: { held: DiffSide; healed: DiffSide }) {
  const d = held.content !== null && healed.content !== null ? diffLines(held.content, healed.content) : null;
  const plain = (c: string | null): DiffLine[] | null => (c === null ? null : c.split("\n").map((text) => ({ text, mark: "same" as const })));
  return (
    <div className="pw-diff">
      <Side title="Held — main graph" side={held} lines={d ? d.held : plain(held.content)} />
      <Side title="Healed — sandbox graph" side={healed} lines={d ? d.healed : plain(healed.content)} />
    </div>
  );
}
