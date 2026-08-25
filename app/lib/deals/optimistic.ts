import type { QueryClient } from "@tanstack/react-query";
import type {
  DealDetailResponse,
  DealListItem,
  DealProduct,
  PaginatedDeals,
} from "~/lib/api/deals";

/**
 * Optimistic-cache helpers shared by the pipeline board, the deal page and the
 * deal side panels. One implementation, so every surface patches the same
 * caches the same way and rolls back the same way.
 */

export type ListSnapshots = Array<[readonly unknown[], unknown]>;

/**
 * Patch one deal inside every cached pipeline board and contact-deals list so
 * the Kanban card and the contact page reflect the change the moment the user
 * navigates back, without waiting for a refetch. Returns what was there, for
 * `restoreSnapshots`.
 */
export function patchDealInLists(
  queryClient: QueryClient,
  dealId: string,
  patch: Partial<DealListItem>,
): ListSnapshots {
  const snapshots: ListSnapshots = [];
  const now = new Date().toISOString();

  const boards = queryClient.getQueriesData<PaginatedDeals>({
    queryKey: ["deals-pipeline"],
  });
  for (const [key, value] of boards) {
    snapshots.push([key, value]);
    if (!value) continue;
    queryClient.setQueryData<PaginatedDeals>(key, {
      ...value,
      data: value.data.map((d) =>
        d.id === dealId ? { ...d, ...patch, updated_at: now } : d,
      ),
    });
  }

  const contactLists = queryClient.getQueriesData<DealListItem[]>({
    queryKey: ["contact-deals"],
  });
  for (const [key, value] of contactLists) {
    snapshots.push([key, value]);
    if (!value) continue;
    queryClient.setQueryData<DealListItem[]>(
      key,
      value.map((d) =>
        d.id === dealId ? { ...d, ...patch, updated_at: now } : d,
      ),
    );
  }

  return snapshots;
}

/**
 * Remove one deal from every cached board and contact-deals list — the
 * optimistic shape of a delete. Returns snapshots for `restoreSnapshots`.
 */
export function removeDealFromLists(
  queryClient: QueryClient,
  dealId: string,
): ListSnapshots {
  const snapshots: ListSnapshots = [];

  const boards = queryClient.getQueriesData<PaginatedDeals>({
    queryKey: ["deals-pipeline"],
  });
  for (const [key, value] of boards) {
    snapshots.push([key, value]);
    if (!value?.data?.some((d) => d.id === dealId)) continue;
    queryClient.setQueryData<PaginatedDeals>(key, {
      ...value,
      data: value.data.filter((d) => d.id !== dealId),
      total: Math.max(0, value.total - 1),
    });
  }

  const contactLists = queryClient.getQueriesData<DealListItem[]>({
    queryKey: ["contact-deals"],
  });
  for (const [key, value] of contactLists) {
    snapshots.push([key, value]);
    if (!value) continue;
    queryClient.setQueryData<DealListItem[]>(
      key,
      value.filter((d) => d.id !== dealId),
    );
  }

  return snapshots;
}

/**
 * The optimistic shape of a cross-pipeline move: the deal disappears from the
 * source pipeline's board caches (keyed ["deals-pipeline", <pipelineId>, …])
 * and gets its pipeline_id patched everywhere else — other boards, the
 * home-summary cache and contact-deals lists all keep showing it. One pass, so
 * every cache key is snapshotted exactly once for `restoreSnapshots`.
 */
export function moveDealBetweenPipelinesInLists(
  queryClient: QueryClient,
  dealId: string,
  fromPipelineId: string,
  targetPipelineId: string,
): ListSnapshots {
  const snapshots: ListSnapshots = [];
  const now = new Date().toISOString();

  const boards = queryClient.getQueriesData<PaginatedDeals>({
    queryKey: ["deals-pipeline"],
  });
  for (const [key, value] of boards) {
    snapshots.push([key, value]);
    if (!value) continue;
    if (key[1] === fromPipelineId) {
      if (!value.data?.some((d) => d.id === dealId)) continue;
      queryClient.setQueryData<PaginatedDeals>(key, {
        ...value,
        data: value.data.filter((d) => d.id !== dealId),
        total: Math.max(0, value.total - 1),
      });
    } else {
      queryClient.setQueryData<PaginatedDeals>(key, {
        ...value,
        data: value.data.map((d) =>
          d.id === dealId
            ? { ...d, pipeline_id: targetPipelineId, updated_at: now }
            : d,
        ),
      });
    }
  }

  const contactLists = queryClient.getQueriesData<DealListItem[]>({
    queryKey: ["contact-deals"],
  });
  for (const [key, value] of contactLists) {
    snapshots.push([key, value]);
    if (!value) continue;
    queryClient.setQueryData<DealListItem[]>(
      key,
      value.map((d) =>
        d.id === dealId
          ? { ...d, pipeline_id: targetPipelineId, updated_at: now }
          : d,
      ),
    );
  }

  return snapshots;
}

export function restoreSnapshots(
  queryClient: QueryClient,
  snapshots: ListSnapshots,
): void {
  for (const [key, value] of snapshots) {
    queryClient.setQueryData(key, value);
  }
}

/**
 * Mark the list caches stale without refetching them now. They were already
 * patched optimistically; the next mount of the board picks up the server's
 * version, and nothing re-downloads 500 deals because a quantity changed.
 */
export function markDealListsStale(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({
    queryKey: ["deals-pipeline"],
    refetchType: "none",
  });
  void queryClient.invalidateQueries({
    queryKey: ["contact-deals"],
    refetchType: "none",
  });
}

/** Recompute each line's total from its unit amount and quantity. */
export function recomputeLines(products: DealProduct[]): DealProduct[] {
  return products.map((p) => ({
    ...p,
    line_total: p.unit_amount === null ? null : p.unit_amount * p.quantity,
  }));
}

/** Null when any line's amount is unknown — a partial sum is a wrong number. */
export function subtotalOf(products: DealProduct[]): number | null {
  if (!products.length) return null;
  if (products.some((p) => p.line_total === null)) return null;
  return products.reduce((sum, p) => sum + (p.line_total ?? 0), 0);
}

/**
 * A new detail payload with the given lines and the deal value the server
 * would derive from them (sum of all lines, one period). Mirrors
 * `recalculateDealValue` on the backend, including "leave the value alone when
 * the last line goes".
 */
export function applyProductsToDetail(
  prev: DealDetailResponse,
  products: DealProduct[],
): DealDetailResponse {
  const lines = recomputeLines(products);
  const subtotal = subtotalOf(lines);
  const deal =
    subtotal === null
      ? prev.deal
      : {
          ...prev.deal,
          value: (subtotal / 100).toFixed(2),
          updated_at: new Date().toISOString(),
        };
  return { ...prev, deal, products: lines };
}

/** The deal value as the list caches store it (string major units). */
export function dealValueOf(detail: DealDetailResponse): string | null {
  const v = detail.deal.value;
  return v == null || v === "" ? null : String(v);
}
