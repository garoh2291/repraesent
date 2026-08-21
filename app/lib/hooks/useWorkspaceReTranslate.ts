"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import {
  addTranslateLanguage,
  getWorkspacePluginSettings,
  getTranslateContent,
  getTranslateContentDetail,
  machineTranslateContent,
  removeTranslateLanguage,
  runTranslateIndex,
  runTranslateBulk,
  saveTranslateStrings,
  setTranslateSourceLanguage,
  type TranslateContentDetailResponse,
  type TranslateContentListResponse,
  type TranslateLanguageProgress,
  type TranslateString,
  type WpPluginSettingsGetResponse,
} from "~/lib/api/wordpress-hub";
import type { ReTranslateSettings } from "~/lib/wordpress/plugin-settings-types";
import { pluginSettingsKey } from "./useWorkspacePluginSettings";

function translateContentKey(
  pluginUuid: string,
  params: Record<string, unknown>,
) {
  return ["wordpress", "re-translate", "content", pluginUuid, params] as const;
}

function translateContentDetailKey(
  pluginUuid: string,
  id: number | string,
  language: string,
  objectType?: string,
) {
  return [
    "wordpress",
    "re-translate",
    "content-detail",
    pluginUuid,
    id,
    language,
    objectType ?? "post",
  ] as const;
}

const contentListPrefix = (pluginUuid: string) =>
  ["wordpress", "re-translate", "content", pluginUuid] as const;

const contentDetailPrefix = (pluginUuid: string) =>
  ["wordpress", "re-translate", "content-detail", pluginUuid] as const;

function progressFromStrings(strings: TranslateString[]): TranslateLanguageProgress {
  const total = strings.length;
  const translated = strings.filter(
    (s) => s.translated_text != null && s.translated_text !== "",
  ).length;
  const stale = strings.filter((s) => s.is_stale).length;
  return {
    total,
    translated,
    stale,
    percent: total > 0 ? Math.round((translated / total) * 100) : 0,
  };
}

/** Push one object's language progress into every cached content-list page. */
function syncListItemLanguages(
  queryClient: QueryClient,
  pluginUuid: string,
  item: {
    id: number | string;
    object_type: string;
    strings?: number;
    languages: Record<string, TranslateLanguageProgress>;
  },
) {
  queryClient.setQueriesData<TranslateContentListResponse>(
    { queryKey: contentListPrefix(pluginUuid) },
    (prev) => {
      if (!prev?.items) return prev;
      let changed = false;
      const items = prev.items.map((row) => {
        if (
          String(row.id) !== String(item.id) ||
          row.object_type !== item.object_type
        ) {
          return row;
        }
        changed = true;
        return {
          ...row,
          strings: item.strings ?? row.strings,
          languages: { ...row.languages, ...item.languages },
        };
      });
      return changed ? { ...prev, items } : prev;
    },
  );
}

/** Soft refresh of every cached translate content list page. */
export function refetchTranslateContentLists(
  queryClient: QueryClient,
  pluginUuid: string,
) {
  return queryClient.refetchQueries({
    queryKey: contentListPrefix(pluginUuid),
  });
}

export function progressFromTranslateStrings(
  strings: TranslateString[],
): TranslateLanguageProgress {
  return progressFromStrings(strings);
}

/**
 * Re-issue a machine-translate call while the site reports strings left.
 * Bounded: a site that never reports progress must not spin here forever.
 */
async function resumeMachineTranslate(
  call: () => Promise<Record<string, unknown>>,
): Promise<Record<string, unknown>> {
  let last: Record<string, unknown> = {};
  for (let round = 0; round < 20; round += 1) {
    last = await call();
    if ((Number(last.remaining ?? 0) || 0) <= 0) break;
  }
  return last;
}

/** The server-owned counters a translate run moves. */
export type TranslateCounters = Pick<
  ReTranslateSettings,
  "stats" | "index" | "bulk"
>;

/**
 * Re-read the plugin's options and hand back only the counters.
 *
 * Translating changes `stats` (and a scan changes `index`) server-side, and the
 * overview reads them straight off the settings form — so without this the
 * numbers only move on a page refresh. Only the counters come back rather than
 * the whole blob: the Switcher and Settings tabs may be half-edited, and
 * reseeding the form wholesale would throw those edits away.
 */
