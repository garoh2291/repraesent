import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { clearStoredAuth } from "~/lib/hooks/use-auth";

const ONBOARDING_PREFIX = "/onboarding";
const PENDING_PATH = "/pending";
const CLOSED_PATH = "/closed";

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, user, workspaces, currentWorkspace } =
    useAuthContext();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const isOnOnboarding = path.startsWith(ONBOARDING_PREFIX);
  const isOnPending = path === PENDING_PATH;
  const isOnClosed = path === CLOSED_PATH;
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

    // STEP 3: Multiple workspaces, none selected yet → show picker first
    // Must come before status checks so we don't evaluate status on the wrong workspace
    if (
      workspaces.length > 1 &&
      !getStoredWorkspaceId() &&
      !isOnWorkspacePicker
    ) {
      navigate("/auth/workspace-picker", { replace: true });
      return;
    }

    // STEP 4: Status checks — only run once a workspace is actually selected.
    // If currentWorkspace is null (multi-workspace, none chosen yet) skip entirely;
    // the workspace picker will handle routing after the user makes a selection.
    if (!currentWorkspace) return;

    const ws = currentWorkspace;
    const status = ws?.status ?? "active";

    if (status === "canceled" && !isOnClosed) {
      navigate(CLOSED_PATH, { replace: true });
      return;
    }

    if (status !== "canceled" && isOnClosed) {
      navigate("/", { replace: true });
      return;
    }

    if (status === "pending" && !isOnPending) {
      navigate(PENDING_PATH, { replace: true });
      return;
    }

    if (status === "active" && isOnPending) {
      navigate("/", { replace: true });
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
    isOnClosed,
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

  if (
    workspaces.length > 1 &&
    !getStoredWorkspaceId() &&
    !isOnWorkspacePicker
  ) {
    return null;
  }

  // Only gate on workspace status once a workspace is actually selected.
  // If currentWorkspace is null (picker hasn't been used yet), let the Outlet render
  // so the workspace picker page itself is visible.
  if (currentWorkspace) {
    const ws = currentWorkspace;
    const status = ws?.status ?? "active";
    if (status === "pending" && !isOnPending) {
      return null;
    }
    if (status === "canceled" && !isOnClosed) {
      return null;
    }
  }

  const wsStatus = currentWorkspace?.status ?? "active";
  const hasPastDueProduct =
    currentWorkspace?.products?.some((p: { status?: string }) => p.status === "past_due");
  const showPastDueBanner =
    wsStatus === "past_due" || (wsStatus === "active" && hasPastDueProduct);
  const invoiceUrl = (currentWorkspace as { unpaid_invoice_url?: string } | null)?.unpaid_invoice_url;

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
