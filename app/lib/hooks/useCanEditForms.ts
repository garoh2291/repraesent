import { useAuthContext } from "~/providers/auth-provider";

/**
 * Returns true if the current user can create and edit forms.
 * Viewers have read-only access; admins and editors can edit.
 * Mirrors the server-side WorkspaceEditorGuard.
 */
export function useCanEditForms(): boolean {
  const { currentWorkspace } = useAuthContext();
  return currentWorkspace?.member_role !== "viewer";
}
