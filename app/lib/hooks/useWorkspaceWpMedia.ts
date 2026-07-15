"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { getWorkspaceWpMedia } from "~/lib/api/wordpress-hub";

const PAGE_SIZE = 24;

/**
 * Infinite image list from the workspace WordPress media library.
 * Pages append as the picker scrolls near the bottom.
 */
export function useWorkspaceWpMediaInfinite(
  enabled: boolean,
  opts: { search: string; limit?: number },
) {
  const limit = opts.limit ?? PAGE_SIZE;

  return useInfiniteQuery({
    queryKey: ["workspace-wp-media-infinite", limit, opts.search] as const,
    queryFn: ({ pageParam }) =>
      getWorkspaceWpMedia({
        page: pageParam,
        limit,
        search: opts.search,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const loaded = last.page * last.limit;
      return loaded < last.total ? last.page + 1 : undefined;
    },
    enabled,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
