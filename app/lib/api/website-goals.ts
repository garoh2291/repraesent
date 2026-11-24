import { useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./axios-instance";
import { statsQueryParams, type StatsCompare, type StatsParams } from "./website-stats";

/**
 * Website goals and "steps to your goal" for the current workspace
 * (/users/me/workspace/website-goals, /website-paths). Definitions live in our
 * database, numbers come from the website stats server.
 */

export type GoalKind = "preset" | "page" | "event";
export type PresetKey = "directions" | "whatsapp" | "social" | "download";

export interface PageMatch {
  path: string;
}
export interface EventMatch {
  name: string;
  prop?: { key: string; contains: string[] };
}

/** One goal or one step, as sent and stored. */
export interface GoalSpec {
  kind: GoalKind;
  preset?: PresetKey | null;
  match?: PageMatch | EventMatch | Record<string, never>;
}

export interface WebsiteGoal extends GoalSpec {
  id: string;
  label: string;
  position: number;
}

export interface PathStep extends GoalSpec {
  label: string;
}

export interface WebsitePath {
  id: string;
  label: string;
  steps: PathStep[];
  position: number;
}

export interface GoalStats {
  total_visitors: number;
  previous_total_visitors: number | null;
  rows: {
    id: string;
    visitors: number;
    events: number;
    conversion_rate: number;
    previous_visitors: number | null;
  }[];
}

export interface GoalDetails {
  sources: { value: string; visitors: number }[];
  pages: { value: string; visitors: number }[];
}

export interface PathStats {
  id: string;
  steps: { label: string; visitors: number; conversion_rate: number; step_rate: number; dropoff: number }[];
}

export interface GoalSuggestions {
  pages: { value: string; visitors: number }[];
  events: { value: string; visitors: number }[];
  hosts: { value: string; visitors: number }[];
}

export const GOALS_NOT_READY = "WEBSITE_GOALS_NOT_READY";
export const MAX_STEPS = 8;
export const MIN_STEPS = 2;

/** True when the server says the goals tables aren't there yet. */
export function isGoalsNotReady(err: unknown): boolean {
  return (err as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code === GOALS_NOT_READY;
}

const G = "/users/me/workspace/website-goals";
const P = "/users/me/workspace/website-paths";

export async function listGoals() {
  return (await apiClient.get<WebsiteGoal[]>(G)).data;
}
export async function getGoalStats(p: StatsParams, compare: StatsCompare) {
  return (await apiClient.get<GoalStats | null>(`${G}/stats`, { params: { ...statsQueryParams(p), compare } })).data ?? null;
}
export async function getGoalDetails(id: string, p: StatsParams) {
  return (await apiClient.get<GoalDetails | null>(`${G}/${id}/details`, { params: statsQueryParams(p) })).data ?? null;
}
export async function getGoalSuggestions(p: StatsParams) {
  return (
    await apiClient.get<GoalSuggestions | null>(`${G}/suggestions`, {
      params: statsQueryParams({ ...p, filters: [] }),
    })
  ).data ?? null;
}
export async function previewGoal(p: StatsParams, spec: GoalSpec) {
  return (
    await apiClient.get<{ visitors: number; total_visitors: number } | null>(`${G}/preview`, {
      params: { ...statsQueryParams(p), spec: JSON.stringify(spec) },
    })
  ).data ?? null;
}
export async function createGoal(body: GoalSpec & { label: string }) {
  return (await apiClient.post<WebsiteGoal>(G, body)).data;
}
export async function renameGoal(id: string, label: string) {
  return (await apiClient.patch<WebsiteGoal>(`${G}/${id}`, { label })).data;
}
/** Step lists that lost the goal's step (or were removed for having < 2 left). */
export interface GoalRemoval {
  paths: { id: string; label: string; steps_before: PathStep[]; removed: boolean }[];
}

export async function deleteGoal(id: string) {
  return (await apiClient.delete<GoalRemoval>(`${G}/${id}`)).data ?? { paths: [] };
}

/** Undo of deleteGoal: the goal, then each step list as it was. */
export async function undoGoalRemoval(id: string, removal: GoalRemoval) {
  await restoreGoal(id);
  for (const p of removal.paths) {
    if (p.removed) await restorePath(p.id);
    await updatePath(p.id, { steps: p.steps_before });
  }
}
export async function restoreGoal(id: string) {
  return (await apiClient.post<WebsiteGoal>(`${G}/${id}/restore`)).data;
}

export async function listPaths() {
  return (await apiClient.get<WebsitePath[]>(P)).data;
}
export async function getPathStats(id: string, p: StatsParams) {
  return (await apiClient.get<PathStats | null>(`${P}/${id}/stats`, { params: statsQueryParams(p) })).data ?? null;
}
export async function createPath(body: { label: string; steps: PathStep[] }) {
  return (await apiClient.post<WebsitePath>(P, body)).data;
}
export async function updatePath(id: string, body: { label?: string; steps?: PathStep[] }) {
  return (await apiClient.patch<WebsitePath>(`${P}/${id}`, body)).data;
}
export async function deletePath(id: string) {
  await apiClient.delete(`${P}/${id}`);
}
export async function restorePath(id: string) {
  return (await apiClient.post<WebsitePath>(`${P}/${id}/restore`)).data;
}

/** Keys: the workspace id is in every one, so switching business never mixes caches. */
export const goalKeys = {
  all: (ws: string) => ["website-goals", ws] as const,
  list: (ws: string) => ["website-goals", ws, "list"] as const,
  stats: (ws: string, p: StatsParams, c: StatsCompare) => ["website-goals", ws, "stats", p, c] as const,
  details: (ws: string, id: string, p: StatsParams) => ["website-goals", ws, "details", id, p] as const,
  suggestions: (ws: string, p: StatsParams) => ["website-goals", ws, "suggestions", p.from, p.to, p.tz] as const,
  preview: (ws: string, p: StatsParams, spec: GoalSpec) => ["website-goals", ws, "preview", p.from, p.to, p.tz, spec] as const,
  paths: (ws: string) => ["website-goals", ws, "paths"] as const,
  pathStats: (ws: string, id: string, p: StatsParams) => ["website-goals", ws, "path-stats", id, p] as const,
};

/** Everything a goal or path change touches, in one place. */
export function useInvalidateGoals(ws: string) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: goalKeys.all(ws) });
}
