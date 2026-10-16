import { useSyncExternalStore } from "react";

/** How many mutating requests (POST) are in flight. A run, forensics or heal holds the workspace lock for its whole
 *  duration, so polling the same workspace meanwhile would only queue behind it (ui-redesign.md §3.4, §14.4). */
let inFlight = 0;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

export function beginMutation(): void {
  inFlight += 1;
  emit();
}

export function endMutation(): void {
  inFlight = Math.max(0, inFlight - 1);
  emit();
}

export function isMutating(): boolean {
  return inFlight > 0;
}

export function subscribeActivity(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useIsMutating(): boolean {
  return useSyncExternalStore(subscribeActivity, isMutating, isMutating);
}
