import { useAuthContext } from "~/providers/auth-provider";
import { useSupportLive } from "~/lib/api/support-live";
import { useHelpAvailable } from "./help-provider";
import { useQueueBase } from "./use-support-badges";

/**
 * Opens the live update streams this person needs, once for the whole app:
 * their own reports (Help & changes) and, for re:praesent or an agency, the
 * queue they answer. Renders nothing.
 */
export function SupportLive() {
  const { currentWorkspace } = useAuthContext();
  const { available } = useHelpAvailable();
  const base = useQueueBase();
  useSupportLive(available ? "help" : null, currentWorkspace?.id);
  useSupportLive(base, currentWorkspace?.id);
  return null;
}
