"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createWorkspaceReBanner,
  deleteWorkspaceReBanner,
  getWorkspaceReBanners,
  updateWorkspaceReBanner,
  type ReBannersResponse,
} from "~/lib/api/wordpress-hub";
import type {
  ReBannerConfig,
  ReBannerStatus,
} from "~/lib/wordpress/plugin-settings-types";

const RE_BANNER_KEY = ["workspace-wp-re-banners"] as const;

/**
 * The re:banner banners on the workspace's WordPress site, plus the link
 * targets and timezone the editor needs. Gate this on the site query: the
 * endpoint 404s when the workspace has no site at all.
 */
export function useWorkspaceReBanners(
  pluginUuid: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: RE_BANNER_KEY,
    queryFn: () => getWorkspaceReBanners(pluginUuid as string),
    enabled: enabled && !!pluginUuid,
    // Reading the site's posts/postmeta goes over an SSH tunnel; don't refetch
    // on focus and never swap the list out from under someone mid-edit.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/**
 * Every write invalidates the list rather than patching the cache.
 *
 * Saving one banner can change what another one *does* without changing its
 * stored fields: banners compete for a position by priority, so raising one
 * banner's priority silently demotes whichever banner was winning. The list
 * also carries `state`, which is computed against the site's clock — a save
 * can move a banner from Scheduled to Live. Refetching is the only way to keep
 * both honest.
 */
function useInvalidateOnSuccess() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: RE_BANNER_KEY });
}

/** re:banner must be resolved before any write can address it. */
function requirePluginUuid(pluginUuid: string | undefined): string {
  if (!pluginUuid) {
    throw new Error("Missing plugin id");
  }
  return pluginUuid;
}

export function useCreateReBanner(pluginUuid: string | undefined) {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: (config: Partial<ReBannerConfig>) =>
      createWorkspaceReBanner(requirePluginUuid(pluginUuid), config),
    onSuccess: invalidate,
  });
}

export function useUpdateReBanner(pluginUuid: string | undefined) {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: (vars: { id: number; config: Partial<ReBannerConfig> }) =>
      updateWorkspaceReBanner(
        requirePluginUuid(pluginUuid),
        vars.id,
        vars.config,
      ),
    onSuccess: invalidate,
  });
}

/**
 * Pausing and resuming gets its own mutation so it can update the cache
 * optimistically — the switch flips the moment it's clicked instead of waiting
 * on the round-trip over the SSH tunnel.
 *
 * `state` is patched alongside `status` because the badge reads from it: a
 * paused banner must not keep showing "Live" for the length of the request.
 * Pausing always yields "paused"; resuming can land on any of the other three,
 * so the optimistic value is a best guess that the settle-time invalidation
 * reconciles against what the site actually says.
 */
export function useToggleReBannerStatus(pluginUuid: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: { id: number; status: ReBannerStatus }) =>
      updateWorkspaceReBanner(requirePluginUuid(pluginUuid), vars.id, {
        status: vars.status,
      }),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: RE_BANNER_KEY });
      const previous =
        queryClient.getQueryData<ReBannersResponse>(RE_BANNER_KEY);

      if (previous) {
        queryClient.setQueryData<ReBannersResponse>(RE_BANNER_KEY, {
          ...previous,
          banners: previous.banners.map((b) =>
            b.id === vars.id
              ? {
                  ...b,
                  status: vars.status,
                  state: vars.status === "inactive" ? "paused" : "live",
                }
              : b,
          ),
        });
      }

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(RE_BANNER_KEY, context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: RE_BANNER_KEY }),
  });
}

export function useDeleteReBanner(pluginUuid: string | undefined) {
  const invalidate = useInvalidateOnSuccess();
  return useMutation({
    mutationFn: (id: number) =>
      deleteWorkspaceReBanner(requirePluginUuid(pluginUuid), id),
    onSuccess: invalidate,
  });
}
