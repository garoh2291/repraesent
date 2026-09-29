import type { QueryClient } from "@tanstack/react-query";
import type { NavigateFunction } from "react-router";
import type { UserContextResponse } from "~/lib/api/auth";
import {
  BRAND_VIEW,
  getStoredSelectedView,
  getStoredWorkspaceId,
  setStoredSelectedView,
  setStoredWorkspaceId,
} from "~/lib/api/axios-instance";
import { resolveWorkspaceRoute } from "~/lib/onboarding/resolve-route";

export interface RouteAfterAuthOptions {
  navigate: NavigateFunction;
  queryClient: QueryClient;
  /** `?workspace=` from an email deep link: wins when the user is a member. */
  workspaceParam?: string | null;
  /** `?redirect=` / `returnUrl`: honoured when it is a safe relative path. */
  redirectParam?: string | null;
}

const isSafePath = (p: string | null | undefined): p is string =>
  !!p && p.startsWith("/") && !p.startsWith("//");

/**
 * Where a person lands right after signing in — shared by the magic-link
 * callback and the 6-digit code on the login page, so both ways in follow
 * exactly the same rules (profile first, deep links, brand views, pickers,
 * onboarding gates).
 */
export function routeAfterAuth(context: UserContextResponse, opts: RouteAfterAuthOptions): void {
  const { navigate, queryClient } = opts;
  const workspaceParam = opts.workspaceParam ?? null;
  const redirectParam = isSafePath(opts.redirectParam) ? opts.redirectParam : null;
  const resolveDestination = (fallback: string) => redirectParam ?? fallback;

  const isBrand = context.user.user_type === "brand";
  const workspaces = context.workspaces ?? [];
  const hasBrand = !!context.brand;

  // Invited members log in with an empty name (email-only invite). Send
  // them to complete their profile first — even though they already belong
  // to the workspace they were invited to — then they land in the app.
  const needsProfile =
    !isBrand && (!context.user.first_name?.trim() || !context.user.last_name?.trim());
  if (needsProfile) {
    if (workspaceParam && workspaces.some((w) => w.id === workspaceParam)) {
      setStoredWorkspaceId(workspaceParam);
      setStoredSelectedView(workspaceParam);
    } else if (workspaces.length === 1) {
      setStoredWorkspaceId(workspaces[0].id);
      setStoredSelectedView(workspaces[0].id);
    }
    navigate("/onboarding/profile", { replace: true });
    return;
  }

  // Email deep-link to a specific workspace — always wins, applies to both
  // regular and brand users.
  if (workspaceParam && workspaces.some((w) => w.id === workspaceParam)) {
    setStoredWorkspaceId(workspaceParam);
    setStoredSelectedView(workspaceParam);
    queryClient.removeQueries();
    navigate(resolveDestination("/"), { replace: true });
    return;
  }

  // Explicit redirect param — honour any safe relative path.
  if (redirectParam) {
    if (redirectParam.startsWith("/brand")) {
      if (isBrand && hasBrand) setStoredSelectedView(BRAND_VIEW);
    }
    navigate(redirectParam, { replace: true });
    return;
  }

  // Brand user whose brand was revoked: no /brand access. If they have
  // workspaces, let them pick one; otherwise drop them at /no-workspace.
  if (isBrand && !hasBrand) {
    if (workspaces.length === 0) {
      navigate("/no-workspace", { replace: true });
      return;
    }
    const stored = getStoredSelectedView();
    if (stored && stored !== BRAND_VIEW && workspaces.some((w) => w.id === stored)) {
      setStoredWorkspaceId(stored);
      navigate(resolveDestination("/"), { replace: true });
      return;
    }
    if (workspaces.length === 1) {
      const ws = workspaces[0];
      setStoredWorkspaceId(ws.id);
      setStoredSelectedView(ws.id);
      navigate(resolveDestination("/"), { replace: true });
      return;
    }
    navigate("/auth/workspace-picker", { replace: true });
    return;
  }

  // Brand user routing.
  if (isBrand && hasBrand) {
    // Brand-only (no workspace memberships) → /brand is the only option.
    if (workspaces.length === 0) {
      setStoredSelectedView(BRAND_VIEW);
      navigate("/brand", { replace: true });
      return;
    }

    const stored = getStoredSelectedView();
    if (stored === BRAND_VIEW) {
      navigate("/brand", { replace: true });
      return;
    }
    if (stored && workspaces.some((w) => w.id === stored)) {
      setStoredWorkspaceId(stored);
      navigate(resolveDestination("/"), { replace: true });
      return;
    }
    // First-time brand-user with workspaces, or stored view no longer
    // valid → let them pick.
    navigate("/auth/workspace-picker", { replace: true });
    return;
  }

  // Regular user paths below.
  if (!workspaces.length) {
    navigate("/onboarding/profile", { replace: true });
    return;
  }

  if (workspaces.length === 1) {
    const ws = workspaces[0];
    setStoredWorkspaceId(ws.id);
    setStoredSelectedView(ws.id);
    // Same rules as the protected layout (onboarding, welcome, holds).
    const wanted = resolveDestination("/");
    const gate = resolveWorkspaceRoute(ws, wanted, context.user);
    navigate(gate ?? wanted, { replace: true });
    return;
  }

  const storedWs = getStoredWorkspaceId();
  if (storedWs && workspaces.some((w) => w.id === storedWs)) {
    setStoredSelectedView(storedWs);
    navigate(resolveDestination("/"), { replace: true });
    return;
  }
  navigate("/auth/workspace-picker", { replace: true });
}
