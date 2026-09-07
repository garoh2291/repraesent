"use client";

import { useCallback, useEffect, useRef } from "react";
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
  getTranslateBulkStatus,
  saveTranslateStrings,
  setTranslateSourceLanguage,
  type TranslateContentDetailResponse,
  type TranslateContentListResponse,
  type TranslateLanguageProgress,
  type TranslateString,
  type WpPluginSettingsGetResponse,
} from "~/lib/api/wordpress-hub";
import type {
  ReTranslateBulkState,
  ReTranslateSettings,
} from "~/lib/wordpress/plugin-settings-types";
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

function progressFromStrings(
  strings: TranslateString[],
): TranslateLanguageProgress {
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

function withPercent(
  row: Pick<TranslateLanguageProgress, "total" | "translated"> & {
    stale?: number;
    percent?: number;
  },
): TranslateLanguageProgress {
  const total = Number(row.total) || 0;
  const translated = Number(row.translated) || 0;
  const stale = Number(row.stale) || 0;
  return {
    total,
    translated,
    stale,
    percent:
      row.percent ?? (total > 0 ? Math.round((translated / total) * 100) : 0),
  };
}

function isProgressRow(value: unknown): value is {
  total: number;
  translated: number;
  stale?: number;
  percent?: number;
} {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.total != null && row.translated != null;
}

/**
 * The machine-translate bridge returns the plugin's language map (no
 * `percent`) or, rarely, a single progress row. Either way the list badges
 * need a percent they can paint without waiting on a GET.
 */
function languagesFromMachinePayload(
  progress: unknown,
  language: string,
  strings: TranslateString[] | null,
): Record<string, TranslateLanguageProgress> | null {
  if (progress && typeof progress === "object" && !Array.isArray(progress)) {
    const obj = progress as Record<string, unknown>;
    if (isProgressRow(obj) && !Object.values(obj).some(isProgressRow)) {
      return { [language]: withPercent(obj) };
    }
    const out: Record<string, TranslateLanguageProgress> = {};
    for (const [code, value] of Object.entries(obj)) {
      if (isProgressRow(value)) out[code] = withPercent(value);
    }
    if (Object.keys(out).length > 0) return out;
  }
  if (strings) return { [language]: progressFromStrings(strings) };
  return null;
}

function coerceTranslateStrings(raw: unknown): TranslateString[] | null {
  if (!Array.isArray(raw)) return null;
  const out: TranslateString[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const r = row as Record<string, unknown>;
    const id = Number(r.id);
    if (!Number.isFinite(id)) return null;
    out.push({
      id,
      field_key: String(r.field_key ?? ""),
      label: String(r.label ?? ""),
      source_text: String(r.source_text ?? ""),
      current_source_text:
        r.current_source_text != null
          ? String(r.current_source_text)
          : undefined,
      translated_text: r.translated_text ? String(r.translated_text) : undefined,
      status: String(r.status ?? ""),
      is_stale: Boolean(r.is_stale),
      is_html: Boolean(r.is_html),
      updated_at: r.updated_at != null ? String(r.updated_at) : undefined,
    });
  }
  return out;
}

/**
 * Move one language's site-wide counters by the delta on a single object, so
 * the header tiles and Overview bars jump the moment a page finishes rather
 * than waiting on a settings GET over the tunnel.
 */
export function bumpLanguageStats(
  stats: ReTranslateSettings["stats"],
  language: string,
  previous: TranslateLanguageProgress | undefined,
  next: TranslateLanguageProgress,
): ReTranslateSettings["stats"] {
  const current = stats.languages[language] ?? {
    total: 0,
    translated: 0,
    stale: 0,
    percent: 0,
  };
  const translated = Math.max(
    0,
    current.translated + next.translated - (previous?.translated ?? 0),
  );
  const stale = Math.max(
    0,
    current.stale + next.stale - (previous?.stale ?? 0),
  );
  const total = current.total;
  const clamped = total > 0 ? Math.min(translated, total) : translated;
  return {
    ...stats,
    languages: {
      ...stats.languages,
      [language]: {
        ...current,
        translated: clamped,
        stale,
        percent: total > 0 ? Math.round((clamped / total) * 100) : 0,
      },
    },
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
    // Hit the network directly. This key is observed with `staleTime: Infinity`
    // so the form is not yanked while someone types; `fetchQuery({ staleTime: 0 })`
    // can still resolve the cached blob and leave Overview/% tiles on old numbers
    // until a full refresh.
    const res = await getWorkspacePluginSettings(pluginUuid);
    queryClient.setQueryData(pluginSettingsKey(pluginUuid), res);
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
      queryClient.invalidateQueries({
        queryKey: pluginSettingsKey(pluginUuid),
      });
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
      queryClient.invalidateQueries({
        queryKey: pluginSettingsKey(pluginUuid),
      });
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

/** Cache key for the site's bulk-translation progress. */
export function translateBulkKey(pluginUuid: string) {
  return ["workspace", "re-translate", "bulk", pluginUuid] as const;
}

/** How often to ask the API where a live run has got to. */
const BULK_POLL_MS = 3_000;

function bulkIsActive(status: string | undefined): boolean {
  return status === "running" || status === "queued";
}

/**
 * Watch the site's bulk-translation run.
 *
 * The run belongs to the API, not to this tab: it is built and drained by the
 * scheduler, so all the browser does is ask where it has got to. That is the
 * whole reason a refresh, a closed laptop, or a navigation no longer stops a
 * translation — this hook reconnects to a run in progress instead of being
 * the thing that drives it.
 *
 * Polling stops the moment the run is not active, so an idle settings page
 * makes no requests.
 */
export function useTranslateBulkStatus(
  pluginUuid: string,
  initial: ReTranslateBulkState | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: translateBulkKey(pluginUuid),
    queryFn: async () => {
      const res = await getTranslateBulkStatus(pluginUuid);
      return res.bulk ?? null;
    },
    enabled: Boolean(pluginUuid) && enabled,
    initialData: initial ?? null,
    /*
     * These four override the app-wide query defaults, and every one of them
     * has to: the defaults are `refetchOnMount: false` with a five-minute
     * staleTime, tuned for settings blobs that rarely change. Applied here
     * they meant a page mounted mid-run never asked the server anything — it
     * sat on the seeded value, so `refetchInterval` saw no active run and
     * never started polling either. Refreshing showed a bare Start button for
     * a translation that was very much still going, and the only hint was the
     * 409 you got for trying to start a second one.
     */
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Only while there is something to watch; an idle page makes no requests.
    refetchInterval: (query) =>
      bulkIsActive(query.state.data?.status) ? BULK_POLL_MS : false,
    refetchIntervalInBackground: true,
  });
}

/**
 * Keep watching a bulk run at the page level, not only on the Translate tab.
 *
 * Radix unmounts inactive tab panels, so if the poller lived only inside the
 * bulk bar, finishing a run while Overview was open never refreshed the
 * language percentages. This hook shares the bulk query (one poll) and, the
 * moment a run this session completes, refetches the content list and the
 * server counters.
 */
export function useWatchTranslateBulkCompletion(
  pluginUuid: string,
  initial: ReTranslateBulkState | undefined,
  onComplete: () => void,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const bulkQuery = useTranslateBulkStatus(pluginUuid, initial, enabled);
  const bulk = bulkQuery.data;
  const sawRunning = useRef(false);
  const completedFor = useRef<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (bulkIsActive(bulk?.status)) sawRunning.current = true;
  }, [bulk?.status]);

  useEffect(() => {
    const status = bulk?.status;
    if (status === "idle" || status === "cancelled") {
      sawRunning.current = false;
      completedFor.current = null;
      return;
    }
    if (status !== "complete" || !sawRunning.current || !bulk) return;
    const key = bulk.updated_at || bulk.started_at;
    if (!key || completedFor.current === key) return;
    completedFor.current = key;
    sawRunning.current = false;
    void refetchTranslateContentLists(queryClient, pluginUuid);
    onCompleteRef.current();
  }, [
    bulk?.status,
    bulk?.updated_at,
    bulk?.started_at,
    pluginUuid,
    queryClient,
  ]);
}

