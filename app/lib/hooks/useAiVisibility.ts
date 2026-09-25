"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { aiVisibilityApi, isActiveJob, type Filters, type Job, type JobKind } from "~/lib/api/ai-visibility";

/** Every key carries the workspace id — switching workspace must never serve the last one's data. */
export const aiVisibilityKeys = {
  all: (ws: string | null) => ["ai-visibility", ws] as const,
  status: (ws: string | null) => ["ai-visibility", ws, "status"] as const,
  overview: (ws: string | null, f: Filters) => ["ai-visibility", ws, "overview", f] as const,
  prompts: (ws: string | null, f: Filters) => ["ai-visibility", ws, "prompts", f] as const,
  prompt: (ws: string | null, id: string, f: Filters) => ["ai-visibility", ws, "prompt", id, f] as const,
  competitors: (ws: string | null, f: Filters) => ["ai-visibility", ws, "competitors", f] as const,
  sources: (ws: string | null, f: Filters) => ["ai-visibility", ws, "sources", f] as const,
  answers: (ws: string | null, f: object) => ["ai-visibility", ws, "answers", f] as const,
  answer: (ws: string | null, id: string) => ["ai-visibility", ws, "answer", id] as const,
  actions: (ws: string | null) => ["ai-visibility", ws, "actions"] as const,
};

const opts = { staleTime: 60_000, placeholderData: keepPreviousData } as const;

/**
 * Project state + the job list. Polls every 3 s while any job is queued or
 * running, and stops when none are — so a reload, a second tab or coming back
 * tomorrow always shows the true state of background work.
 */
export function useAiVisibilityStatus() {
  const ws = getStoredWorkspaceId();
  return useQuery({
    queryKey: aiVisibilityKeys.status(ws),
    queryFn: aiVisibilityApi.status,
    enabled: !!ws,
    staleTime: 30_000,
    refetchInterval: (q) => (q.state.data?.jobs?.some(isActiveJob) ? 3_000 : false),
  });
}

/** The newest job of a kind (the list is newest first). */
export function useAiVisibilityJob(kind: JobKind): Job | null {
  const { data } = useAiVisibilityStatus();
  return data?.jobs?.find((j) => j.kind === kind) ?? null;
}

export function useAiVisibilityOverview(f: Filters, enabled = true) {
  const ws = getStoredWorkspaceId();
  return useQuery({ queryKey: aiVisibilityKeys.overview(ws, f), queryFn: () => aiVisibilityApi.overview(f), enabled: enabled && !!ws, ...opts });
}

export function useAiVisibilityPrompts(f: Filters, enabled = true) {
  const ws = getStoredWorkspaceId();
  return useQuery({ queryKey: aiVisibilityKeys.prompts(ws, f), queryFn: () => aiVisibilityApi.prompts(f), enabled: enabled && !!ws, ...opts });
}

export function useAiVisibilityPrompt(id: string, f: Filters) {
  const ws = getStoredWorkspaceId();
  return useQuery({ queryKey: aiVisibilityKeys.prompt(ws, id, f), queryFn: () => aiVisibilityApi.prompt(id, f), enabled: !!ws && !!id, ...opts });
}

export function useAiVisibilityCompetitors(f: Filters, enabled = true) {
  const ws = getStoredWorkspaceId();
  return useQuery({ queryKey: aiVisibilityKeys.competitors(ws, f), queryFn: () => aiVisibilityApi.competitors(f), enabled: enabled && !!ws, ...opts });
}

export function useAiVisibilitySources(f: Filters, enabled = true) {
  const ws = getStoredWorkspaceId();
  return useQuery({ queryKey: aiVisibilityKeys.sources(ws, f), queryFn: () => aiVisibilityApi.sources(f), enabled: enabled && !!ws, ...opts });
}

export function useAiVisibilityAnswers(
  f: Filters & { prompt_id?: string | null; mentioned?: "yes" | "no" | null; limit?: number; offset?: number },
  enabled = true,
) {
  const ws = getStoredWorkspaceId();
  return useQuery({ queryKey: aiVisibilityKeys.answers(ws, f), queryFn: () => aiVisibilityApi.answers(f), enabled: enabled && !!ws, ...opts });
}

export function useAiVisibilityAnswer(id: string | null) {
  const ws = getStoredWorkspaceId();
  return useQuery({
    queryKey: aiVisibilityKeys.answer(ws, id ?? ""),
    queryFn: () => aiVisibilityApi.answer(id!),
    enabled: !!ws && !!id,
    staleTime: 10 * 60_000,
  });
}

export function useAiVisibilityActions(enabled = true) {
  const ws = getStoredWorkspaceId();
  return useQuery({ queryKey: aiVisibilityKeys.actions(ws), queryFn: aiVisibilityApi.actions, enabled: enabled && !!ws, staleTime: 60_000 });
}

/** One place that knows what a change invalidates: everything in the feature. */
export function useInvalidateAiVisibility() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries({ queryKey: aiVisibilityKeys.all(getStoredWorkspaceId()) }), [qc]);
}
