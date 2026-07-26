"use client";

import { useQuery } from "@tanstack/react-query";
import {
  getWorkspaceWpPluginCatalog,
  type WpPluginCatalogItem,
  type WpPluginSettingsKind,
} from "~/lib/api/wordpress-hub";

const CATALOG_KEY = ["workspace-wp-plugin-catalog"] as const;

/**
 * The Repraesent plugin catalog (id ↔ kind ↔ presentation). Global and
 * effectively static, so it is cached hard and shared across every screen that
 * needs to resolve an opaque plugin UUID from the URL.
 */
export function useWorkspaceWpPluginCatalog() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: getWorkspaceWpPluginCatalog,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/**
 * Resolve a plugin UUID to its kind against the catalog. Returns `undefined`
 * while the catalog is still loading and `null` when the UUID is unknown, so a
 * caller can tell "not ready yet" from "no such plugin".
 */
export function useResolvePluginKind(pluginUuid: string | undefined): {
  kind: WpPluginSettingsKind | null | undefined;
  catalogItem: WpPluginCatalogItem | null | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useWorkspaceWpPluginCatalog();
  if (isLoading || !data) {
    return { kind: undefined, catalogItem: undefined, isLoading };
  }
  const match = data.find((c) => c.id === pluginUuid) ?? null;
  return {
    kind: match ? match.name : null,
    catalogItem: match,
    isLoading: false,
  };
}
