import { useQuery } from "@tanstack/react-query";
import { listEmailAccountsForWorkspace } from "~/lib/api/email-accounts";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";

/**
 * True when this person can send from our own composer: an editor (the send
 * route is editor-only) with at least one mailbox that still works.
 *
 * Read-only on the shared ["workspace-email-accounts"] key — never invalidate
 * it from here. Both response shapes on that key carry `auth_failed_at`, the
 * only field read. While loading it reads false, so the mail app stays the
 * fallback rather than a click doing nothing.
 */
export function useCanSendEmail(): boolean {
  const canEdit = useCanEditLeads();
  const { data } = useQuery({
    queryKey: ["workspace-email-accounts"],
    queryFn: listEmailAccountsForWorkspace,
    enabled: canEdit,
    staleTime: 60_000,
  });
  return canEdit && (data ?? []).some((a) => !a.auth_failed_at);
}
