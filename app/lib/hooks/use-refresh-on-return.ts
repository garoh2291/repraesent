import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PHONE_QUERY } from "~/lib/hooks/use-is-phone";
import { setResuming } from "~/lib/nav/resume-store";

/** Shorter trips (a notification pull-down, a quick app switch) don't count. */
const MIN_AWAY_MS = 2_000;
/** Never more than one refresh in this window. */
const MIN_GAP_MS = 10_000;
/** Phones away this long show "updating" at once (resume-store). */
const LONG_AWAY_MS = 60_000;
/** The "updating" look never outlasts this, even on a stalled network. */
const RESUME_MAX_MS = 8_000;

/**
 * Fresh data the moment the app comes back to the front (minimised app,
 * locked phone, other tab). Everything on screen refetches right away and the
 * old data stays until the new arrives, so nothing blanks. Everything else is
 * marked stale and refetches when it's next shown.
 *
 * On a phone that was away a minute or more, the page also says it's
 * updating (a line at the top, slightly faded) until the refetches are done,
 * so it never looks frozen while the network wakes up. Short trips and the
 * desktop stay quiet.
 *
 * `refetchOnWindowFocus` stays off globally on purpose: on desktop every
 * click back into the window would refetch. This only reacts to the page
 * having actually been hidden.
 */
export function useRefreshOnReturn() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (typeof document === "undefined") return;
    let hiddenAt: number | null = document.visibilityState === "hidden" ? Date.now() : null;
    let lastRefresh = 0;
    let resumeTimer = 0;
    let resumeRun = 0;

    const refresh = (away: number) => {
      const now = Date.now();
      if (now - lastRefresh < MIN_GAP_MS) return;
      lastRefresh = now;

      const showUpdating = away >= LONG_AWAY_MS && window.matchMedia(PHONE_QUERY).matches;
      const run = ++resumeRun;
      if (showUpdating) setResuming(true);

      const done = queryClient.invalidateQueries({
        refetchType: "active",
        // The session check stays as it is: returning must never flash a
        // "who are you" state.
        predicate: (q) => q.queryKey[0] !== "auth",
      });

      if (!showUpdating) {
        void done.catch(() => undefined);
        return;
      }
      const finish = () => {
        if (run !== resumeRun) return;
        window.clearTimeout(resumeTimer);
        setResuming(false);
      };
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(finish, RESUME_MAX_MS);
      void done.then(finish, finish);
    };

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
      hiddenAt = null;
      if (away >= MIN_AWAY_MS) refresh(away);
    };
    // iOS can restore a frozen page from memory without a visibility change.
    // How long it was away is unknown then, so treat it as a long break.
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refresh(LONG_AWAY_MS);
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pageshow", onPageShow);
      window.clearTimeout(resumeTimer);
      setResuming(false);
    };
  }, [queryClient]);
}
