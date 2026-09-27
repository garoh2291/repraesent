import { useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import {
  getStoredWorkspaceId,
  getStoredSelectedView,
  clearStoredSelectedView,
  BRAND_VIEW,
} from "~/lib/api/axios-instance";
import { getWorkspaceInvoices } from "~/lib/api/workspaces";
import { clearStoredAuth } from "~/lib/hooks/use-auth";
import {
  getDoorboostEligibility,
  type DoorboostEligibility,
} from "~/lib/api/doorboost-restore";
import { updateOnboardingProfile } from "~/lib/api/onboarding";
import { resolveWorkspaceRoute } from "~/lib/onboarding/resolve-route";

const ONBOARDING_PREFIX = "/onboarding";
const BRAND_PREFIX = "/brand";

export default function ProtectedLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, user, workspaces, currentWorkspace, brand } =
    useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isOnOnboarding = path.startsWith(ONBOARDING_PREFIX);
  const isOnNoWorkspace = path === "/no-workspace";
  const isOnWorkspacePicker = path === "/auth/workspace-picker";
  // Only match the brand-user routes (/brand, /brand/workspaces, …) — NOT
  // doorboost-brand workspace routes like /brand-retailers or /brand-leads.
  const isOnBrand = path === BRAND_PREFIX || path.startsWith(BRAND_PREFIX + "/");
  const isBrandUser = user?.user_type === "brand";
  // Brand entity may have been revoked while the session was alive (user
  // removed from the brand, or brand deleted). We treat them as a "regular"
  // workspace-only user from this point on.
  const brandRevoked = isBrandUser && !brand;

  const hasProfile = !!(user?.first_name?.trim() && user?.last_name?.trim());
  const noWorkspacesYet = (workspaces?.length ?? 0) === 0;

  // Pre-profile eligibility probe. Runs once for fresh users (regular type, no
  // profile, no workspaces) so that returning Doorboost customers can skip the
  // manual name entry — their first/last name already exists in ClickHouse.
  const queryClient = useQueryClient();
  const shouldProbeEligibility =
    isAuthenticated &&
    !isLoading &&
    !!user &&
    user.user_type === "user" &&
    !hasProfile &&
    noWorkspacesYet;

  const { data: eligibility, isLoading: isEligibilityLoading } =
    useQuery<DoorboostEligibility>({
      queryKey: ["doorboost-eligibility"],
      queryFn: getDoorboostEligibility,
      enabled: shouldProbeEligibility,
      staleTime: 0,
      retry: false,
    });

  const autoProfileMutation = useMutation({
    mutationFn: updateOnboardingProfile,
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });
  const autoProfileTriedRef = useRef(false);

  const eligibilityHint = eligibility?.hint;
  const hintFirst = eligibilityHint?.firstName?.trim() ?? "";
  const hintLast = eligibilityHint?.lastName?.trim() ?? "";
  const hintHasBothNames = !!(hintFirst && hintLast);
  const eligibilityProbeDone =
    !shouldProbeEligibility || (!isEligibilityLoading && eligibility !== undefined);

  useEffect(() => {
    if (!shouldProbeEligibility) return;
    if (!hintHasBothNames) return;
    if (autoProfileTriedRef.current) return;
    if (autoProfileMutation.isPending) return;
    autoProfileTriedRef.current = true;
    autoProfileMutation.mutate({
      first_name: hintFirst,
      last_name: hintLast,
    });
  }, [
    shouldProbeEligibility,
    hintHasBothNames,
    hintFirst,
    hintLast,
    autoProfileMutation,
  ]);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      const returnUrl = location.pathname + location.search;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, {
        replace: true,
      });
      return;
    }

    // Only allow "user" and "brand" types
    if (user && user.user_type && user.user_type !== "user" && user.user_type !== "brand") {
      clearStoredAuth();
      navigate("/login", { replace: true });
      return;
    }

    // Brand user with no workspace memberships → lock to /brand.
    // Brand user with workspace memberships → may use BOTH /brand and the
    // regular workspace dashboard; the switcher in the sidebar lets them
    // toggle between brand-view and workspace-view.
    if (isBrandUser) {
      const hasWorkspaces = (workspaces?.length ?? 0) > 0;

      // Brand access revoked mid-session (user removed from brand, or brand
      // deleted). Drop the "brand" preference and route them to whatever
      // they still have access to.
      if (brandRevoked) {
        if (getStoredSelectedView() === BRAND_VIEW) {
          clearStoredSelectedView();
        }
        if (!hasWorkspaces) {
          if (!isOnNoWorkspace) {
            navigate("/no-workspace", { replace: true });
          }
          return;
        }
        if (isOnBrand) {
          navigate("/auth/workspace-picker", { replace: true });
          return;
        }
        // not on /brand and has workspaces → fall through to workspace gating
      } else {
        if (!hasWorkspaces) {
          if (!isOnBrand) {
            navigate("/brand", { replace: true });
          }
          return;
        }
        // Brand user IS on /brand → render brand layout, skip remaining gating.
        if (isOnBrand) {
          return;
        }
        // Otherwise fall through to the regular workspace gating below.
      }
    } else if (isOnBrand) {
      // Regular user: cannot access /brand
      navigate("/", { replace: true });
      return;
    }

    // STEP 1: Profile — must have first + last name.
    if (!hasProfile) {
      // Wait for the eligibility probe before deciding. If a hint provides
      // both names we'll auto-save and let the next render pass the gate;
      // if it has only partial names (or none) we redirect to the profile
      // page and prefill what we have via router state.
      if (!eligibilityProbeDone) return;
      if (hintHasBothNames || autoProfileMutation.isPending) return;

      if (path !== "/onboarding/profile") {
        navigate("/onboarding/profile", {
          replace: true,
          state: eligibilityHint ? { hint: eligibilityHint } : undefined,
        });
      }
      return;
    }

    // STEP 2: No workspace → always pass through the Doorboost-choice gate.
    // The choice page itself fetches /onboarding/doorboost/eligibility and
    // auto-redirects to /onboarding/workspace (→ the wizard at /onboarding/start)
    // when the user isn't a returning Doorboost customer. This avoids a race
    // where the wizard renders before the (async) eligibility fetch resolves.
    if (noWorkspacesYet) {
      if (!isOnOnboarding && !isOnNoWorkspace) {
        navigate("/onboarding/doorboost-choice", { replace: true });
      }
      return;
    }

    // STEP 3: Multiple workspaces, none selected yet → picker
    if (
      workspaces.length > 1 &&
      !getStoredWorkspaceId() &&
      !isOnWorkspacePicker
    ) {
      navigate("/auth/workspace-picker", { replace: true });
      return;
    }

    // STEP 4: Workspace selected — sequential onboarding then status
    if (!currentWorkspace) return;

    // Status + onboarding gating lives in one pure function shared with the
    // render check below and the magic-link callback (resolve-route.ts).
    const target = resolveWorkspaceRoute(currentWorkspace, path, user, {
      isOnWorkspacePicker,
    });
    if (target && target !== path) navigate(target, { replace: true });
  }, [
    isAuthenticated,
    isLoading,
    user,
    workspaces,
    currentWorkspace,
    navigate,
    location,
    path,
    isOnOnboarding,
    isOnNoWorkspace,
    isOnWorkspacePicker,
    isBrandUser,
    brandRevoked,
    isOnBrand,
    eligibilityProbeDone,
    eligibilityHint,
    hintHasBothNames,
    autoProfileMutation.isPending,
    hasProfile,
  ]);

  const wsStatus = currentWorkspace?.status ?? "active";
  const hasPastDueProduct = currentWorkspace?.products?.some(
    (p: { status?: string }) => p.status === "past_due",
  );
  const showPastDueBanner =
    wsStatus === "past_due" || (wsStatus === "active" && hasPastDueProduct);

  const _workspaceId = currentWorkspace?.id;
  const { data: invoices = [] } = useQuery({
    queryKey: ["workspace-invoices", _workspaceId],
    queryFn: () => getWorkspaceInvoices(_workspaceId!),
    enabled: !!_workspaceId && showPastDueBanner,
  });

  const invoiceUrl =
    invoices.find((inv) => inv.status === "open" && inv.hosted_invoice_url)
      ?.hosted_invoice_url ??
    (currentWorkspace as { unpaid_invoice_url?: string } | null)
      ?.unpaid_invoice_url;

  // Hold the spinner while the pre-profile eligibility probe (and any
  // resulting auto-save) is in flight, otherwise the user briefly sees the
  // blank profile page before being redirected through.
  const isPreProfileChecking =
    !isLoading &&
    !hasProfile &&
    (!eligibilityProbeDone ||
      (hintHasBothNames && (autoProfileMutation.isPending || !user?.first_name?.trim())));

  // During onboarding a background refresh of the account (after step 1, a
  // language switch, the plan step) must not blank the page: that unmounted the
  // wizard and replayed the business card on every refresh. Only the first load
  // (no user yet) shows the spinner there.
  const backgroundRefresh = isOnOnboarding && !!user && !isPreProfileChecking;
  if ((isLoading && !backgroundRefresh) || isPreProfileChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center pt-safe">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Block non-user/non-brand types
  if (user && user.user_type && user.user_type !== "user" && user.user_type !== "brand") {
    return null;
  }

  // Brand user with no workspaces: only render /brand.
  // Brand user WITH workspaces: render /brand directly; fall through to the
  // regular workspace gating below for workspace-scoped paths.
  if (isBrandUser) {
    const hasWorkspaces = (workspaces?.length ?? 0) > 0;
    if (brandRevoked) {
      // Brand was revoked — never render /brand. The effect above redirects;
      // we just block until it completes.
      if (isOnBrand) return null;
      if (!hasWorkspaces) {
        return isOnNoWorkspace ? <Outlet /> : null;
      }
      // has workspaces → fall through to workspace gating
    } else {
      if (!hasWorkspaces) {
        return isOnBrand ? <Outlet /> : null;
      }
      if (isOnBrand) {
        return <Outlet />;
      }
      // Fall through — brand user using workspace view.
    }
  } else if (isOnBrand) {
    // Regular user: block /brand
    return null;
  }

  if (!hasProfile) {
    // The profile step (name capture) must always be reachable for anyone
    // without a name — including invited members who already belong to an
    // active workspace. Render it directly and bypass the workspace-status
    // gating below (which would otherwise blank out onboarding paths for
    // active/trial workspaces). When they lack a name but aren't on the
    // profile page, the effect above redirects them there.
    return path === "/onboarding/profile" ? <Outlet /> : null;
  }

  if (!workspaces?.length) {
    // Same wrapper as below, so gaining the first workspace (after onboarding
    // step 1) doesn't remount the whole wizard.
    return isOnOnboarding || isOnNoWorkspace ? (
      <div className="flex flex-col min-h-screen">
        {null /* the past-due banner's slot below: keeps <Outlet /> at the same position */}
        <Outlet />
      </div>
    ) : null;
  }

  if (
    workspaces.length > 1 &&
    !getStoredWorkspaceId() &&
    !isOnWorkspacePicker
  ) {
    return null;
  }

  if (
    currentWorkspace &&
    resolveWorkspaceRoute(currentWorkspace, path, user, { isOnWorkspacePicker })
  ) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {showPastDueBanner && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200">
          {t("errors.paymentOverdue")} —{" "}
          {invoiceUrl ? (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              {t("errors.viewYourInvoice")}
            </a>
          ) : (
            t("errors.checkInboxForStripe")
          )}
        </div>
      )}
      <Outlet />
    </div>
  );
}