export function useRefreshTranslateCounters(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useCallback(async (): Promise<Partial<TranslateCounters> | null> => {
    if (!pluginUuid) return null;
    const res = await queryClient.fetchQuery({
      queryKey: pluginSettingsKey(pluginUuid),
      queryFn: () => getWorkspacePluginSettings(pluginUuid),
      staleTime: 0,
    });
    if (!res?.found || !res.settings || typeof res.settings !== "object") {
      return null;
    }
    const fresh = res.settings as Partial<ReTranslateSettings>;
    return { stats: fresh.stats, index: fresh.index, bulk: fresh.bulk };
  }, [queryClient, pluginUuid]);
}

type SettingsCache = WpPluginSettingsGetResponse & {
  settings?: Record<string, unknown> & {
    languages?: {
      code: string;
      label: string;
      locale: string;
      flag: string;
      added_at: string;
    }[];
  };
};

export function useTranslateContent(
  pluginUuid: string,
  params: {
    page?: number;
    per_page?: number;
    search?: string;
    post_type?: string;
    object_type?: string;
  },
  enabled = true,
) {
  return useQuery({
    queryKey: translateContentKey(pluginUuid, params),
    queryFn: () => getTranslateContent(pluginUuid, params),
    enabled: Boolean(pluginUuid) && enabled,
    // Remount after a tab switch should still pick up anything we missed.
    refetchOnMount: "always",
    placeholderData: (prev) => prev,
  });
}

export function useTranslateContentDetail(
  pluginUuid: string,
  id: number | string,
  language: string,
  objectType?: string,
  enabled = true,
) {
  return useQuery({
    queryKey: translateContentDetailKey(pluginUuid, id, language, objectType),
    queryFn: () =>
      getTranslateContentDetail(pluginUuid, id, {
        language,
        object_type: objectType,
      }),
    enabled: Boolean(pluginUuid) && id !== "" && Boolean(language) && enabled,
    // Keep the editor painted while a save/refetch runs — otherwise the
    // section swaps to a spinner and feels like the page went blank.
    placeholderData: (prev) => prev,
  });
}

export function useSaveTranslateStrings(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      strings: { id: number; translated_text: string; status: string }[],
    ) => saveTranslateStrings(pluginUuid, strings),
    onSuccess: (_res, saved) => {
      // Patch the open editor from what we just wrote — do not invalidate the
      // detail query or it remounts into a loading spinner ("goes blank").
      const byId = new Map(saved.map((s) => [s.id, s]));
      let patched: TranslateContentDetailResponse | undefined;

      queryClient.setQueriesData<TranslateContentDetailResponse>(
        { queryKey: contentDetailPrefix(pluginUuid) },
        (prev) => {
          if (!prev?.strings) return prev;
          if (!saved.some((s) => prev.strings.some((row) => row.id === s.id))) {
            return prev;
          }
          const strings = prev.strings.map((s) => {
            const next = byId.get(s.id);
            if (!next) return s;
            return {
              ...s,
              translated_text: next.translated_text,
              status: next.status,
              is_stale: false,
            };
          });
          const progress = progressFromStrings(strings);
          const next: TranslateContentDetailResponse = {
            ...prev,
            strings,
            progress,
            item: {
              ...prev.item,
              strings: strings.length,
              languages: {
                ...prev.item.languages,
                [prev.language]: progress,
              },
            },
          };
          patched = next;
          return next;
        },
      );

      // List badges update immediately — no waiting on a refetch.
      if (patched) {
        syncListItemLanguages(queryClient, pluginUuid, patched.item);
      }
    },
  });
}

export function useAddTranslateLanguage(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      code: string;
      label?: string;
      locale?: string;
      flag?: string;
    }) => addTranslateLanguage(pluginUuid, body),
    onMutate: async (body) => {
      const key = pluginSettingsKey(pluginUuid);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SettingsCache>(key);

      if (previous?.settings) {
        const languages = Array.isArray(previous.settings.languages)
          ? previous.settings.languages
          : [];
        if (!languages.some((l) => l.code === body.code)) {
          queryClient.setQueryData<SettingsCache>(key, {
            ...previous,
            found: true,
            settings: {
              ...previous.settings,
              languages: [
                ...languages,
                {
                  code: body.code,
                  label: body.label || body.code,
                  locale: body.locale || body.code,
                  flag: body.flag || "",
                  added_at: new Date().toISOString(),
                },
              ],
            },
          });
        }
      }

      return { previous };
    },
    onError: (_err, _body, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(pluginSettingsKey(pluginUuid), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pluginSettingsKey(pluginUuid) });
    },
  });
}

