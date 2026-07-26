"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import {
  clearWorkspaceReReviewCache,
  testFetchWorkspaceReReview,
  type WpPluginSettingsGetResponse,
} from "~/lib/api/wordpress-hub";
import { pluginSettingsKey } from "./useWorkspacePluginSettings";

/**
 * re:reviews actions beyond the shared settings read/write, which live in
 * {@link useWorkspacePluginSettings}. Both of these mutate the cache transient
 * on the site, so both reseed the settings entry from the server's response.
 */

function writeCache(
  queryClient: QueryClient,
  pluginUuid: string,
  settings: Record<string, unknown>,
) {
  queryClient.setQueryData<WpPluginSettingsGetResponse>(
    pluginSettingsKey(pluginUuid),
    { found: true, settings },
  );
}

/** Live Google Places fetch into the WordPress cache transient. */
export function useWorkspaceReReviewTestFetch(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => testFetchWorkspaceReReview(pluginUuid),
    onSuccess: (data) => writeCache(queryClient, pluginUuid, data.settings),
  });
}

/** Wipe the re:reviews cache transient. */
export function useWorkspaceReReviewClearCache(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearWorkspaceReReviewCache(pluginUuid),
    onSuccess: (data) => writeCache(queryClient, pluginUuid, data.settings),
  });
}
