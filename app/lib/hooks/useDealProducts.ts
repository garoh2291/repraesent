import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  attachDealProduct,
  detachDealProduct,
  setDealProductQuantity,
  type DealDetailResponse,
  type DealProduct,
} from "~/lib/api/deals";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  applyProductsToDetail,
  dealValueOf,
  markDealListsStale,
  patchDealInLists,
  restoreSnapshots,
  type ListSnapshots,
} from "~/lib/deals/optimistic";

/** How long to wait after the last click before sending the quantity. */
const QUANTITY_DEBOUNCE_MS = 350;

interface PendingQuantity {
  timer: number;
  /** Bumped per request; a response only applies if it is still the latest. */
  seq: number;
  /** Cache state before the first optimistic step of this burst. */
  snapshot: { detail: DealDetailResponse | undefined; lists: ListSnapshots } | null;
}

export type OptimisticLine = Omit<
  DealProduct,
  "id" | "stripe_price_id" | "quantity" | "line_total" | "created_at"
>;

/**
 * The three line-item mutations, all optimistic.
 *
 * Quantity is the interesting one. Every click updates the cached deal at once
 * (quantity, line total, deal value, the Kanban card) and restarts a short
 * timer; only the final quantity of a burst is sent, and a response is applied
 * only if no newer request went out after it. On failure the whole burst rolls
 * back to the state before its first click.
 *
 * Nothing here refetches the 500-row pipeline: list caches are patched in
 * place and merely marked stale for their next mount.
 */
export function useDealProductMutations(dealId: string) {
  const queryClient = useQueryClient();
  const dealKey = ["deal", dealId] as const;
  const pending = useRef(new Map<string, PendingQuantity>());

  const settle = useCallback(() => {
    markDealListsStale(queryClient);
    void queryClient.invalidateQueries({
      queryKey: ["deal-history", dealId],
      refetchType: "none",
    });
  }, [queryClient, dealId]);

  const setQuantity = useCallback(
    (line: DealProduct, quantity: number) => {
      void queryClient.cancelQueries({ queryKey: dealKey });

      const entry: PendingQuantity = pending.current.get(line.id) ?? {
        timer: 0,
        seq: 0,
        snapshot: null,
      };
      const prev = queryClient.getQueryData<DealDetailResponse>(dealKey);
      if (!entry.snapshot) entry.snapshot = { detail: prev, lists: [] };

      if (prev) {
        const next = applyProductsToDetail(
          prev,
          prev.products.map((p) =>
            p.id === line.id ? { ...p, quantity } : p,
          ),
        );
        queryClient.setQueryData(dealKey, next);
        entry.snapshot.lists.push(
          ...patchDealInLists(queryClient, dealId, {
            value: dealValueOf(next),
          }),
        );
      }

      window.clearTimeout(entry.timer);
      entry.timer = window.setTimeout(async () => {
        const seq = ++entry.seq;
        try {
          const detail = await setDealProductQuantity(
            dealId,
            line.id,
            quantity,
          );
          if (entry.seq !== seq) return;
          queryClient.setQueryData(dealKey, detail);
          pending.current.delete(line.id);
        } catch (err) {
          if (entry.seq !== seq) return;
          const snap = entry.snapshot;
          if (snap?.detail) queryClient.setQueryData(dealKey, snap.detail);
          if (snap) restoreSnapshots(queryClient, snap.lists);
          pending.current.delete(line.id);
          toast.error(extractErrorMessage(err));
        } finally {
          if (entry.seq === seq) settle();
        }
      }, QUANTITY_DEBOUNCE_MS);

      pending.current.set(line.id, entry);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, dealId, settle],
  );

  // A burst still waiting when the panel unmounts must not be lost: fire it
  // now rather than leaving the server behind the cache.
  useEffect(() => {
    const map = pending.current;
    return () => {
      for (const [lineId, entry] of map) {
        if (!entry.timer) continue;
        window.clearTimeout(entry.timer);
        const detail = queryClient.getQueryData<DealDetailResponse>(dealKey);
        const line = detail?.products.find((p) => p.id === lineId);
        if (line) {
          void setDealProductQuantity(dealId, lineId, line.quantity).catch(
            () => undefined,
          );
        }
      }
      map.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);

  const attach = useMutation({
    mutationFn: ({
      priceId,
      quantity,
    }: {
      priceId: string;
      quantity: number;
      optimistic: OptimisticLine;
    }) => attachDealProduct(dealId, priceId, quantity),
    onMutate: async ({ priceId, quantity, optimistic }) => {
      await queryClient.cancelQueries({ queryKey: dealKey });
      const previous = queryClient.getQueryData<DealDetailResponse>(dealKey);
      let lists: ListSnapshots = [];
      if (previous) {
        const existing = previous.products.find(
          (p) => p.stripe_price_id === priceId,
        );
        const nextProducts = existing
          ? previous.products.map((p) =>
              p.id === existing.id
                ? { ...p, quantity: p.quantity + quantity }
                : p,
            )
          : [
              ...previous.products,
              {
                ...optimistic,
                id: `temp-${priceId}`,
                stripe_price_id: priceId,
                quantity,
                line_total: null,
                created_at: new Date().toISOString(),
              },
            ];
        const next = applyProductsToDetail(previous, nextProducts);
        queryClient.setQueryData(dealKey, next);
        lists = patchDealInLists(queryClient, dealId, {
          value: dealValueOf(next),
        });
      }
      return { previous, lists };
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(dealKey, detail);
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(dealKey, ctx.previous);
      if (ctx?.lists) restoreSnapshots(queryClient, ctx.lists);
      toast.error(extractErrorMessage(err));
    },
    onSettled: settle,
  });

  const detach = useMutation({
    mutationFn: (line: DealProduct) => detachDealProduct(dealId, line.id),
    onMutate: async (line) => {
      await queryClient.cancelQueries({ queryKey: dealKey });
      const previous = queryClient.getQueryData<DealDetailResponse>(dealKey);
      let lists: ListSnapshots = [];
      if (previous) {
        const next = applyProductsToDetail(
          previous,
          previous.products.filter((p) => p.id !== line.id),
        );
        queryClient.setQueryData(dealKey, next);
        lists = patchDealInLists(queryClient, dealId, {
          value: dealValueOf(next),
        });
      }
      return { previous, lists };
    },
    onSuccess: (detail) => {
      queryClient.setQueryData(dealKey, detail);
    },
    onError: (err, _line, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(dealKey, ctx.previous);
      if (ctx?.lists) restoreSnapshots(queryClient, ctx.lists);
      toast.error(extractErrorMessage(err));
    },
    onSettled: settle,
  });

  return { setQuantity, attach, detach };
}
