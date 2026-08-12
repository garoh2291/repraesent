import { useQuery } from "@tanstack/react-query";
import {
  getCatalogAccount,
  getCatalogProduct,
  listCatalogProducts,
  listTaxCodes,
  type ListProductsParams,
} from "~/lib/api/stripe-catalog";

/**
 * Every catalogue query is a live Stripe call, so `retry: false` — a
 * disconnected workspace answers 409 on all of them and retrying three times
 * only delays the empty state.
 */
export function useCatalogAccount(enabled = true) {
  return useQuery({
    queryKey: ["stripe-account"],
    queryFn: getCatalogAccount,
    enabled,
    retry: false,
  });
}

export function useCatalogProducts(
  params: ListProductsParams,
  enabled = true,
) {
  return useQuery({
    queryKey: [
      "stripe-products",
      params.search ?? "",
      params.active ?? "",
      params.starting_after ?? "",
    ],
    queryFn: () => listCatalogProducts(params),
    enabled,
    retry: false,
    // The catalogue can be edited in the Stripe dashboard at the same time, so
    // a stale list is worse here than one extra request.
    staleTime: 0,
  });
}

export function useCatalogProduct(productId: string | null) {
  return useQuery({
    queryKey: ["stripe-product", productId],
    queryFn: () => getCatalogProduct(productId!),
    enabled: !!productId,
    retry: false,
  });
}

/** ~600 static rows; the backend caches them in memory after the first call. */
export function useTaxCodes(enabled = false) {
  return useQuery({
    queryKey: ["stripe-tax-codes"],
    queryFn: listTaxCodes,
    enabled,
    retry: false,
    staleTime: 60 * 60 * 1000,
  });
}
