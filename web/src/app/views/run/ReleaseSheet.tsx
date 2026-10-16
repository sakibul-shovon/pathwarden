import type { PostedEntry } from "../../../api/types";
import { Sheet } from "../../../shared/components/Sheet";
import { isLeakLine } from "./runLogic";

interface ReleaseSheetProps {
  posted: PostedEntry[];
  /** Mark the lines the display check matches (only when the run is a LEAK: a quoted example key is not one). */
  markLeaks: boolean;
  held: boolean;
}

/** The mock public release page: what an outsider would see. A marked line carries the words "secret value", not just a colour. */
export function ReleaseSheet({ posted, markLeaks, held }: ReleaseSheetProps) {
  return (
    <Sheet title="Public release page (mock)">
      {posted.length === 0 ? (
        <p className="pw-muted pw-run__empty">{held ? "Nothing has been posted: the gate held the release." : "Nothing has been posted."}</p>
      ) : (
        posted.map((entry) => (
          <pre key={entry.action_id} className="pw-release">
            {entry.content.split("\n").map((line, i) => {
              const leak = markLeaks && isLeakLine(line);
              return (
                <span key={i} className={leak ? "pw-release__line pw-release__line--leak" : "pw-release__line"}>
                  {line}
                  {leak && <span className="pw-release__flag">secret value</span>}
                  {"\n"}
                </span>
              );
            })}
          </pre>
        ))
      )}
    </Sheet>
  );
}
