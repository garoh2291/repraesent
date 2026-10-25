import { useLocation, useNavigate } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { setStoredSelectedView, BRAND_VIEW } from "~/lib/api/axios-instance";
import { usePilotFeatures } from "~/lib/feature-flags";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import { SETTINGS_GROUPS, SETTINGS_NAV } from "~/lib/nav/settings";

/**
 * What the navigation may show for the current person and workspace — shared
 * by the desktop sidebar and the phone menu sheet, so the two never disagree
 * about who sees Settings → Onboarding, Contact re:praesent or Website.
 */
export function useNavModel() {
  const { user, currentWorkspace, workspaces, brand, setCurrentWorkspace } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const pilot = usePilotFeatures();

  // Brand users with a linked brand entity get a "Brand" entry in the switcher
  // so they can hop back to their brand dashboard from a workspace view.
  const showBrandSwitchEntry = user?.user_type === "brand" && !!brand;
  const hasMultipleWorkspaces =
    (workspaces?.length ?? 0) > 1 || (showBrandSwitchEntry && (workspaces?.length ?? 0) >= 1);
  // A live demo is a product tour: every destination stays visible even with
  // nothing connected. Real workspaces keep the gates below.
  const isDemoWorkspace = currentWorkspace?.is_demo === true;
  // Root workspace admins configure the new-customer onboarding.
  const isRootAdmin = currentWorkspace?.is_root === true && currentWorkspace.member_role === "admin";
  const isDoorboostBrandWs = currentWorkspace?.type === "doorboost_brand";
  // "Contact re:praesent": not the root (that's re:praesent itself), not demo
  // workspaces, not DoorBoost brands, and only once switched on per workspace
  // (root Settings → Support).
  const showContactSales =
    !!currentWorkspace &&
    currentWorkspace.is_root !== true &&
    currentWorkspace.is_demo !== true &&
    !isDoorboostBrandWs &&
    currentWorkspace.support_contact_enabled === true;

  // Route-driven modes: deep links and refreshes land in the right mode for
  // free, and there is nothing to reset on the way out.
  const inSettings = location.pathname.startsWith("/settings");
  const { data: wpSite } = useWorkspaceWpSite(!!currentWorkspace?.id && !isDoorboostBrandWs);
  const showWebsite = !!wpSite?.sso_enabled || isDemoWorkspace;
  const inWebsite = showWebsite && location.pathname.startsWith("/website");

  /** Settings groups with only the entries this person may open. */
  const settingsGroups = SETTINGS_GROUPS.map((group) => ({
    ...group,
    items: SETTINGS_NAV.filter(
      (item) =>
        item.group === group.key &&
        (item.to === "/settings/integrations"
          ? pilot.integrations || isDemoWorkspace
          : item.to === "/settings/onboarding" || item.to === "/settings/support"
              ? isRootAdmin
              : true),
    ),
  })).filter((g) => g.items.length > 0);

  const switchWorkspace = (workspaceId: string) => {
    setCurrentWorkspace(workspaceId);
    navigate("/", { replace: true });
  };
  const switchToBrand = () => {
    setStoredSelectedView(BRAND_VIEW);
    navigate("/brand", { replace: true });
  };

  return {
    currentWorkspace,
    workspaces: workspaces ?? [],
    brand,
    showBrandSwitchEntry,
    hasMultipleWorkspaces,
    isDemoWorkspace,
    isRootAdmin,
    isDoorboostBrandWs,
    showContactSales,
    showWebsite,
    inSettings,
    inWebsite,
    settingsGroups,
    switchWorkspace,
    switchToBrand,
  };
}

/** Settings entries that carry the neutral "Demo" pill (pilot features). */
export const PILOT_SETTINGS = new Set(["/settings/integrations"]);
