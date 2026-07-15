import { useQuery } from "@tanstack/react-query";
import { getWorkspaceWpSite } from "~/lib/api/wordpress-hub";

/**
 * The current workspace's WordPress site (or null). Shared by the WordPress
 * page and the sidebar nav gate. `enabled` should be false for brand views /
 * when there is no current workspace.
 */
export function useWorkspaceWpSite(enabled: boolean) {
  return useQuery({
    queryKey: ["workspace-wp-site"],
    queryFn: getWorkspaceWpSite,
    enabled,
  });
}
