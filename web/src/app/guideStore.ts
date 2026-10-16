import { useSyncExternalStore } from "react";
import { EMPTY_ONBOARDING, markDone, readOnboarding, writeOnboarding, type GuideStepId, type Onboarding } from "./guide";

/** The story-guide progress as a tiny shared store: the Run view completes the first steps, the other views complete
 *  theirs, and the guide panel (in Run) reads it. Persisted through `guide.ts`; works without storage. */
let state: Onboarding = readOnboarding();
const listeners = new Set<() => void>();

function set(next: Onboarding): void {
  if (next === state) return;
  state = next;
  writeOnboarding(state);
  listeners.forEach((l) => l());
}

export const getGuide = (): Onboarding => state;
export const completeStep = (id: GuideStepId): void => set(markDone(state, id));
export const setGuideHidden = (hidden: boolean): void => set(state.hidden === hidden ? state : { ...state, hidden });
export const restartGuide = (): void => set({ ...EMPTY_ONBOARDING, lastTab: state.lastTab });
/** Re-read storage (used by tests and when another tab changed it). */
export const reloadGuide = (): void => {
  state = readOnboarding();
  listeners.forEach((l) => l());
};

export function useGuide(): Onboarding {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getGuide,
    getGuide,
  );
}
