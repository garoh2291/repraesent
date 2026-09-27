import { useEffect, useState } from "react";
import { useLocation, useNavigation } from "react-router";

/**
 * Where the app is going (REDESIGN_PLAN.md: navigation that answers at once).
 *
 * A tap starts loading the next page's code; until it arrives React Router
 * keeps showing the old page. Navigation (tab bar, section tabs, sidebar)
 * reads `pathname` from here so the tapped tab lights up immediately and
 * nobody taps twice.
 */
export function usePendingPathname(): { pathname: string; pending: string | null } {
  const location = useLocation();
  const navigation = useNavigation();
  const next = navigation.state === "loading" ? navigation.location : undefined;
  const pending = next && next.pathname !== location.pathname ? next.pathname : null;
  return { pathname: pending ?? location.pathname, pending };
}

/** True once `on` has stayed true for `delayMs`: no flash on fast loads. */
export function useDelayedFlag(on: boolean, delayMs = 150): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) {
      setShown(false);
      return;
    }
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [on, delayMs]);
  return shown;
}
