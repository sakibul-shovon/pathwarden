import type cytoscape from "cytoscape";
import { prefersReducedMotion } from "../../shared/lib/motion";

/** Canvas motion (ui-redesign.md §17.4): zoom and fit glide over 200 ms with the movement curve, new nodes fade in while time travel steps
 *  by hand, and under reduced motion every one of them is instant. Only a handful of elements move at once (§17.5). */

export const ZOOM_MS = 200;
/** The closest of Cytoscape's named easings to the movement curve of the tokens (`--ease-move`, cubic-bezier(0.4, 0, 0.2, 1)): its typings accept names only. */
export const MOVE_EASING = "ease-in-out";

export function zoomTo(cy: cytoscape.Core, level: number, at: cytoscape.Position, reduced = prefersReducedMotion()): void {
  if (reduced) cy.zoom({ level, renderedPosition: at });
  else cy.animate({ zoom: { level, renderedPosition: at }, duration: ZOOM_MS, easing: MOVE_EASING });
}

export function fitView(cy: cytoscape.Core, padding: number, reduced = prefersReducedMotion()): void {
  if (reduced) cy.fit(undefined, padding);
  else cy.animate({ fit: { eles: cy.elements(), padding }, duration: ZOOM_MS, easing: MOVE_EASING });
}

/** Fade the given elements in over `ms`. The inline opacity is dropped afterwards so the dim and hide classes keep control. No-op for no
 *  elements, no time, or reduced motion. */
export function fadeIn(eles: cytoscape.Collection, ms: number, reduced = prefersReducedMotion()): void {
  if (reduced || !(ms > 0) || eles.empty()) return;
  eles.style("opacity", 0);
  eles.animate({ style: { opacity: 1 } }, { duration: ms, complete: () => eles.removeStyle("opacity") });
}

/** The ids that are in `now` and were not in `before`: the nodes a time-travel step adds. `null` before means a first frame: nothing is new. */
export function newIds(before: Set<string> | null, now: string[]): string[] {
  return before === null ? [] : now.filter((id) => !before.has(id));
}
