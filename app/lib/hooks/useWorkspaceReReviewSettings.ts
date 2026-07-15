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
  settings: Record<string, unknown>,
) {
  queryClient.setQueryData<WpPluginSettingsGetResponse>(
    pluginSettingsKey("re-review"),
    { found: true, settings },
  );
}

/** Live Google Places fetch into the WordPress cache transient. */
export function useWorkspaceReReviewTestFetch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: testFetchWorkspaceReReview,
    onSuccess: (data) => writeCache(queryClient, data.settings),
  });
}

/** Wipe the re:reviews cache transient. */
export function useWorkspaceReReviewClearCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearWorkspaceReReviewCache,
    onSuccess: (data) => writeCache(queryClient, data.settings),
  });
}
