import { apiClient } from "./axios-instance";

/**
 * AI Analytics (re:visible) API.
 *
 * Every path is a managed-plugin endpoint under the workspace's own WordPress
 * site — `/wordpress/site/plugins/:pluginUuid/…` — so the site is resolved
 * server-side from workspace membership and never named by the client.
 */
const base = (pluginUuid: string) => `/wordpress/site/plugins/${pluginUuid}`;

export type VisibilityEngine = "chatgpt" | "claude" | "perplexity" | "gemini";

export const VISIBILITY_ENGINES: VisibilityEngine[] = [
  "chatgpt",
  "claude",
  "perplexity",
  "gemini",
];

export type PromptIntent =
  | "category"
  | "comparison"
  | "problem"
  | "pricing"
  | "branded"
  | "local";

export const PROMPT_INTENTS: PromptIntent[] = [
  "category",
  "comparison",
  "problem",
  "pricing",
  "branded",
  "local",
];

export interface VisibilityCompetitor {
  name: string;
  domains: string[];
}

export interface VisibilityProject {
  id: string;
  brand_name: string;
  brand_aliases: string[];
  competitors: VisibilityCompetitor[];
  site_domains: string[];
  locale: string;
  country: string | null;
  engines: string[];
  runs_per_prompt: number;
  weekly_run_cap: number;
  monthly_cost_cap_micro_usd: number;
  status: "active" | "paused";
  next_run_at: string | null;
  last_run_at: string | null;
}

export interface VisibilityPrompt {
  id: string;
  text: string;
  topic: string | null;
  intent: PromptIntent;
  source: "ai" | "user";
  active: boolean;
  sort_order: number;
}

/** Three different things, deliberately reported separately. */
export interface EngineRates {
  engine: string;
  prompts_total: number;
  runs_total: number;
  /** Share of runs where the engine actually searched. */
  grounded_rate: number;
  /** Share of runs whose answer named the brand. */
  mention_rate: number;
  /** Share of GROUNDED runs that cited one of the brand's own pages. */
  citation_rate: number;
  /** Share of runs that put the brand forward as a pick. */
  recommendation_rate: number;
}

export interface LosingPrompt {
  prompt_id: string;
  text: string;
  topic: string | null;
  intent: string;
  engines: string[];
  competitors: string[];
}

export interface VisibilityOverview {
  project: {
    id: string;
    brand_name: string;
    engines: string[];
    status: string;
    locale: string;
    country: string | null;
    site_domains: string[];
    last_run_at: string | null;
    next_run_at: string | null;
  };
  prompts_active: number;
  engines: EngineRates[];
  losing_prompts: LosingPrompt[];
  runs_this_week: number;
  cost_this_month_micro_usd: number;
  weekly_run_cap: number;
  monthly_cost_cap_micro_usd: number;
  last_batch: {
    started_at: string;
    finished_at: string | null;
    runs_total: number;
    runs_failed: number;
  } | null;
}

export interface TrendPoint {
  week_start: string;
  engine: string;
  mention_rate: number;
  citation_rate: number;
  recommendation_rate: number;
  runs_total: number;
}

export interface Citation {
  url: string;
  domain: string;
  title: string | null;
  start: number | null;
  end: number | null;
}

export interface BrandMention {
  name: string;
  position: number;
  is_self: boolean;
  is_competitor: boolean;
}

export interface PromptRun {
  id: string;
  engine: string;
  model: string | null;
  run_no: number;
  grounded: boolean;
  answer_text: string | null;
  citations: Citation[];
  brands_named: BrandMention[];
  own_mentioned: boolean;
  own_cited: boolean;
  recommended: boolean;
  sentiment: string | null;
  error: string | null;
  created_at: string;
}

export interface ShareOfVoiceEntry {
  name: string;
  is_self: boolean;
  mentions: number;
  share: number;
}

export interface CompetitorsResponse {
  per_engine: { engine: string; brands: ShareOfVoiceEntry[] }[];
  discovered: { name: string; mentions: number }[];
}

