import { useAuthContext } from "~/providers/auth-provider";

/**
 * Workspace allowed to see features that are still being piloted.
 * `0941b49b-…` is re:praesent, our own workspace.
 */
const PILOT_WORKSPACE_ID = "0941b49b-edaa-44bb-8d6f-8f6decd10502";

/**
 * Pilot features: on in development, and in production only for our own
 * workspace.
 *
 * **These hide UI; they are not a permission boundary.** The routes stay
 * reachable by URL and every endpoint behind them is unchanged, so nothing here
 * should be relied on to keep anyone out of anything. Deleting a flag once its
 * feature ships to everyone is the intended end state.
 */
export type PilotFeature =
  /** Workflow builder. */
  | "workflows"
  /** Per-mailbox signature editing in Settings, and its notice in the composer. */
  | "emailSignature"
  /** The Calendar page and the Calendars settings section. */
  | "calendar"
  /** The appointment (booking) field in the forms builder palette. */
  | "formsAppointmentField";

export function isPilotFeatureEnabled(
  workspaceId: string | null | undefined,
): boolean {
  return import.meta.env.DEV || workspaceId === PILOT_WORKSPACE_ID;
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
    calendar: enabled,
    formsAppointmentField: enabled,
  };
}
