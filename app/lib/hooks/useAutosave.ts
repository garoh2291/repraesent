import { useEffect, useRef } from "react";

/**
 * Trailing-edge autosave.
 *
 * Extracted from the forms builder (`routes/forms.$formId.tsx`), which has run
 * this shape in production for a while; the email-template builder carries a
 * byte-for-byte copy of it. A single timer is re-armed by every edit, so the
 * leading edge never fires and only the pause at the end of typing saves.
 *
 * `enabled` is the whole in-flight guard: callers fold `!busy` into it, so a
 * save that is still running blocks the next one, and when it settles — with
 * the draft still dirty — the effect re-arms for another trailing save. No
 * queue and no ref, which is why there is nothing here to get out of sync.
 *
 * `deps` must contain the draft values themselves, not just the dirty flag:
 * that is what makes each keystroke restart the timer.
 *
 * NOTE: do not reach for `useDebounce` instead — it clears a `setTimeout` id
 * with `clearInterval`.
 */
export function useAutosave(
  enabled: boolean,
  run: () => void | Promise<void>,
  deps: readonly unknown[],
  delayMs = 1200,
): void {
  // Kept in a ref so a fresh closure each render does not restart the timer;
  // including the callback in the deps would mean nothing ever saved.
  const latest = useRef(run);
  latest.current = run;

  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => {
      void (async () => {
        try {
          await latest.current();
        } catch {
          // The caller's mutation reports its own failure; this only stops an
          // unhandled rejection. The draft stays dirty, so the next edit
          // re-arms the timer.
        }
      })();
    }, delayMs);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, delayMs, ...deps]);
}
