import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getCatalogAccount,
  getCatalogProduct,
  listCatalogProducts,
  searchStripeCustomers,
  type CatalogList,
  type CatalogProduct,
} from "~/lib/api/stripe-catalog";

/**
 * Every catalogue query is a live Stripe call, so `retry: false` — a
 * disconnected workspace answers 409 on all of them and retrying three times
 * only delays the empty state.
 *
 * Keys omit the workspace id like every other query here — switching
 * workspaces invalidates everything except ["auth"] in use-auth.ts.
 */
export function useCatalogAccount(enabled = true) {
  return useQuery({
    queryKey: ["stripe-account"],
    queryFn: getCatalogAccount,
    enabled,
    retry: false,
  });
}

/**
 * The whole catalogue, classified. The backend caches it for a minute per
 * account, so the same staleTime here keeps the two in step: within the
 * window no request is made at all, after it one request returns either the
 * cached snapshot or a fresh one.
 */
export function useStripeCatalog(
  { includeArchived = false }: { includeArchived?: boolean } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: ["stripe-catalog", includeArchived],
    queryFn: () => listCatalogProducts({ include_archived: includeArchived }),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/** Server search — the fallback for catalogues too large to load whole. */
export function useStripeCatalogSearch(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ["stripe-catalog-search", search],
    queryFn: () => listCatalogProducts({ search }),
    enabled: enabled && search.trim().length > 0,
    retry: false,
    staleTime: 30_000,
  });
}

/**
 * One product with every price, archived ones included. Seeded from the
 * catalogue cache so the details sheet opens instantly, then refreshed.
 */
export function useCatalogProduct(productId: string | null) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["stripe-product", productId],
    queryFn: () => getCatalogProduct(productId!),
    enabled: !!productId,
    retry: false,
    placeholderData: () => {
      if (!productId) return undefined;
      const lists = queryClient.getQueriesData<CatalogList>({
        queryKey: ["stripe-catalog"],
      });
      for (const [, list] of lists) {
        const hit = list?.data.find((p: CatalogProduct) => p.id === productId);
        if (hit) return hit;
      }
      return undefined;
    },
  });
}

export function useStripeCustomerSearch(search: string, enabled: boolean) {
  return useQuery({
    queryKey: ["stripe-customers", search],
    queryFn: () => searchStripeCustomers(search),
    enabled,
    retry: false,
    staleTime: 30_000,
  });
}
