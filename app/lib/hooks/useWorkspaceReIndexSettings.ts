"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaceReIndexPageSeo,
  getSeoOptimizeStatus,
  optimizeSeoPage,
  regenerateWorkspaceReIndexSitemap,
  runSeoOptimize,
  type WpPluginSettingsGetResponse,
} from "~/lib/api/wordpress-hub";
import { pluginSettingsKey } from "./useWorkspacePluginSettings";
import type { ReTranslateBulkState } from "~/lib/wordpress/plugin-settings-types";

/**
 * re:index actions beyond the shared settings read/write, which live in
 * {@link useWorkspacePluginSettings}.
 */

/**
 * Rebuild the sitemap on the site and refresh the cached stats.
 *
 * Only the `stats` slice is merged into the cache: reseeding the whole settings
 * object would blow away whatever the user has typed into the open form.
 */
export function useWorkspaceReIndexRegenerateSitemap(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => regenerateWorkspaceReIndexSitemap(pluginUuid),
    onSuccess: (data) => {
      queryClient.setQueryData<WpPluginSettingsGetResponse>(
        pluginSettingsKey(pluginUuid),
        (prev) => ({
          found: true,
          settings: {
            ...asRecord(prev?.settings),
            stats: asRecord(data.settings).stats,
          },
        }),
      );
    },
  });
}

export function pageSeoKey(pluginUuid: string) {
  return ["wordpress", "re-index", "page-seo", pluginUuid] as const;
}

/** Read-only per-page SEO overview for the Page SEO tab. */
export function useWorkspaceReIndexPageSeo(
  pluginUuid: string,
  enabled = true,
) {
  return useQuery({
    queryKey: pageSeoKey(pluginUuid),
    queryFn: () => getWorkspaceReIndexPageSeo(pluginUuid),
    enabled: Boolean(pluginUuid) && enabled,
  });
}

export function seoOptimizeKey(pluginUuid: string) {
  return ["wordpress", "re-index", "seo-optimize", pluginUuid] as const;
}

const SEO_BULK_POLL_MS = 3_000;

function bulkIsActive(status: string | undefined): boolean {
  return status === "running" || status === "queued";
}

export function useSeoOptimizeStatus(
  pluginUuid: string,
  initial: ReTranslateBulkState | undefined,
) {
  return useQuery({
    queryKey: seoOptimizeKey(pluginUuid),
    queryFn: async () => {
      const res = await getSeoOptimizeStatus(pluginUuid);
      return res.bulk ?? null;
    },
    enabled: Boolean(pluginUuid),
    initialData: initial ?? null,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: (query) =>
      bulkIsActive(query.state.data?.status) ? SEO_BULK_POLL_MS : false,
    refetchIntervalInBackground: true,
  });
}

export function useRunSeoOptimize(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      mode,
    }: {
      action: "start" | "cancel";
      mode?: "empty_only" | "overwrite";
    }) => runSeoOptimize(pluginUuid, action, mode),
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: seoOptimizeKey(pluginUuid),
      });
    },
    onSuccess: (data) => {
      if (!data.bulk) return;
      queryClient.setQueryData(seoOptimizeKey(pluginUuid), data.bulk);
      queryClient.setQueryData<WpPluginSettingsGetResponse>(
        pluginSettingsKey(pluginUuid),
        (prev) => ({
          found: true,
          settings: {
            ...asRecord(prev?.settings),
            seo_bulk: data.bulk,
          },
        }),
      );
    },
  });
}

export function useOptimizeSeoPage(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      postId,
      mode,
    }: {
      postId: number;
      mode?: "empty_only" | "overwrite";
    }) => optimizeSeoPage(pluginUuid, postId, mode),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: pageSeoKey(pluginUuid) });
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
