"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  getWorkspaceWpPluginCatalog,
  type WpPluginCatalogItem,
  type WpPluginSettingsKind,
} from "~/lib/api/wordpress-hub";
import {
  BUILT_IN_SERVICE_NAMES,
  PORTED_SETTINGS_KINDS,
  isPortedSettingsKind,
  pluginServiceName,
} from "~/lib/utils/wordpress-plugin-kind";

const CATALOG_KEY = ["workspace-wp-plugin-catalog"] as const;
const CATALOG_MEMORY_KEY = "rp_wp_plugin_catalog";

function rememberedCatalog(): WpPluginCatalogItem[] | undefined {
  try {
    const raw = localStorage.getItem(CATALOG_MEMORY_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : undefined;
    return Array.isArray(list) ? (list as WpPluginCatalogItem[]) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The Repraesent plugin catalog (id ↔ kind ↔ presentation). Global and
 * effectively static. The last answer is remembered in this browser and used
 * at once, then checked in the background — screens that resolve a plugin
 * UUID from the URL never wait on it after the first visit.
 */
export function useWorkspaceWpPluginCatalog() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: async () => {
      const list = await getWorkspaceWpPluginCatalog();
      try {
        localStorage.setItem(CATALOG_MEMORY_KEY, JSON.stringify(list));
      } catch {
        /* storage blocked: the answer still applies for this visit */
      }
      return list;
    },
    initialData: rememberedCatalog,
    // The remembered answer is shown, then checked straight away.
    initialDataUpdatedAt: 0,
    staleTime: 10 * 60_000,
    gcTime: Infinity,
  });
}

/**
 * The Website tabs right after Forms, in this order. Every other service
 * follows, alphabetically.
 */
const SERVICE_TAB_ORDER: readonly string[] = [
  "re-visible", // AI Analytics
  "re-translate", // Translation
  "re-cookie", // GDPR Cookie Banner
  "re-index", // SEO Optimization
  "re-banner", // re:banner
  "re-appointment", // Calendar Appointments
];

export interface WebsiteService {
  kind: string;
  label: string;
  /** Catalog UUID once the catalog is known; until then the tab links by kind. */
  uuid: string | null;
}

/**
 * The Website service tabs. Built into the app, so they are there the moment
 * the page draws — no request decides them. Every site has every service.
 * The catalog, when known, adds the UUIDs and any service newer than this
 * build of the app.
 */
export function useWebsiteServices(): WebsiteService[] {
  const { t } = useTranslation();
  const { data: catalog } = useWorkspaceWpPluginCatalog();
  return useMemo(() => {
    const byKind = new Map((catalog ?? []).map((c) => [c.name as string, c]));
    const kinds: string[] = [
      ...PORTED_SETTINGS_KINDS,
      ...(catalog ?? [])
        .map((c) => c.name as string)
        .filter((k) => !isPortedSettingsKind(k)),
    ];
    return kinds
      .map((kind) => {
        const item = byKind.get(kind);
        const fallback = isPortedSettingsKind(kind)
          ? BUILT_IN_SERVICE_NAMES[kind]
          : kind;
        return {
          kind,
          label: pluginServiceName(kind, item?.display_name ?? fallback, t),
          uuid: item?.id ?? null,
        };
      })
      .sort((a, b) => {
        const rank = (kind: string) => {
          const i = SERVICE_TAB_ORDER.indexOf(kind);
          return i === -1 ? SERVICE_TAB_ORDER.length : i;
        };
        return (
          rank(a.kind) - rank(b.kind) ||
          a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
        );
      });
  }, [catalog, t]);
}

/**
 * Resolve the plugin named in the URL — its UUID, or its kind for a link made
 * before the catalog had loaded — against the catalog. Returns `undefined`
 * while the catalog is still loading and `null` when nothing matches, so a
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
  const match =
    data.find((c) => c.id === pluginUuid) ??
    data.find((c) => c.name === pluginUuid) ??
    null;
  return {
    kind: match ? match.name : null,
    catalogItem: match,
    isLoading: false,
  };
}
