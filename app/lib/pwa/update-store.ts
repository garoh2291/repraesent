import { useSyncExternalStore } from "react";

/**
 * The waiting service worker, shared between `useSwUpdate` (which finds it)
 * and the phone UI that offers it: a dot on More and a "New version ready"
 * row in the More sheet (REDESIGN_PLAN.md §2), instead of a toast that
 * covers the page.
 */
let waiting: ServiceWorker | null = null;
const listeners = new Set<() => void>();

export function setWaitingWorker(worker: ServiceWorker | null) {
  waiting = worker;
  listeners.forEach((l) => l());
}

/** Activate the waiting version; the page reloads once it has taken over. */
export function applyWaitingUpdate() {
  const worker = waiting;
  if (!worker || typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  worker.postMessage({ type: "SKIP_WAITING" });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while a new version is waiting to be applied. */
export function useUpdateWaiting(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => waiting !== null,
    () => false,
  );
}
