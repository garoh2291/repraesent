"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getWorkspaceWpSites,
  getWorkspaceWpSitesHosting,
  type WorkspaceWpSite,
  type WpSiteHosting,
} from "~/lib/api/wordpress-hub";
import {
  getStoredWorkspaceId,
  setStoredWpSiteId,
} from "~/lib/api/axios-instance";
import { INSTALLS_KEY } from "./useWorkspaceWpPluginInstalls";
import { OVERVIEW_KEY } from "./useWorkspaceWebsiteOverview";

const SITES_KEY = ["workspace-wp-sites"] as const;
const SITE_KEY = ["workspace-wp-site"] as const;
const HOSTING_KEY = ["workspace-wp-sites-hosting"] as const;

/** Queries that are the same whichever site is open, or that carry the site id. */
const NOT_SITE_BOUND = new Set<string>([
  "workspace-wp-plugin-catalog",
  SITES_KEY[0],
  SITE_KEY[0],
  HOSTING_KEY[0],
  INSTALLS_KEY[0],
  // Keyed by site id and fetched for that site, so a switch can keep it.
  OVERVIEW_KEY,
]);

/**
 * Query keys whose data belongs to one WordPress site. None of them carries the
 * site id, so after a switch they would repaint the previous site's settings,
 * services and pages — they are reset instead.
 */
function belongsToOtherSiteData(query: { queryKey: readonly unknown[] }) {
  const head = query.queryKey[0];
  if (typeof head !== "string") return false;
  // The open site itself is set directly on a switch.
  if (NOT_SITE_BOUND.has(head)) return false;
  return (
    head.startsWith("workspace-wp-") ||
    head === "wordpress" ||
    head === "re-visible" ||
    head === "re-translate"
  );
}

/** Every WordPress site of the workspace (production first). */
export function useWorkspaceWpSites(enabled: boolean) {
  return useQuery({
    queryKey: SITES_KEY,
    queryFn: getWorkspaceWpSites,
    enabled,
    staleTime: 60_000,
  });
}

const hostingMemoryKey = () => `rp_wp_hosting:${getStoredWorkspaceId() ?? ""}`;

function rememberedHosting(): Record<string, WpSiteHosting> | undefined {
  try {
    const raw = localStorage.getItem(hostingMemoryKey());
    return raw ? (JSON.parse(raw) as Record<string, WpSiteHosting>) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether we host each of the workspace's sites. Asking our web servers is
 * slow, so the last answer is remembered in this browser and used at once —
 * the menu decides on Settings and the service tabs without waiting, and a
 * switch never shows them for a moment before taking them away. A site with
 * no answer yet counts as ours.
 */
export function useWpSitesHosting(enabled: boolean) {
  const query = useQuery({
    queryKey: HOSTING_KEY,
    queryFn: async () => {
      const answer = await getWorkspaceWpSitesHosting();
      try {
        localStorage.setItem(hostingMemoryKey(), JSON.stringify(answer));
      } catch {
        /* storage blocked: the answer still applies for this visit */
      }
      return answer;
    },
    enabled,
    initialData: rememberedHosting,
    // The remembered answer is shown, then checked straight away.
    initialDataUpdatedAt: 0,
    staleTime: 60_000,
  });
  const map = query.data;
  return useCallback(
    (siteId: string | undefined) => !!siteId && map?.[siteId] === "elsewhere",
    [map],
  );
}

/**
 * Switch the Website section to another of the workspace's sites. The choice
 * is stored for this tab and sent with every request (X-Wp-Site-Id); the API
 * checks it belongs to the workspace.
 */
export function useSwitchWpSite() {
  const queryClient = useQueryClient();
  return useCallback(
    (site: WorkspaceWpSite) => {
      setStoredWpSiteId(site.id);
      // Show the chosen site at once (header, picker, nav) from the list we
      // already have, then confirm it in the background.
      queryClient.setQueryData<WorkspaceWpSite | null>(SITE_KEY, site);
      void queryClient.invalidateQueries({ queryKey: SITE_KEY });
      // Cancel first: a request already sent named the old site and would
      // otherwise land in the new site's slot. Reset (not remove): it notifies
      // the open screens, which drop the old site's data and load the new one
      // straight away — removing left them painted with the old site until a
      // reload. The installed-services list is keyed by site id, so it simply
      // keeps the old tabs on screen until the new site's list arrives.
      void queryClient
        .cancelQueries({ predicate: belongsToOtherSiteData })
        .then(() =>
          queryClient.resetQueries({ predicate: belongsToOtherSiteData }),
        );
    },
    [queryClient],
  );
}
