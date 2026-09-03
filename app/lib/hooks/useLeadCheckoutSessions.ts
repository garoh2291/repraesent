import { useQuery } from "@tanstack/react-query";
import { getLeadCheckoutSessions } from "~/lib/api/lead-checkout";

export const leadCheckoutSessionsKey = (leadId: string) =>
  ["lead-checkout-sessions", leadId] as const;

/**
 * The sessions behind a lead's payment block. Callers pass `enabled` only when
 * the lead actually carries checkout metadata, so ordinary leads never fetch.
 */
export function useLeadCheckoutSessions(
  leadId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: leadCheckoutSessionsKey(leadId ?? ""),
    queryFn: () => getLeadCheckoutSessions(leadId!),
    enabled: enabled && !!leadId,
    staleTime: 30_000,
  });
}
