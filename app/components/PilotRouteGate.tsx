import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useAuthContext } from "~/providers/auth-provider";
import {
  isPilotFeatureEnabled,
  pilotFeatureForPath,
  type PilotFeature,
} from "~/lib/feature-flags";

/**
 * Pilot features a live demo workspace may open even without the flag. Mirrors
 * the sidebar's `isDemoWorkspace` escape hatches.
 */
const DEMO_WORKSPACE_ALLOWED: ReadonlySet<PilotFeature> = new Set([
  "workflows",
  "integrations",
]);

/**
 * Bounces workspaces outside the pilot set off piloted routes. Rendered once
 * in the authenticated dashboard layout; runs on mount and on every pathname
 * change, so a pasted URL leaves before the page mounts anything. Renders
 * nothing.
 */
export function PilotRouteGate() {
  const { currentWorkspace } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const lastBounced = useRef<string | null>(null);

  const workspaceId = currentWorkspace?.id ?? null;
  const isDemo = currentWorkspace?.is_demo === true;

  useEffect(() => {
    // Auth still resolving: no workspace means nothing to decide yet.
    if (!workspaceId) return;
    const feature = pilotFeatureForPath(location.pathname);
    if (!feature) {
      lastBounced.current = null;
      return;
    }
    if (isPilotFeatureEnabled(workspaceId)) return;
    if (isDemo && DEMO_WORKSPACE_ALLOWED.has(feature)) return;

    // One toast per bounce, not one per render of the same bounce.
    if (lastBounced.current !== location.pathname) {
      lastBounced.current = location.pathname;
      toast.info(t("nav.pilotUnavailable"));
    }
    navigate("/", { replace: true });
  }, [workspaceId, isDemo, location.pathname, navigate, t]);

  return null;
}
