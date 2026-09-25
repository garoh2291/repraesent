"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { globalSearch } from "~/lib/api/search";
import { useDebounce } from "~/lib/hooks/useDebounce";

export function globalSearchKey(workspaceId: string | null, q: string) {
  return ["global-search", workspaceId, q] as const;
}

/** ⌘K search: debounced, only from 2 characters. */
export function useGlobalSearch(query: string) {
  const workspaceId = getStoredWorkspaceId();
  const q = useDebounce(query.trim(), 200);
  const enabled = !!workspaceId && q.length >= 2 && query.trim().length >= 2;
  const result = useQuery({
    queryKey: globalSearchKey(workspaceId, q),
    queryFn: ({ signal }) => globalSearch(q, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });
  // Never show results for a query that is no longer being searched (empty
  // or 1 character): keepPreviousData would otherwise keep old hits around.
  return { ...result, data: enabled ? result.data : undefined };
}
