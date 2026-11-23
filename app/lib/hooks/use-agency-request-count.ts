import { useQuery } from "@tanstack/react-query";
import { listAgencies, rootAgencyKeys } from "~/lib/api/agencies";
import { useAuthContext } from "~/providers/auth-provider";

/**
 * Root admins: how many businesses are waiting for an agency-mode decision.
 * Same cache as Settings → Agencies, so approving or rejecting there updates
 * every badge at once. 0 for everyone else (no request is made).
 */
export function useAgencyRequestCount(): number {
  const { currentWorkspace } = useAuthContext();
  const enabled = currentWorkspace?.is_root === true && currentWorkspace.member_role === "admin";
  const q = useQuery({
    queryKey: rootAgencyKeys.all,
    queryFn: listAgencies,
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  if (!enabled) return 0;
  return (q.data ?? []).filter((a) => a.status === "requested").length;
}
