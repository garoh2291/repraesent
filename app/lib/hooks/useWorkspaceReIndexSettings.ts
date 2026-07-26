"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  regenerateWorkspaceReIndexSitemap,
  type WpPluginSettingsGetResponse,
} from "~/lib/api/wordpress-hub";
import { pluginSettingsKey } from "./useWorkspacePluginSettings";

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

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