export function useRunTranslateBulk(pluginUuid: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      action,
      languages,
      mode,
    }: {
      action: "start" | "cancel";
      languages?: string[];
      mode?: "empty_or_stale" | "empty_only" | "overwrite";
    }) => runTranslateBulk(pluginUuid, action, languages, mode),
    // A rejected start is usually "one is already running" — which is worth
    // showing rather than arguing with, so go and fetch the run it means.
    onError: () => {
      void queryClient.invalidateQueries({
        queryKey: translateBulkKey(pluginUuid),
      });
    },
    onSuccess: (data) => {
      if (!data.bulk) return;
      // Both caches hold the same run: the settings blob is what a cold load
      // reads, the bulk key is what the poller keeps fresh.
      queryClient.setQueryData(translateBulkKey(pluginUuid), data.bulk);
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
      queryClient.invalidateQueries({
        queryKey: pluginSettingsKey(pluginUuid),
      });
    },
  });
}

/**
 * Paint the editor and the list badges from the mutation body. The bridge
 * already returns `strings` and `progress`; waiting on a GET after that is
 * what made the language % sit still until a refresh.
 */
function applyMachineTranslateResult(
  queryClient: QueryClient,
  pluginUuid: string,
  vars: { id: number | string; language: string; objectType?: string },
  data: Record<string, unknown>,
): Record<string, TranslateLanguageProgress> | null {
  const strings = coerceTranslateStrings(data.strings);
  const languages = languagesFromMachinePayload(
    data.progress,
    vars.language,
    strings,
  );
  if (!languages) return null;

  const detailKey = translateContentDetailKey(
    pluginUuid,
    vars.id,
    vars.language,
    vars.objectType,
  );
  queryClient.setQueryData<TranslateContentDetailResponse>(
    detailKey,
    (prev) => {
      if (!prev) return prev;
      const nextStrings = strings ?? prev.strings;
      const langProgress =
        languages[vars.language] ?? progressFromStrings(nextStrings);
      return {
        ...prev,
        strings: nextStrings,
        progress: langProgress,
        item: {
          ...prev.item,
          strings: nextStrings.length,
          languages: { ...prev.item.languages, ...languages },
        },
      };
    },
  );

  const detail =
    queryClient.getQueryData<TranslateContentDetailResponse>(detailKey);
  syncListItemLanguages(queryClient, pluginUuid, {
    id: vars.id,
    object_type: vars.objectType ?? detail?.item.object_type ?? "post",
    strings: detail?.item.strings,
    languages: { ...(detail?.item.languages ?? {}), ...languages },
  });

  return languages;
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
    onSuccess: (data, vars) => {
      applyMachineTranslateResult(queryClient, pluginUuid, vars, data);
      // Background reconcile with the SQL-shaped editor payload — the list
      // badges already moved from the mutation body.
      void queryClient.refetchQueries({
        queryKey: translateContentDetailKey(
          pluginUuid,
          vars.id,
          vars.language,
          vars.objectType,
        ),
      });
    },
  });
}
