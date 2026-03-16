import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { clearStoredAuth } from "~/lib/hooks/use-auth";

const ONBOARDING_PREFIX = "/onboarding";
const PENDING_PATH = "/pending";
const CANCELED_PATH = "/canceled";

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, user, workspaces, currentWorkspace } =
    useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isOnOnboarding = path.startsWith(ONBOARDING_PREFIX);
  const isOnPending = path === PENDING_PATH;
  const isOnCanceled = path === CANCELED_PATH;
  const isOnNoWorkspace = path === "/no-workspace";
  const isOnWorkspacePicker = path === "/auth/workspace-picker";

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      const returnUrl = location.pathname + location.search;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`, {
        replace: true,
      });
      return;
    }

    if (user && user.user_type && user.user_type !== "user") {
      clearStoredAuth();
      navigate("/login", { replace: true });
      return;
    }

    // STEP 1: Profile check — highest priority
    const hasProfile = !!(user?.first_name?.trim() && user?.last_name?.trim());
    if (!hasProfile && !isOnOnboarding && path !== "/onboarding/profile") {
      navigate("/onboarding/profile", { replace: true });
      return;
    }

    // STEP 2: No workspace → workspace creation
    if (!workspaces?.length) {
      if (!isOnOnboarding && !isOnNoWorkspace) {
        navigate("/onboarding/workspace", { replace: true });
      }
      return;
    }

    const ws = currentWorkspace ?? workspaces[0];
    const status = ws?.status ?? "active";

    if (status === "canceled" && !isOnCanceled) {
      navigate(CANCELED_PATH, { replace: true });
      return;
    }

    if (status === "pending" && !isOnPending && !isOnOnboarding) {
      const hasStripeCustomer = !!(ws as { stripe_customer_id?: string | null })
        ?.stripe_customer_id;
      const hasProducts = (ws?.products?.length ?? 0) > 0;
      if (!hasStripeCustomer) {
        navigate("/onboarding/billing", { replace: true });
      } else if (!hasProducts) {
        navigate("/onboarding/products", { replace: true });
      } else {
        navigate(PENDING_PATH, { replace: true });
      }
      return;
    }

    if (status === "active" && isOnPending) {
      navigate("/", { replace: true });
      return;
    }

    if (
      workspaces.length > 1 &&
      !getStoredWorkspaceId() &&
      !isOnWorkspacePicker
    ) {
      navigate("/auth/workspace-picker", { replace: true });
      return;
    }
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
    isOnPending,
    isOnCanceled,
    isOnNoWorkspace,
    isOnWorkspacePicker,
  ]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (user && user.user_type && user.user_type !== "user")) {
    return null;
  }

  const hasProfile = !!(user?.first_name?.trim() && user?.last_name?.trim());
  if (!hasProfile && path !== "/onboarding/profile") {
    return null;
  }

  if (!workspaces?.length) {
    return isOnOnboarding || isOnNoWorkspace ? <Outlet /> : null;
  }

  const ws = currentWorkspace ?? workspaces[0];
  const status = ws?.status ?? "active";
  if (status === "pending" && !isOnPending && !isOnOnboarding) {
    return null;
  }
  if (status === "canceled" && !isOnCanceled) {
    return null;
  }

  if (
    workspaces.length > 1 &&
    !getStoredWorkspaceId() &&
    !isOnWorkspacePicker
  ) {
    return null;
  }

  const wsStatus = ws?.status ?? "active";
  const hasPastDueProduct =
    ws?.products?.some((p: { status?: string }) => p.status === "past_due");
  const showPastDueBanner =
    wsStatus === "past_due" || (wsStatus === "active" && hasPastDueProduct);
  const invoiceUrl = (ws as { unpaid_invoice_url?: string })?.unpaid_invoice_url;

  return (
    <div className="flex flex-col min-h-screen">
      {showPastDueBanner && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 text-center text-sm font-medium text-amber-800 dark:text-amber-200">
          Payment overdue —{" "}
          {invoiceUrl ? (
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:no-underline"
            >
              view your invoice
            </a>
          ) : (
            "please check your inbox for an invoice from Stripe"
          )}
        </div>
      )}
      <Outlet />
    </div>
  );
}
