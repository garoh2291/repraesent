"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaceWpPlugins,
  setWorkspaceWpPluginActive,
  type WpPluginListResponse,
} from "~/lib/api/wordpress-hub";

const PLUGINS_KEY = ["workspace-wp-plugins"] as const;

/**
 * Plugins installed on the current workspace's WordPress site. Should only be
 * enabled once we know the workspace actually has a site (the endpoint 404s
 * otherwise), so callers gate it on the site query.
 */
export function useWorkspaceWpPlugins(enabled: boolean) {
  return useQuery({
    queryKey: PLUGINS_KEY,
    queryFn: getWorkspaceWpPlugins,
    enabled,
    // Reading wp_options over SSH is comparatively expensive; don't refetch on
    // every window focus.
    staleTime: 30_000,
  });
}

export interface WpPluginActivationVariables {
  pluginId: string;
  active: boolean;
}

/**
 * Toggle a plugin on the workspace's site. Optimistically flips the row so the
 * Switch responds instantly, rolls back on failure, and reconciles with the
 * authoritative list the server returns.
 */
export function useWorkspaceWpPluginActivation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ pluginId, active }: WpPluginActivationVariables) =>
      setWorkspaceWpPluginActive(pluginId, active),
    onMutate: async ({ pluginId, active }) => {
      await queryClient.cancelQueries({ queryKey: PLUGINS_KEY });
      const previous =
        queryClient.getQueryData<WpPluginListResponse>(PLUGINS_KEY);
      if (previous) {
        queryClient.setQueryData<WpPluginListResponse>(PLUGINS_KEY, {
          ...previous,
          plugins: previous.plugins.map((p) =>
            p.id === pluginId ? { ...p, active } : p,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(PLUGINS_KEY, ctx.previous);
      }
    },
    onSuccess: (data) => {
      // Server returns the freshly re-listed plugins — take it as truth.
      queryClient.setQueryData(PLUGINS_KEY, data);
    },
  });
}
