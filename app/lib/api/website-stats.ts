import { apiClient } from "./axios-instance";

/**
 * Website visitors explorer (/analytics), read from pa-002 by
 * /users/me/workspace/website-stats/*. Every call returns null when the
 * workspace's website is not tracked or the stats server does not answer.
 */

export type StatsDimension =
  | "channel"
  | "source"
  | "referrer"
  | "utm_medium"
  | "utm_source"
  | "utm_campaign"
  | "utm_content"
  | "utm_term"
  | "page"
  | "entry_page"
  | "exit_page"
  | "country"
  | "region"
  | "device"
  | "browser"
  | "os"
  | "goal";

export type StatsMetric =
  | "visitors"
  | "visits"
  | "pageviews"
  | "views_per_visit"
  | "bounce_rate"
  | "visit_duration";

export type StatsInterval = "hour" | "day" | "week" | "month";
export type StatsCompare = "off" | "previous" | "year";
export type FilterOp = "is" | "is_not" | "contains";

export interface StatsFilter {
  dim: StatsDimension;
  op: FilterOp;
  values: string[];
}

export interface StatsParams {
  from: string;
  to: string;
  tz: string;
  filters: StatsFilter[];
}

export interface Totals {
  visitors: number;
  visits: number;
  pageviews: number;
  views_per_visit: number;
  bounce_rate: number;
  visit_duration: number;
}

export interface Overview {
  site_id: string;
  range: { from: string; to: string };
  compare_range: { from: string; to: string } | null;
  current: Totals;
  previous: Totals | null;
}

export interface Series {
  metric: StatsMetric;
  interval: StatsInterval;
  points: { date: string; value: number }[];
  previous: { date: string; value: number }[] | null;
}

export interface BreakdownRow {
  value: string;
  visitors: number;
  visits: number;
  pageviews: number;
  bounce_rate: number | null;
  visit_duration: number | null;
}

export interface Breakdown {
  dimension: StatsDimension;
  page: number;
  has_more: boolean;
  rows: BreakdownRow[];
}

export interface Goals {
  total_visitors: number;
  rows: { goal: string; visitors: number; events: number; conversion_rate: number }[];
}

export interface GoalProps {
  goal: string;
  rows: { key: string; value: string; visitors: number; events: number }[];
}

/**
 * Where the stats come from: the current workspace (X-Workspace-Id), or one
 * partner house read by its brand. `key` keeps their caches apart.
 */
export interface StatsScope {
  base: string;
  key: string;
}

export function workspaceScope(workspaceId: string | undefined): StatsScope {
  return { base: "/users/me/workspace/website-stats", key: `ws:${workspaceId ?? ""}` };
}

export function brandScope(houseId: string): StatsScope {
  return { base: `/brands/me/website-stats/${encodeURIComponent(houseId)}`, key: `brand:${houseId}` };
}

function base(p: StatsParams): Record<string, string> {
  const out: Record<string, string> = { from: p.from, to: p.to, tz: p.tz };
  if (p.filters.length) out.filters = JSON.stringify(p.filters);
  return out;
}

export async function getStatsOverview(s: StatsScope, p: StatsParams, compare: StatsCompare) {
  const res = await apiClient.get<Overview | null>(`${s.base}/overview`, {
    params: { ...base(p), compare },
  });
  return res.data ?? null;
}

export async function getStatsSeries(
  s: StatsScope,
  p: StatsParams,
  metric: StatsMetric,
  interval: StatsInterval,
  compare: StatsCompare,
) {
  const res = await apiClient.get<Series | null>(`${s.base}/timeseries`, {
    params: { ...base(p), metric, interval, compare },
  });
  return res.data ?? null;
}

export async function getStatsBreakdown(
  s: StatsScope,
  p: StatsParams,
  dimension: Exclude<StatsDimension, "goal">,
  opts: { limit?: number; page?: number; search?: string } = {},
) {
  const res = await apiClient.get<Breakdown | null>(`${s.base}/breakdown`, {
    params: {
      ...base(p),
      dimension,
      limit: opts.limit ?? 10,
      page: opts.page ?? 1,
      ...(opts.search ? { search: opts.search } : {}),
    },
  });
  return res.data ?? null;
}

export async function getStatsGoals(s: StatsScope, p: StatsParams) {
  const res = await apiClient.get<Goals | null>(`${s.base}/goals`, { params: base(p) });
  return res.data ?? null;
}

export async function getStatsGoalProps(s: StatsScope, p: StatsParams, goal: string) {
  const res = await apiClient.get<GoalProps | null>(`${s.base}/goal-props`, {
    params: { ...base(p), goal },
  });
  return res.data ?? null;
}

export async function getStatsRealtime(s: StatsScope) {
  const res = await apiClient.get<{ visitors: number } | null>(`${s.base}/realtime`);
  return res.data ?? null;
}

/** Query keys: everything a result depends on, so cache entries never mix. */
export const statsKeys = {
  overview: (s: StatsScope, p: StatsParams, c: StatsCompare) =>
    ["website-stats", s.key, "overview", p, c] as const,
  series: (s: StatsScope, p: StatsParams, m: StatsMetric, i: StatsInterval, c: StatsCompare) =>
    ["website-stats", s.key, "series", p, m, i, c] as const,
  breakdown: (
    s: StatsScope,
    p: StatsParams,
    d: StatsDimension,
    opts: { limit?: number; page?: number; search?: string },
  ) => ["website-stats", s.key, "breakdown", p, d, opts] as const,
  goals: (s: StatsScope, p: StatsParams) => ["website-stats", s.key, "goals", p] as const,
  goalProps: (s: StatsScope, p: StatsParams, g: string) =>
    ["website-stats", s.key, "goal-props", p, g] as const,
  realtime: (s: StatsScope) => ["website-stats", s.key, "realtime"] as const,
};