export interface SourcesResponse {
  third_party: { domain: string; count: number; is_self: boolean }[];
  own_pages: { url: string; count: number }[];
}

export interface AuditCheck {
  id: string;
  status: "pass" | "warn" | "fail" | "info" | string;
  detail: string;
  fix_available: boolean;
}

export interface SiteResponse {
  audit: {
    score: number;
    ran_at: string;
    plugin_version: string | null;
    checks: AuditCheck[];
  } | null;
  telemetry: {
    day: string;
    kind: "bot" | "referral" | string;
    key: string;
    count: number;
    sample_paths: string[];
  }[];
}

export interface SuggestionOutput {
  answer_block: string;
  faqs: { question: string; answer: string }[];
  schema_jsonld: Record<string, unknown> | null;
  structure_notes: string[];
  meta_title: string;
  meta_description: string;
}

export interface Suggestion {
  id: string;
  wp_post_id: number;
  post_title: string | null;
  post_url: string | null;
  status: "new" | "applied" | "dismissed";
  model: string | null;
  output: SuggestionOutput;
  created_at: string;
}

export interface PromptCandidate {
  text: string;
  topic: string | null;
  intent: PromptIntent;
}

export interface RunNowResult {
  runs_total: number;
  runs_failed: number;
  cost_micro_usd: number;
  /** A budget that is spent is information, not an error. */
  skipped:
    | "no_prompts"
    | "weekly_cap"
    | "monthly_cap"
    | "disabled"
    | null;
}

/* ---------------------------------------------------------------------------
 * Project
 * ------------------------------------------------------------------------ */

/** Null when AI Analytics has not been set up for this site yet. */
export async function getVisibilityProject(
  pluginUuid: string,
): Promise<VisibilityProject | null> {
  const res = await apiClient.get<VisibilityProject | null>(
    `${base(pluginUuid)}/visibility-project`,
  );

  return res.data ?? null;
}

export async function createVisibilityProject(
  pluginUuid: string,
  body: Partial<VisibilityProject> & { brand_name: string },
): Promise<VisibilityProject> {
  const res = await apiClient.post<VisibilityProject>(
    `${base(pluginUuid)}/visibility-project`,
    body,
  );

  return res.data;
}

export async function updateVisibilityProject(
  pluginUuid: string,
  body: Record<string, unknown>,
): Promise<VisibilityProject> {
  const res = await apiClient.put<VisibilityProject>(
    `${base(pluginUuid)}/visibility-project`,
    body,
  );

  return res.data;
}

/* ---------------------------------------------------------------------------
 * Prompts
 * ------------------------------------------------------------------------ */

export async function getVisibilityPrompts(
  pluginUuid: string,
): Promise<{ prompts: VisibilityPrompt[] }> {
  const res = await apiClient.get<{ prompts: VisibilityPrompt[] }>(
    `${base(pluginUuid)}/visibility-prompts`,
  );

  return res.data;
}

export async function addVisibilityPrompts(
  pluginUuid: string,
  prompts: { text: string; topic?: string | null; intent?: string }[],
): Promise<{ added: number; skipped: number; prompts: VisibilityPrompt[] }> {
  const res = await apiClient.post(`${base(pluginUuid)}/visibility-prompts`, {
    prompts,
  });

  return res.data;
}

export async function generateVisibilityPrompts(
  pluginUuid: string,
): Promise<{ candidates: PromptCandidate[]; used_site_content: boolean }> {
  const res = await apiClient.post(
    `${base(pluginUuid)}/visibility-prompts/generate`,
  );

  return res.data;
}

export async function acceptVisibilityPrompts(
  pluginUuid: string,
  prompts: PromptCandidate[],
): Promise<{ added: number; skipped: number; prompts: VisibilityPrompt[] }> {
  const res = await apiClient.post(
    `${base(pluginUuid)}/visibility-prompts/accept`,
    { prompts },
  );

  return res.data;
}

export async function updateVisibilityPrompt(
  pluginUuid: string,
  promptId: string,
  body: { text?: string; topic?: string | null; intent?: string; active?: boolean },
): Promise<VisibilityPrompt> {
  const res = await apiClient.put<VisibilityPrompt>(
    `${base(pluginUuid)}/visibility-prompts/${promptId}`,
    body,
  );

  return res.data;
}

