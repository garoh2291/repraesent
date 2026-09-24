/**
 * Where a signed-in user with a selected workspace belongs (STEP 4 of the
 * protected-layout gating). Pure, so the layout's effect, its render check
 * and the magic-link callback all use the SAME rules and can't drift apart.
 *
 * Returns the path to redirect to, or null when `path` is allowed.
 *
 * Profile, DoorBoost, brand and workspace-picker gating (steps 1–3) are not
 * here — they run before this and are unchanged.
 */

export interface RouteWorkspace {
  id: string;
  status?: string | null;
  type?: string | null;
  member_role?: string | null;
  stripe_customer_id?: string | null;
  products?: unknown[] | null;
  onboarding?: { open: boolean; owner_is_me: boolean } | null;
}

export interface RouteUser {
  onboarding_welcome_workspace_id?: string | null;
}

export const WIZARD_PATH = "/onboarding/start";
export const IN_PROGRESS_PATH = "/onboarding/in-progress";
export const WELCOME_PATH = "/welcome";
export const PENDING_PATH = "/pending";
export const CLOSED_PATH = "/closed";

const DOORBOOST_BRAND_PATHS = ["/db-brand", "/brand-retailers", "/brand-campaigns", "/brand-leads"];

export function isDoorboostBrandPath(path: string): boolean {
  return DOORBOOST_BRAND_PATHS.some((p) => path.startsWith(p));
}

const isWizardPath = (path: string) => path === WIZARD_PATH || path.startsWith(`${WIZARD_PATH}/`);

/**
 * Which onboarding situation a pending workspace is in:
 *  - "wizard":      the user runs (or can start/continue) the new onboarding
 *  - "in_progress": someone else is setting it up, or the user can't
 *  - "legacy_hold": old flow finished (customer + products) — wait on /pending
 */
export function pendingMode(ws: RouteWorkspace): "wizard" | "in_progress" | "legacy_hold" {
  const open = !!ws.onboarding?.open;
  if (open) return ws.onboarding?.owner_is_me ? "wizard" : "in_progress";
  const hasCustomer = !!ws.stripe_customer_id;
  const hasProducts = (ws.products?.length ?? 0) > 0;
  if (hasCustomer && hasProducts) return "legacy_hold";
  return ws.member_role === "admin" ? "wizard" : "in_progress";
}

export function resolveWorkspaceRoute(
  ws: RouteWorkspace,
  path: string,
  user?: RouteUser | null,
  opts: { isOnWorkspacePicker?: boolean } = {},
): string | null {
  const status = ws.status ?? "active";

  if (ws.type === "doorboost_brand") {
    return isDoorboostBrandPath(path) || opts.isOnWorkspacePicker ? null : "/db-brand";
  }

  // Switching to another workspace must always be possible (never trap a user).
  if (opts.isOnWorkspacePicker) return null;

  if (status === "canceled") return path === CLOSED_PATH ? null : CLOSED_PATH;
  if (path === CLOSED_PATH) return "/";

  if (status === "active" || status === "trial") {
    if (path === PENDING_PATH) return "/";
    // DoorBoost's sync screen polls and leaves by itself.
    if (path.startsWith("/onboarding") && path !== "/onboarding/sync-pending") return "/";
    // Just finished onboarding: the welcome screen (intro call) comes first.
    if (path === "/" && user?.onboarding_welcome_workspace_id === ws.id) return WELCOME_PATH;
    return null;
  }

  if (status === "pending") {
    const mode = pendingMode(ws);
    if (mode === "wizard") return isWizardPath(path) ? null : WIZARD_PATH;
    if (mode === "in_progress") return path === IN_PROGRESS_PATH ? null : IN_PROGRESS_PATH;
    return path === PENDING_PATH ? null : PENDING_PATH;
  }

  // past_due / waiting_for_payment: a billing matter, not onboarding.
  return path === PENDING_PATH ? null : PENDING_PATH;
}
