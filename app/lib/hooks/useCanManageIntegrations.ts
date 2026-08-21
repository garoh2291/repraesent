import { useAuthContext } from "~/providers/auth-provider";

/**
 * Mirrors the server-side WorkspaceAdminGuard on the connect/disconnect routes.
 *
 * Stricter than useCanEditLeads/useCanEditForms on purpose: an integration is
 * the workspace's payment rail, and an editor swapping it out from under
 * everyone is not a mistake worth allowing.
 */
export function useCanManageIntegrations(): boolean {
  const { currentWorkspace } = useAuthContext();
  return currentWorkspace?.member_role === "admin";
}
