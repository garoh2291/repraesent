import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaceWebsiteOverview,
  refreshWorkspaceWebsitePreview,
} from "~/lib/api/wordpress-hub";

export const OVERVIEW_KEY = "workspace-wp-site-overview";
const KEY = OVERVIEW_KEY;

/**
 * Ask again every 5 s while a picture is being taken; after 90 s (it is
 * waiting behind others) every 20 s, so the new picture still shows up
 * without a reload.
 */
const POLL_MS = 5_000;
const POLL_FOR_MS = 90_000;
const SLOW_POLL_MS = 20_000;

/** Since when each site's picture has been "taking", to stop asking in time. */
const takingSince = new Map<string, number>();

/**
 * Picture, dates and coming-soon state of the open site (Website › Overview).
 * Keyed by the site id, so a site switch never shows the other site's picture.
 */
export function useWorkspaceWebsiteOverview(siteId: string | undefined) {
  return useQuery({
    queryKey: [KEY, siteId],
    // Names the site itself, so the answer always belongs to its key.
    queryFn: () => getWorkspaceWebsiteOverview(siteId),
    enabled: !!siteId,
    staleTime: 60_000,
    refetchInterval: (query) => {
      if (!siteId) return false;
      if (query.state.data?.preview.state !== "taking") {
        takingSince.delete(siteId);
        return false;
      }
      const since = takingSince.get(siteId) ?? Date.now();
      takingSince.set(siteId, since);
      return Date.now() - since < POLL_FOR_MS ? POLL_MS : SLOW_POLL_MS;
    },
  });
}

/** "Refresh" under the picture. */
export function useRefreshWebsitePreview(siteId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: refreshWorkspaceWebsitePreview,
    onSuccess: () => {
      if (siteId) takingSince.delete(siteId);
      void qc.invalidateQueries({ queryKey: [KEY, siteId] });
    },
  });
}

/**
 * Loads these sites' overviews in the background (Website › Production and
 * › Staging), so switching between them shows the picture at once.
 */
export function usePreloadWebsiteOverviews(siteIds: string[]) {
  const qc = useQueryClient();
  const ids = siteIds.join(",");
  useEffect(() => {
    for (const id of ids ? ids.split(",") : []) {
      void qc.prefetchQuery({
        queryKey: [KEY, id],
        queryFn: () => getWorkspaceWebsiteOverview(id),
        staleTime: 60_000,
      });
    }
  }, [qc, ids]);
}
