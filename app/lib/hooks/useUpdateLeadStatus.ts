"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import {
  reorderLead,
  updateLeadStatus,
  type Lead,
  type LeadStatus,
  type PaginatedLeads,
} from "~/lib/api/leads";
import type { PipelineStage } from "~/lib/api/pipeline-stages";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { pipelineStagesKey } from "./usePipelineStages";

/**
 * Whether a status key is a won-category stage, read from the cached stage
 * config (any screen offering a status change has it loaded). Falls back to
 * the legacy literal so a cold cache can't swallow the conversion follow-up.
 */
function isWonLeadStage(queryClient: QueryClient, status: string): boolean {
  const stages = queryClient.getQueryData<PipelineStage[]>(
    pipelineStagesKey(getStoredWorkspaceId()),
  );
  const stage = stages?.find((s) => s.entity === "lead" && s.key === status);
  return stage ? stage.category === "won" : status === "success";
}

export interface UpdateLeadStatusVariables {
  id: string;
  status: LeadStatus;
}

export interface UseUpdateLeadStatusOptions {
  onMutate?: (variables: UpdateLeadStatusVariables) => Promise<unknown>;
  onError?: (
    err: Error,
    variables: UpdateLeadStatusVariables,
    context: unknown
  ) => void;
  /** Fires after cache invalidation when status becomes `success` (e.g. won / closed in pipeline). */
  onConvertedToSuccess?: (lead: Lead) => void | Promise<void>;
}

export function useUpdateLeadStatus(opts?: UseUpdateLeadStatusOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: UpdateLeadStatusVariables) =>
      updateLeadStatus(id, status),
    onMutate: opts?.onMutate,
    onSuccess: async (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban-column"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban-counts"] });
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] });
      queryClient.invalidateQueries({
        queryKey: ["lead-history", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (isWonLeadStage(queryClient, variables.status)) {
        await opts?.onConvertedToSuccess?.(data);
      }
    },
    onError: opts?.onError,
  });
}

export interface ReorderLeadVariables {
  id: string;
  status: LeadStatus;
  position: number;
}

interface ReorderSnapshots {
  columns: [readonly unknown[], unknown][];
  counts: [readonly unknown[], unknown][];
  table: [readonly unknown[], unknown][];
}

function sortByBoardPosition(a: Lead, b: Lead): number {
  const ap = a.board_position;
  const bp = b.board_position;
  if (ap == null && bp == null) {
    return (b.created_at ?? "").localeCompare(a.created_at ?? "");
  }
  if (ap == null) return 1;
  if (bp == null) return -1;
  return ap - bp;
}

export function useReorderLead(opts?: {
  onConvertedToSuccess?: (lead: Lead) => void | Promise<void>;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, position }: ReorderLeadVariables) =>
      reorderLead(id, status, position),
    /**
     * Optimistically rearranges every cached view of this lead — the per-column
     * infinite queries, the table list, and the column header counts — so the
     * card lands instantly without waiting for the network round-trip.
     */
    onMutate: async ({ id, status, position }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ["leads"] }),
        queryClient.cancelQueries({ queryKey: ["leads-kanban-column"] }),
        queryClient.cancelQueries({ queryKey: ["leads-kanban-counts"] }),
      ]);

      const snapshots: ReorderSnapshots = {
        columns: queryClient.getQueriesData({
          queryKey: ["leads-kanban-column"],
        }),
        counts: queryClient.getQueriesData({
          queryKey: ["leads-kanban-counts"],
        }),
        table: queryClient.getQueriesData({ queryKey: ["leads"] }),
      };

      type ColumnData = InfiniteData<PaginatedLeads>;

      // Pull the moved lead out of whichever column currently holds it.
      let moved: Lead | undefined;
      let oldStatus: string | undefined;
      for (const [, data] of snapshots.columns as [
        unknown,
        ColumnData | undefined,
      ][]) {
        for (const page of data?.pages ?? []) {
          const found = page.data.find((l) => l.id === id);
          if (found) {
            moved = found;
            oldStatus = found.status;
            break;
          }
        }
        if (moved) break;
      }
      if (!moved) {
        return snapshots;
      }
      const patched: Lead = { ...moved, status, board_position: position };

      for (const [key] of snapshots.columns as [
        unknown[],
        ColumnData | undefined,
      ][]) {
        const colStatus = key[1] as string;
        if (colStatus !== status && colStatus !== oldStatus) continue;

        queryClient.setQueryData<ColumnData>(key as never, (old) => {
          if (!old) return old;
          // First remove the moved card from every page.
          const cleaned = old.pages.map((p) => ({
            ...p,
            data: p.data.filter((l) => l.id !== id),
            total:
              p.data.some((l) => l.id === id) && colStatus === oldStatus
                ? Math.max(0, p.total - 1)
                : p.total,
          }));
          if (colStatus !== status) {
            return { ...old, pages: cleaned };
          }
          // Insert into the target column at the sorted spot.
          if (cleaned.length === 0) return { ...old, pages: cleaned };
          const firstPage = cleaned[0];
          const nextFirst = {
            ...firstPage,
            data: [...firstPage.data, patched].sort(sortByBoardPosition),
            total:
              colStatus === oldStatus ? firstPage.total : firstPage.total + 1,
          };
          return { ...old, pages: [nextFirst, ...cleaned.slice(1)] };
        });
      }

      // Header counts — only shift if the column actually changed.
      if (oldStatus && oldStatus !== status) {
        queryClient.setQueriesData(
          { queryKey: ["leads-kanban-counts"] },
          (old: Record<string, number> | undefined) => {
            if (!old) return old;
            const next = { ...old };
            if (typeof next[oldStatus] === "number")
              next[oldStatus] = Math.max(0, next[oldStatus] - 1);
            next[status] =
              (typeof next[status] === "number" ? next[status] : 0) + 1;
            return next;
          },
        );
      }

      // Table view (non-kanban) — patch the row in place.
      queryClient.setQueriesData(
        { queryKey: ["leads"] },
        (old: PaginatedLeads | undefined) => {
          if (!old || !Array.isArray(old.data)) return old;
          return {
            ...old,
            data: old.data.map((l) =>
              l.id === id
                ? { ...l, status, board_position: position }
                : l,
            ),
          };
        },
      );

      return snapshots;
    },
    onError: (_err, _vars, ctx) => {
      const snap = ctx as ReorderSnapshots | undefined;
      if (!snap) return;
      for (const group of [snap.columns, snap.counts, snap.table]) {
        for (const [key, data] of group) {
          queryClient.setQueryData(key as never, data as never);
        }
      }
    },
    onSuccess: async (data, variables) => {
      // Background refresh — does not block the UI since the cache is already
      // in the desired state. Refetches reconcile any divergence (e.g. another
      // user reordering in parallel).
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban-column"] });
      queryClient.invalidateQueries({ queryKey: ["leads-kanban-counts"] });
      queryClient.invalidateQueries({ queryKey: ["lead", variables.id] });
      queryClient.invalidateQueries({
        queryKey: ["lead-history", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      if (isWonLeadStage(queryClient, variables.status)) {
        await opts?.onConvertedToSuccess?.(data);
      }
    },
  });
}
