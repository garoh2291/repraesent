import { useAuthContext } from "~/providers/auth-provider";

/**
 * Mirrors the server-side WorkspaceAdminGuard on the notification-channel
 * mutation routes. A webhook URL posts into the team's chat — an editor
 * silently repointing it is not a mistake worth allowing, same reasoning as
 * useCanManageIntegrations.
 */
export function useCanManageNotifications(): boolean {
  const { currentWorkspace } = useAuthContext();
  return currentWorkspace?.member_role === "admin";
}
