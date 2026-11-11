import { useAuthContext } from "~/providers/auth-provider";

/**
 * Workspaces allowed to see features that are still being piloted (today
 * only Google review asks).
 * `0941b49b-…` is re:praesent, our own workspace; `4681cb1b-…` is the first
 * customer pilot; `afef2cc9-…` is Küchenwelten Trossingen (added 2026-10-28).
 * Keep in step with nestjs-monolith `common/pilot-workspaces.ts`.
 */
export const PILOT_WORKSPACE_IDS: ReadonlySet<string> = new Set([
  "0941b49b-edaa-44bb-8d6f-8f6decd10502",
  "4681cb1b-32d1-47cf-909b-29b2a63ffff3",
  // Küchenwelten Trossingen (2026-10-28).
  "afef2cc9-b5b3-4c4a-9cd5-58e1be2d8a2a",
]);

/**
 * Feature flags (2026-11-12): every feature is released to every workspace —
 * workflows, Connected apps (integrations), email campaigns, the website AI
 * assistant and Appointments. No "Demo" pills, no route gate.
 *
 * Only Google review asks stay a pilot: they call the Google Places API (paid)
 * and put a review link on the public deal-tracking page. The API enforces it
 * too (nestjs-monolith `common/pilot-workspaces.ts`).
 */
export type PilotFeature = "googleReviews";

/** Released features — always on. Kept as names so callers read naturally. */
export type ReleasedFeature = "workflows" | "integrations" | "emailCampaigns" | "aiAssistant" | "appointmentBook";

/** Whether a pilot feature is on for this workspace (development: always). */
export function isPilotFeatureEnabled(workspaceId: string | null | undefined, feature: PilotFeature): boolean {
  if (import.meta.env.DEV) return true;
  if (!workspaceId) return false;
  return feature === "googleReviews" && PILOT_WORKSPACE_IDS.has(workspaceId);
}

/** Which features the current workspace may see: everything, Google reviews only for pilots. */
export function usePilotFeatures(): Record<PilotFeature | ReleasedFeature, boolean> {
  const { currentWorkspace } = useAuthContext();
  return {
    workflows: true,
    integrations: true,
    emailCampaigns: true,
    aiAssistant: true,
    appointmentBook: true,
    googleReviews: isPilotFeatureEnabled(currentWorkspace?.id, "googleReviews"),
  };
}
