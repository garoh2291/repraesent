import { useAuthContext } from "~/providers/auth-provider";

/**
 * Returns true if the current user can edit leads (status, notes, etc).
 * Viewers have read-only access; admins and editors can edit.
 */
export function useCanEditLeads(): boolean {
  const { currentWorkspace } = useAuthContext();
  return currentWorkspace?.member_role !== "viewer";
}
