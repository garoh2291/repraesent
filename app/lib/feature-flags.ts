import { useAuthContext } from "~/providers/auth-provider";

/**
 * Workspaces allowed to see features that are still being piloted.
 * `0941b49b-…` is re:praesent, our own workspace; `4681cb1b-…` is the first
 * customer pilot.
 */
export const PILOT_WORKSPACE_IDS: ReadonlySet<string> = new Set([
  "0941b49b-edaa-44bb-8d6f-8f6decd10502",
  "4681cb1b-32d1-47cf-909b-29b2a63ffff3",
]);

/**
 * Pilot features: on in development, and in production only for the pilot
 * workspaces above.
 *
 * Two things enforce them on the client: the sidebar hides the entries (and
 * labels them "Demo" for pilots), and `PilotRouteGate` in the dashboard layout
 * bounces any route listed in `PILOT_ROUTES` back to `/` for workspaces
 * outside the set. The API endpoints behind them are unchanged, so this is a
 * product boundary, not a security one. Deleting a flag once its feature
 * ships to everyone is the intended end state.
 */
export type PilotFeature =
  /** Workflow builder. */
  | "workflows"
  /** Per-mailbox signature editing in Settings, and its notice in the composer. */
  | "emailSignature"
  /** Settings → Integrations (Stripe Connect). Products/invoicing follow it, since connecting happens there. */
  | "integrations"
  /** Email marketing: /campaigns, /segments, /email-templates. */
  | "emailCampaigns"
  /** Website AI assistant: /ai-assistants. */
  | "aiAssistant";

/** i18n key of the label the sidebar shows next to a piloted entry. */
export const PILOT_FEATURE_LABEL_KEY = "nav.betaVadge";

/**
 * Route prefixes that belong to a pilot feature. Matched on whole path
 * segments, so `/campaigns-old` is not `/campaigns`. Longer prefixes win
 * (`/settings/ai` before anything a bare `/settings` might one day claim).
 */
export const PILOT_ROUTES: ReadonlyArray<{
  prefix: string;
  feature: PilotFeature;
}> = [
  { prefix: "/workflows", feature: "workflows" },
  { prefix: "/campaigns", feature: "emailCampaigns" },
  { prefix: "/segments", feature: "emailCampaigns" },
  { prefix: "/email-templates", feature: "emailCampaigns" },
  { prefix: "/ai-assistants", feature: "aiAssistant" },
  { prefix: "/settings/ai", feature: "aiAssistant" },
  { prefix: "/settings/integrations", feature: "integrations" },
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  if (pathname === prefix) return true;
  if (!pathname.startsWith(prefix)) return false;
  const next = pathname.charAt(prefix.length);
  return next === "/" || next === "?" || next === "#";
}

/** The pilot feature a pathname belongs to, or null for public routes. */
export function pilotFeatureForPath(pathname: string): PilotFeature | null {
  const clean = pathname.replace(/\/+$/, "") || "/";
  let best: { prefix: string; feature: PilotFeature } | null = null;
  for (const route of PILOT_ROUTES) {
    if (!pathMatchesPrefix(clean, route.prefix)) continue;
    if (!best || route.prefix.length > best.prefix.length) best = route;
  }
  return best?.feature ?? null;
}

export function isPilotFeatureEnabled(
  workspaceId: string | null | undefined
): boolean {
  return (
    import.meta.env.DEV ||
    (!!workspaceId && PILOT_WORKSPACE_IDS.has(workspaceId))
  );
}

/**
 * Which pilot features the current workspace may see.
 *
 * Returns a flag per feature rather than one boolean so each can be released
 * independently — the point is that they stop being a single switch the moment
 * one of them ships.
 */
export function usePilotFeatures(): Record<PilotFeature, boolean> {
  const { currentWorkspace } = useAuthContext();
  const enabled = isPilotFeatureEnabled(currentWorkspace?.id);

  return {
    workflows: enabled,
    emailSignature: enabled,
    integrations: enabled,
    emailCampaigns: enabled,
    aiAssistant: enabled,
  };
}
