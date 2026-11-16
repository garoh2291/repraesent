import { useQuery } from "@tanstack/react-query";
import {
  getWorkspaceWpSite,
  type WorkspaceWpSite,
} from "~/lib/api/wordpress-hub";
import {
  getStoredWorkspaceId,
  getStoredWpSiteId,
} from "~/lib/api/axios-instance";

/** One answer per workspace and per chosen site (Live or Staging). */
const siteMemoryKey = () =>
  `rp_wp_site_memory:${getStoredWorkspaceId() ?? ""}:${getStoredWpSiteId() ?? ""}`;

function rememberedSite(): WorkspaceWpSite | null | undefined {
  try {
    const raw = localStorage.getItem(siteMemoryKey());
    // "null" is a real answer: this workspace has no WordPress site.
    return raw === null ? undefined : (JSON.parse(raw) as WorkspaceWpSite | null);
  } catch {
    return undefined;
  }
}

/**
 * The current workspace's WordPress site (or null). Shared by the WordPress
 * page and the sidebar nav gate (nav whenever there is a site; `sso_enabled`
 * only decides whether "Sign in to admin" is offered). `enabled`
 * should be false for brand views / when there is no current workspace.
 *
 * The last answer is remembered in this browser and used at once, so the
 * Website tabs are there the moment the page draws; the server confirms it
 * straight away in the background.
 */
export function useWorkspaceWpSite(enabled: boolean) {
  return useQuery({
    queryKey: ["workspace-wp-site"],
    queryFn: async () => {
      const site = await getWorkspaceWpSite();
      try {
        localStorage.setItem(siteMemoryKey(), JSON.stringify(site));
      } catch {
        /* storage blocked: the answer still applies for this visit */
      }
      return site;
    },
    enabled,
    initialData: rememberedSite,
    // The remembered answer is shown, then checked straight away.
    initialDataUpdatedAt: 0,
  });
}
