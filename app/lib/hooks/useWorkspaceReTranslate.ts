"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addTranslateLanguage,
  getTranslateContent,
  getTranslateContentDetail,
  machineTranslateContent,
  removeTranslateLanguage,
  runTranslateIndex,
  saveTranslateStrings,
  setTranslateSourceLanguage,
  type TranslateContentDetailResponse,
  type WpPluginSettingsGetResponse,
} from "~/lib/api/wordpress-hub";
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
      queryClient.setQueriesData<TranslateContentDetailResponse>(
        { queryKey: ["wordpress", "re-translate", "content-detail", pluginUuid] },
        (prev) => {
          if (!prev?.strings) return prev;
          return {
            ...prev,
            strings: prev.strings.map((s) => {
              const next = byId.get(s.id);
              if (!next) return s;
              return {
                ...s,
                translated_text: next.translated_text,
                status: next.status,
                is_stale: false,
              };
            }),
          };
        },
      );
      queryClient.invalidateQueries({
        queryKey: ["wordpress", "re-translate", "content", pluginUuid],
      });
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
    }: {
      id: number | string;
      language: string;
      objectType?: string;
    }) => machineTranslateContent(pluginUuid, id, language, objectType),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["wordpress", "re-translate", "content-detail", pluginUuid],
      });
      queryClient.invalidateQueries({
        queryKey: pluginSettingsKey(pluginUuid),
      });
    },
  });
}
