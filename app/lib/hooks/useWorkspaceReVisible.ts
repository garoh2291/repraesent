"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptVisibilityPrompts,
  getVisibilityProject,
  addVisibilityPrompts,
  createVisibilityProject,
  deleteVisibilityPrompt,
  generateVisibilityPrompts,
  getVisibilityCompetitors,
  getVisibilityOverview,
  getVisibilityPromptRuns,
  getVisibilityPrompts,
  getVisibilitySite,
  getVisibilitySources,
  getVisibilitySuggestions,
  getVisibilityTrend,
  refreshVisibilitySite,
  runVisibilityFix,
  runVisibilityNow,
  setSuggestionStatus,
  suggestForPost,
  updateVisibilityProject,
  updateVisibilityPrompt,
  type PromptCandidate,
  type Suggestion,
  type VisibilityProject,
} from "~/lib/api/re-visible";

/**
 * Query keys, all scoped by plugin UUID.
 *
 * A run mutates almost everything on the page, so the keys are grouped under
 * one root: invalidating `["re-visible", uuid]` after a run is one call and
 * cannot miss a panel.
 */
export const reVisibleKeys = {
  root: (uuid: string) => ["re-visible", uuid] as const,
  overview: (uuid: string) => ["re-visible", uuid, "overview"] as const,
  project: (uuid: string) => ["re-visible", uuid, "project"] as const,
  prompts: (uuid: string) => ["re-visible", uuid, "prompts"] as const,
  promptRuns: (uuid: string, promptId: string) =>
    ["re-visible", uuid, "prompt-runs", promptId] as const,
  trend: (uuid: string, weeks: number) =>
    ["re-visible", uuid, "trend", weeks] as const,
  competitors: (uuid: string) => ["re-visible", uuid, "competitors"] as const,
  sources: (uuid: string) => ["re-visible", uuid, "sources"] as const,
  site: (uuid: string, days: number) =>
    ["re-visible", uuid, "site", days] as const,
  suggestions: (uuid: string) => ["re-visible", uuid, "suggestions"] as const,
};

/**
 * The overview, which doubles as the "is this set up?" check.
 *
 * Returns null for a site with no project — that is the first-run state, not an
 * error, and the page renders its wizard off this null.
 */
export function useVisibilityOverview(pluginUuid: string, enabled = true) {
  return useQuery({
    queryKey: reVisibleKeys.overview(pluginUuid),
    queryFn: () => getVisibilityOverview(pluginUuid),
    enabled: enabled && !!pluginUuid,
    staleTime: 60_000,
  });
}

/**
 * The tracking config itself.
 *
 * Separate from the overview on purpose: the overview returns a PRESENTATION
 * subset (no aliases, no competitors, no samples-per-prompt), and the Settings
 * form needs the real row. Synthesising it from the overview meant the
 * competitor list was always `[]` — so every "Add" sent `[...[], one]` and
 * silently replaced the previous entry.
 */
export function useVisibilityProject(pluginUuid: string, enabled = true) {
  return useQuery({
    queryKey: reVisibleKeys.project(pluginUuid),
    queryFn: () => getVisibilityProject(pluginUuid),
    enabled: enabled && !!pluginUuid,
    // The form binds to this; never refetch behind someone who is editing.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useVisibilityPrompts(pluginUuid: string, enabled = true) {
  return useQuery({
    queryKey: reVisibleKeys.prompts(pluginUuid),
    queryFn: () => getVisibilityPrompts(pluginUuid),
    enabled: enabled && !!pluginUuid,
    staleTime: 60_000,
  });
}

export function useVisibilityPromptRuns(
  pluginUuid: string,
  promptId: string | null,
) {
  return useQuery({
    queryKey: reVisibleKeys.promptRuns(pluginUuid, promptId ?? ""),
    queryFn: () => getVisibilityPromptRuns(pluginUuid, promptId!),
    enabled: !!pluginUuid && !!promptId,
    staleTime: 5 * 60_000,
  });
}

export function useVisibilityTrend(
  pluginUuid: string,
  weeks = 12,
  enabled = true,
) {
  return useQuery({
    queryKey: reVisibleKeys.trend(pluginUuid, weeks),
    queryFn: () => getVisibilityTrend(pluginUuid, weeks),
    enabled: enabled && !!pluginUuid,
    staleTime: 5 * 60_000,
  });
}

export function useVisibilityCompetitors(pluginUuid: string, enabled = true) {
  return useQuery({
    queryKey: reVisibleKeys.competitors(pluginUuid),
    queryFn: () => getVisibilityCompetitors(pluginUuid),
    enabled: enabled && !!pluginUuid,
    staleTime: 5 * 60_000,
  });
}

export function useVisibilitySources(pluginUuid: string, enabled = true) {
  return useQuery({
    queryKey: reVisibleKeys.sources(pluginUuid),
    queryFn: () => getVisibilitySources(pluginUuid),
    enabled: enabled && !!pluginUuid,
    staleTime: 5 * 60_000,
  });
}

/** Audit + telemetry. Independent of the project: it is the plugin's own data. */
export function useVisibilitySite(
  pluginUuid: string,
  days = 30,
  enabled = true,
) {
  return useQuery({
    queryKey: reVisibleKeys.site(pluginUuid, days),
    queryFn: () => getVisibilitySite(pluginUuid, days),
    enabled: enabled && !!pluginUuid,
    staleTime: 60_000,
  });
}

export function useVisibilitySuggestions(pluginUuid: string, enabled = true) {
  return useQuery({
    queryKey: reVisibleKeys.suggestions(pluginUuid),
    queryFn: () => getVisibilitySuggestions(pluginUuid),
    enabled: enabled && !!pluginUuid,
    staleTime: 60_000,
  });
}

/* ---------------------------------------------------------------------------
 * Mutations
 * ------------------------------------------------------------------------ */

export function useCreateVisibilityProject(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Partial<VisibilityProject> & { brand_name: string }) =>
      createVisibilityProject(pluginUuid, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.root(pluginUuid) });
    },
  });
}

