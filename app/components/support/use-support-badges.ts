import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getQueueCounts, queueKeys, type QueueBase } from "~/lib/api/support-tickets";
import { useHelpAvailable } from "./help-provider";
import { usePollEvery } from "~/lib/api/support-live";

/**
 * Which support queue this person works in, if any: re:praesent's own (root
 * workspace) or their agency's, for its businesses (AGENCY_MODE_PLAN.md §7).
 * Agency people inside a business answer from the agency, never from there.
 */
export function useQueueBase(): QueueBase | null {
  const { currentWorkspace } = useAuthContext();
  if (!currentWorkspace) return null;
  if (currentWorkspace.is_root === true) return "root-support";
  if (currentWorkspace.agency?.status === "active" && !currentWorkspace.via_agency_id) return "agency-support";
  return null;
}

/**
 * The marker counts for Help & changes, in one place for the sidebar, the
 * phone tab bar and the menu sheet:
 *  - root workspace / agency: open tickets in the queue (they wait for the team)
 *  - customers: reports waiting for their reply
 */
export function useSupportBadges() {
  const base = useQueueBase();
  const every = usePollEvery(base, 60_000);
  const counts = useQuery({
    queryKey: queueKeys.counts(base ?? "root-support"),
    queryFn: () => getQueueCounts(base!),
    enabled: !!base,
    refetchInterval: every,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const help = useHelpAvailable();
  return {
    queueBase: base,
    isRoot: base === "root-support",
    queueOpen: base && counts.data?.ready ? counts.data.open : 0,
    helpAvailable: help.available,
    helpWaiting: help.waiting,
  };
}
