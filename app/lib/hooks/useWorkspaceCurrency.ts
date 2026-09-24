import { useQuery } from "@tanstack/react-query";
import { getWorkspaceCurrency, type DealCurrency } from "~/lib/api/deals";
import { useAuthContext } from "~/providers/auth-provider";

/** The workspace currency (new deals start in it; totals list it first). EUR while loading. */
export function useWorkspaceCurrency(): { currency: DealCurrency; available: boolean; currencies: DealCurrency[] } {
  const { currentWorkspace } = useAuthContext();
  const { data } = useQuery({
    queryKey: ["workspace-currency", currentWorkspace?.id],
    queryFn: getWorkspaceCurrency,
    enabled: !!currentWorkspace?.id,
    staleTime: 5 * 60_000,
  });
  return { currency: data?.currency ?? "EUR", available: data?.available ?? false, currencies: data?.currencies ?? ["EUR"] };
}
