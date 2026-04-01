import { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { getWorkspaceInvoices } from "~/lib/api/workspaces";
import { clearStoredAuth } from "~/lib/hooks/use-auth";

const ONBOARDING_PREFIX = "/onboarding";
const PENDING_PATH = "/pending";
const CLOSED_PATH = "/closed";
const BRAND_PREFIX = "/brand";

export default function ProtectedLayout() {
  const { t } = useTranslation();
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
  const isOnBrand = path.startsWith(BRAND_PREFIX);
  const isBrandUser = user?.user_type === "brand";

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

    // Brand user routing: must stay on /brand, redirect if elsewhere
    if (isBrandUser) {
      if (!isOnBrand) {
        navigate("/brand", { replace: true });
      }
      return;
    }

    // Regular user: cannot access /brand
    if (isOnBrand) {
      navigate("/", { replace: true });
      return;
    }

    // STEP 1: Profile — must have first + last name
    const hasProfile = !!(user?.first_name?.trim() && user?.last_name?.trim());
    if (!hasProfile) {
      if (path !== "/onboarding/profile") {
        navigate("/onboarding/profile", { replace: true });
      }
      return;
    }

    // STEP 2: No workspace → workspace creation
    if (!workspaces?.length) {
      if (!isOnOnboarding && !isOnNoWorkspace) {
        navigate("/onboarding/workspace", { replace: true });
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

    const ws = currentWorkspace;
    const status = ws?.status ?? "active";

    // Canceled → only /closed, nothing else
    if (status === "canceled") {
      if (!isOnClosed) {
        navigate(CLOSED_PATH, { replace: true });
      }
      return;
    }
    if (isOnClosed) {
      navigate("/", { replace: true });
      return;
    }

    // Active workspace → onboarding is irrelevant, go straight to dashboard
    if (status === "active") {
      if (isOnPending || isOnOnboarding) {
        navigate("/", { replace: true });
      }
      return;
    }

    // Pending workspace — sequential onboarding gates
    const hasBilling = !!(ws as { stripe_customer_id?: string | null })
      .stripe_customer_id;
    const hasProducts = !!(ws as { products?: unknown[] }).products?.length;

    // Billing not done → block products/pending, send to billing if outside onboarding
    if (!hasBilling) {
      if (path === "/onboarding/products" || isOnPending) {
        navigate("/onboarding/billing", { replace: true });
        return;
      }
      if (!isOnOnboarding) {
        navigate("/onboarding/billing", { replace: true });
        return;
      }
      return;
    }

    // Billing done, products not done → block pending, send to products if outside onboarding
    if (!hasProducts) {
      if (isOnPending) {
        navigate("/onboarding/products", { replace: true });
        return;
      }
      if (!isOnOnboarding) {
        navigate("/onboarding/products", { replace: true });
        return;
      }
      return;
    }

    // All onboarding complete → hold on /pending
    if (!isOnPending) {
      navigate(PENDING_PATH, { replace: true });
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
    isBrandUser,
    isOnBrand,
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
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

  // Brand user: only render if on /brand
  if (isBrandUser) {
    return isOnBrand ? <Outlet /> : null;
  }

  // Regular user: block /brand
  if (isOnBrand) {
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

  if (currentWorkspace) {
    const ws = currentWorkspace;
    const status = ws?.status ?? "active";

    if (status === "canceled") {
      if (!isOnClosed) return null;
      // canceled + on /closed → render, skip all other guards
    } else if (isOnClosed) {
      return null;
    } else if (status === "active") {
      if (isOnPending || isOnOnboarding) return null;
    } else {
      // Pending workspace — sequential onboarding gates
      const hasBilling = !!(ws as { stripe_customer_id?: string | null })
        .stripe_customer_id;
      const hasProducts = !!(ws as { products?: unknown[] }).products?.length;

      if (!hasBilling) {
        if (path === "/onboarding/products" || isOnPending) return null;
        if (!isOnOnboarding) return null;
      } else if (!hasProducts) {
        if (isOnPending) return null;
        if (!isOnOnboarding) return null;
      } else {
        if (!isOnPending) return null;
      }
    }
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
