import { useSyncExternalStore } from "react";

/**
 * "The phone app just came back after a long break and is fetching fresh
 * data" (use-refresh-on-return.ts). The dashboard shows it straight away —
 * a thin line at the top, the page slightly faded — so the old page never
 * looks frozen while the network wakes up.
 */
let resuming = false;
const listeners = new Set<() => void>();

export function setResuming(on: boolean) {
  if (resuming === on) return;
  resuming = on;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useResuming(): boolean {
  return useSyncExternalStore(subscribe, () => resuming, () => false);
}