export function useRemoveTranslateLanguage(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, purge }: { code: string; purge: boolean }) =>
      removeTranslateLanguage(pluginUuid, code, purge),
    onMutate: async ({ code }) => {
      const key = pluginSettingsKey(pluginUuid);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SettingsCache>(key);

      if (previous?.settings) {
        const languages = Array.isArray(previous.settings.languages)
          ? previous.settings.languages
          : [];
        queryClient.setQueryData<SettingsCache>(key, {
          ...previous,
          found: true,
          settings: {
            ...previous.settings,
            languages: languages.filter((l) => l.code !== code),
          },
        });
      }

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(pluginSettingsKey(pluginUuid), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pluginSettingsKey(pluginUuid) });
    },
  });
}

export function useRunTranslateIndex(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (action: "start" | "batch" | "cancel") =>
      runTranslateIndex(pluginUuid, action),
    onSuccess: (data) => {
      if (!data.index) return;
      queryClient.setQueryData<WpPluginSettingsGetResponse>(
        pluginSettingsKey(pluginUuid),
        (prev) => ({
          found: true,
          settings: {
            ...(prev?.settings as Record<string, unknown>),
            index: data.index,
          },
        }),
      );
    },
  });
}

export function useRunTranslateBulk(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      languages,
      mode,
    }: {
      action: "start" | "batch" | "cancel";
      languages?: string[];
      mode?: "empty_or_stale" | "empty_only" | "overwrite";
    }) => runTranslateBulk(pluginUuid, action, languages, mode),
    onSuccess: (data) => {
      if (!data.bulk) return;
      queryClient.setQueryData<WpPluginSettingsGetResponse>(
        pluginSettingsKey(pluginUuid),
        (prev) => ({
          found: true,
          settings: {
            ...(prev?.settings as Record<string, unknown>),
            bulk: data.bulk,
          },
        }),
      );
    },
  });
}

export function useSetTranslateSourceLanguage(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      code,
      replaceTarget,
    }: {
      code: string;
      replaceTarget?: boolean;
    }) => setTranslateSourceLanguage(pluginUuid, code, replaceTarget),
    onMutate: async ({ code, replaceTarget }) => {
      const key = pluginSettingsKey(pluginUuid);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SettingsCache>(key);
      const normalized = code.toLowerCase();

      if (previous?.settings) {
        const languages = Array.isArray(previous.settings.languages)
          ? previous.settings.languages
          : [];
        queryClient.setQueryData<SettingsCache>(key, {
          ...previous,
          found: true,
          settings: {
            ...previous.settings,
            source_language: normalized,
            // When replacing a target as source, drop it from the target list.
            languages: replaceTarget
              ? languages.filter((l) => l.code !== normalized)
              : languages,
          },
        });
      }

      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(pluginSettingsKey(pluginUuid), ctx.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: pluginSettingsKey(pluginUuid) });
    },
  });
}

export function useMachineTranslateContent(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      language,
      objectType,
      mode,
    }: {
      id: number | string;
      language: string;
      objectType?: string;
      mode?: "empty_or_stale" | "empty_only" | "overwrite";
    }) =>
      // The API chunks the object and stops at its own budget, so a very long
      // page can come back with work left. Keep asking until it is done rather
      // than leaving the page half translated.
      resumeMachineTranslate(() =>
        machineTranslateContent(pluginUuid, id, language, objectType, mode),
      ),
    onSuccess: async (_data, vars) => {
      const detailKey = translateContentDetailKey(
        pluginUuid,
        vars.id,
        vars.language,
        vars.objectType,
      );
      await queryClient.refetchQueries({ queryKey: detailKey });
      const detail =
        queryClient.getQueryData<TranslateContentDetailResponse>(detailKey);
      if (detail) {
        syncListItemLanguages(queryClient, pluginUuid, detail.item);
      }
    },
  });
}