export async function deleteVisibilityPrompt(
  pluginUuid: string,
  promptId: string,
): Promise<void> {
  await apiClient.delete(
    `${base(pluginUuid)}/visibility-prompts/${promptId}`,
  );
}

export async function getVisibilityPromptRuns(
  pluginUuid: string,
  promptId: string,
): Promise<{ runs: PromptRun[] }> {
  const res = await apiClient.get<{ runs: PromptRun[] }>(
    `${base(pluginUuid)}/visibility-prompts/${promptId}/runs`,
  );

  return res.data;
}

/* ---------------------------------------------------------------------------
 * Running and reading
 * ------------------------------------------------------------------------ */

export async function runVisibilityNow(
  pluginUuid: string,
): Promise<RunNowResult> {
  const res = await apiClient.post<RunNowResult>(
    `${base(pluginUuid)}/visibility-run`,
  );

  return res.data;
}

export async function getVisibilityOverview(
  pluginUuid: string,
): Promise<VisibilityOverview | null> {
  const res = await apiClient.get<VisibilityOverview | null>(
    `${base(pluginUuid)}/visibility-overview`,
  );

  return res.data ?? null;
}

export async function getVisibilityTrend(
  pluginUuid: string,
  weeks = 12,
): Promise<{ weeks: TrendPoint[] }> {
  const res = await apiClient.get<{ weeks: TrendPoint[] }>(
    `${base(pluginUuid)}/visibility-trend`,
    { params: { weeks } },
  );

  return res.data;
}

export async function getVisibilityCompetitors(
  pluginUuid: string,
): Promise<CompetitorsResponse> {
  const res = await apiClient.get<CompetitorsResponse>(
    `${base(pluginUuid)}/visibility-competitors`,
  );

  return res.data;
}

export async function getVisibilitySources(
  pluginUuid: string,
): Promise<SourcesResponse> {
  const res = await apiClient.get<SourcesResponse>(
    `${base(pluginUuid)}/visibility-sources`,
  );

  return res.data;
}

/* ---------------------------------------------------------------------------
 * Site health
 * ------------------------------------------------------------------------ */

export async function getVisibilitySite(
  pluginUuid: string,
  days = 30,
): Promise<SiteResponse> {
  const res = await apiClient.get<SiteResponse>(
    `${base(pluginUuid)}/visibility-site`,
    { params: { days } },
  );

  return res.data;
}

export async function refreshVisibilitySite(
  pluginUuid: string,
): Promise<SiteResponse> {
  const res = await apiClient.post<SiteResponse>(
    `${base(pluginUuid)}/visibility-site/refresh`,
  );

  return res.data;
}

export async function runVisibilityFix(
  pluginUuid: string,
  checkId: string,
): Promise<{ success: true }> {
  const res = await apiClient.post<{ success: true }>(
    `${base(pluginUuid)}/visibility-site/fix`,
    { check_id: checkId },
  );

  return res.data;
}

/* ---------------------------------------------------------------------------
 * Suggestions
 * ------------------------------------------------------------------------ */

export async function getVisibilitySuggestions(
  pluginUuid: string,
): Promise<{ suggestions: Suggestion[] }> {
  const res = await apiClient.get<{ suggestions: Suggestion[] }>(
    `${base(pluginUuid)}/visibility-suggestions`,
  );

  return res.data;
}

export async function suggestForPost(
  pluginUuid: string,
  wpPostId: number,
): Promise<{ cached: boolean; suggestion: Suggestion }> {
  const res = await apiClient.post(
    `${base(pluginUuid)}/visibility-suggestions/${wpPostId}`,
  );

  return res.data;
}

export async function setSuggestionStatus(
  pluginUuid: string,
  suggestionId: string,
  status: Suggestion["status"],
): Promise<void> {
  await apiClient.patch(
    `${base(pluginUuid)}/visibility-suggestions/${suggestionId}`,
    { status },
  );
}
