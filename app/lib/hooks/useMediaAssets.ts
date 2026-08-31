"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { listMediaAssets, listMediaBin } from "~/lib/api/media";

const PAGE_SIZE = 40;

export type MediaView = "library" | "favorites" | "bin";

/**
 * Infinite image list from the workspace media library. One hook, three
 * views: library, favourites (server-side `favorites=true` filter) and the
 * recycle bin (its own endpoint). Pages append as the grid or picker scrolls
 * near the bottom; the view is part of the query key so switching views
 * never serves the other view's cache.
 */
export function useMediaAssetsInfinite(
  enabled: boolean,
  opts: { view?: MediaView; search: string; limit?: number },
) {
  const limit = opts.limit ?? PAGE_SIZE;
  const view = opts.view ?? "library";

  return useInfiniteQuery({
    queryKey: ["media-assets", view, limit, opts.search] as const,
    queryFn: ({ pageParam }) =>
      view === "bin"
        ? listMediaBin({ page: pageParam, limit, search: opts.search })
        : listMediaAssets({
            page: pageParam,
            limit,
            search: opts.search,
            ...(view === "favorites" ? { favorites: true } : {}),
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
