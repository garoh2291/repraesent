"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  getWorkspacePluginSettings,
  type WpPluginCatalogItem,
} from "~/lib/api/wordpress-hub";
import { useWorkspaceWpPluginCatalog } from "~/lib/hooks/useWorkspaceWpPluginCatalog";
import { useWorkspaceWpSite } from "~/lib/hooks/useWorkspaceWpSite";
import type { ReTranslateSettings } from "~/lib/wordpress/plugin-settings-types";
import type {
  PluginI18nLanguage,
  PluginI18nState,
} from "~/lib/wordpress/plugin-i18n";
import {
  languageDisplayName,
} from "~/components/wordpress/re-translate/constants";

function findTranslateCatalog(
  catalog: WpPluginCatalogItem[] | undefined,
): WpPluginCatalogItem | null {
  return catalog?.find((c) => c.name === "re-translate") ?? null;
}

/**
 * Languages from the site's re:translate settings, for soft-dependent
 * language bars on other plugin settings pages.
 */
export function usePluginTranslateLanguages(): PluginI18nState & {
  loading: boolean;
} {
  const siteQuery = useWorkspaceWpSite(true);
  const hasSite = !!siteQuery.data?.sso_enabled;
  const { data: catalog, isLoading: catalogLoading } =
    useWorkspaceWpPluginCatalog();
  const translateItem = findTranslateCatalog(catalog);
  const translateUuid = translateItem?.id ?? null;

  const settingsQuery = useQuery({
    queryKey: ["wordpress", "plugin-settings", translateUuid, "i18n-meta"],
    queryFn: () => getWorkspacePluginSettings(translateUuid as string),
    enabled: hasSite && !!translateUuid,
    staleTime: 30_000,
  });

  const state = useMemo((): PluginI18nState => {
    const empty: PluginI18nState = {
      enabled: false,
      source: "",
      languages: [],
      translatePluginUuid: translateUuid,
    };
    if (!translateUuid || !settingsQuery.data?.found) return empty;

    const raw = settingsQuery.data.settings as Partial<ReTranslateSettings> | null;
    if (!raw || typeof raw !== "object") return empty;

    const source = String(raw.source_language ?? "").trim();
    const kill = !!raw.kill_switch;
    const targets = Array.isArray(raw.languages) ? raw.languages : [];
    if (!source || kill || targets.length === 0) {
      return { ...empty, source, translatePluginUuid: translateUuid };
    }

    const languages: PluginI18nLanguage[] = [
      {
        code: source,
        label: languageDisplayName(source),
        is_source: true,
      },
      ...targets.map((lang) => ({
        code: String(lang.code ?? ""),
        label: languageDisplayName(
          String(lang.code ?? ""),
          String(lang.label ?? ""),
        ),
        is_source: false,
      })),
    ].filter((l) => l.code);

    return {
      enabled: languages.length > 1,
      source,
      languages,
      translatePluginUuid: translateUuid,
    };
  }, [settingsQuery.data, translateUuid]);

  return {
    ...state,
    loading:
      siteQuery.isLoading ||
      catalogLoading ||
      (!!translateUuid && settingsQuery.isLoading),
  };
}
