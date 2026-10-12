import { useEffect, useState } from "react";
import { PrefetchPageLinks } from "react-router";

/**
 * Once the app has settled, quietly download the code for the daily pages so
 * tapping them later doesn't wait on the network (REDESIGN_PLAN.md). Data
 * still loads on the page, which already shows skeletons.
 */
const DAILY_PAGES = [
  "/",
  "/lead-form",
  "/contacts",
  "/companies",
  "/pipeline",
  "/tasks",
  "/results",
  "/calendar",
  "/mail",
  "/website",
  "/settings/profile",
];

export function DailyPrefetch() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true), { timeout: 4000 });
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setReady(true), 2500);
    return () => window.clearTimeout(t);
  }, []);
  if (!ready) return null;
  return (
    <>
      {DAILY_PAGES.map((page) => (
        <PrefetchPageLinks key={page} page={page} />
      ))}
    </>
  );
}