export function useUpdateVisibilityProject(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      updateVisibilityProject(pluginUuid, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.root(pluginUuid) });
    },
  });
}

export function useAddVisibilityPrompts(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prompts: { text: string; topic?: string | null; intent?: string }[]) =>
      addVisibilityPrompts(pluginUuid, prompts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.prompts(pluginUuid) });
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.overview(pluginUuid) });
    },
  });
}

/**
 * Generate candidates.
 *
 * No cache write: candidates are not state until the user accepts them, and
 * caching a list of unaccepted suggestions would make "Generate more" show the
 * same batch twice.
 */
export function useGenerateVisibilityPrompts(pluginUuid: string) {
  return useMutation({
    mutationFn: () => generateVisibilityPrompts(pluginUuid),
  });
}

export function useAcceptVisibilityPrompts(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prompts: PromptCandidate[]) =>
      acceptVisibilityPrompts(pluginUuid, prompts),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.prompts(pluginUuid) });
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.overview(pluginUuid) });
    },
  });
}

export function useUpdateVisibilityPrompt(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      promptId,
      ...body
    }: {
      promptId: string;
      text?: string;
      topic?: string | null;
      intent?: string;
      active?: boolean;
    }) => updateVisibilityPrompt(pluginUuid, promptId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.prompts(pluginUuid) });
    },
  });
}

export function useDeleteVisibilityPrompt(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (promptId: string) =>
      deleteVisibilityPrompt(pluginUuid, promptId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.prompts(pluginUuid) });
      queryClient.invalidateQueries({ queryKey: reVisibleKeys.overview(pluginUuid) });
    },
  });
}

/**
 * Start a run.
 *
 * Resolving means the batch was CREATED, not finished. The caller streams
 * progress and invalidates on completion — invalidating here would refetch
 * rates that no run has produced yet.
 */
export function useRunVisibilityNow(pluginUuid: string) {
  return useMutation({
    mutationFn: () => runVisibilityNow(pluginUuid),
  });
}

/** Refetch everything a finished run changed. */
export function useInvalidateVisibility(pluginUuid: string) {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({ queryKey: reVisibleKeys.root(pluginUuid) });
}

export function useRefreshVisibilitySite(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => refreshVisibilitySite(pluginUuid),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["re-visible", pluginUuid, "site"],
      });
    },
  });
}

export function useRunVisibilityFix(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (checkId: string) => runVisibilityFix(pluginUuid, checkId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["re-visible", pluginUuid, "site"],
      });
    },
  });
}

export function useSuggestForPost(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (wpPostId: number) => suggestForPost(pluginUuid, wpPostId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reVisibleKeys.suggestions(pluginUuid),
      });
    },
  });
}

export function useSetSuggestionStatus(pluginUuid: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      suggestionId,
      status,
    }: {
      suggestionId: string;
      status: Suggestion["status"];
    }) => setSuggestionStatus(pluginUuid, suggestionId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: reVisibleKeys.suggestions(pluginUuid),
      });
    },
  });
}
