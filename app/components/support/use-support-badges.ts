import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { getQueueCounts, queueKeys } from "~/lib/api/support-tickets";
import { useHelpAvailable } from "./help-provider";

/**
 * The marker counts for Help & changes, in one place for the sidebar, the
 * phone tab bar and the menu sheet:
 *  - root workspace: open tickets (they wait for the team)
 *  - customers: reports waiting for their reply
 */
export function useSupportBadges() {
  const { currentWorkspace } = useAuthContext();
  const isRoot = currentWorkspace?.is_root === true;
  const counts = useQuery({
    queryKey: queueKeys.counts,
    queryFn: getQueueCounts,
    enabled: isRoot,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const help = useHelpAvailable();
  return {
    isRoot,
    queueOpen: isRoot && counts.data?.ready ? counts.data.open : 0,
    helpAvailable: help.available,
    helpWaiting: help.waiting,
  };
}
