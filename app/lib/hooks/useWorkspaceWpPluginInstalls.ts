"use client";

import { useQueries, useQuery } from "@tanstack/react-query";
import { getWorkspaceWpPluginInstalls } from "~/lib/api/wordpress-hub";
import { useAuthContext } from "~/providers/auth-provider";

export const INSTALLS_KEY = ["workspace-wp-plugin-installs"] as const;

/**
 * Catalog plugins installed on the open WordPress site. Postgres relation
 * only — if the row is there, it is listed.
 *
 * Keyed by the open site's id so a site switch keeps showing the previous
 * site's list (`isPlaceholderData`) until the new one arrives: the menu's
 * service tabs stay put instead of vanishing and coming back. Only within one
 * workspace, though — after a workspace switch the menu's observer would
 * otherwise paint the other workspace's services until the new list lands.
 * Pass the site id from `useWorkspaceWpSite`; nothing runs without one.
 */
export function useWorkspaceWpPluginInstalls(siteId: string | undefined) {
  const workspaceId = useAuthContext().currentWorkspace?.id ?? "";
  return useQuery({
    queryKey: [INSTALLS_KEY[0], workspaceId, siteId ?? ""],
    // Names the site itself, so the answer always belongs to its key.
    queryFn: () => getWorkspaceWpPluginInstalls(siteId),
    enabled: !!siteId,
    staleTime: 60_000,
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === workspaceId ? previous : undefined,
  });
}

/**
 * Loads every one of these sites' services in the background, so switching
 * between Production and Staging shows the right tabs at once instead of the
 * other site's for a moment.
 */
export function usePreloadWpPluginInstalls(siteIds: string[]) {
  const workspaceId = useAuthContext().currentWorkspace?.id ?? "";
  useQueries({
    queries: siteIds.map((id) => ({
      queryKey: [INSTALLS_KEY[0], workspaceId, id],
      queryFn: () => getWorkspaceWpPluginInstalls(id),
      staleTime: 60_000,
    })),
  });
}
