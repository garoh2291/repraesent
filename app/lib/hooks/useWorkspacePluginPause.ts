"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspacePluginPause,
  putWorkspacePluginPause,
  type WpPluginPauseState,
} from "~/lib/api/wordpress-hub";

function pauseKey(pluginUuid: string) {
  return ["workspace-wp-plugin-pause", pluginUuid] as const;
}

/**
 * Whether a plugin is paused on the workspace's site — the "Live" switch at the
 * top of its page. Separate from the settings blob on purpose: re:banner and
 * re:appointment have none, and a pause must save on its own without carrying
 * whatever is half-typed in a settings form.
 */
export function useWorkspacePluginPause(pluginUuid: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: pauseKey(pluginUuid),
    queryFn: () => getWorkspacePluginPause(pluginUuid),
    enabled: !!pluginUuid,
    // Reading wp_options goes over an SSH tunnel; this only changes when the
    // customer flips it here.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });

  const mutation = useMutation({
    mutationFn: (paused: boolean) => putWorkspacePluginPause(pluginUuid, paused),
    onSuccess: (data) => {
      queryClient.setQueryData<WpPluginPauseState>(pauseKey(pluginUuid), data);
    },
  });

  return { query, mutation };
}
