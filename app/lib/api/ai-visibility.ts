import { apiClient, getStoredToken, getStoredWorkspaceId } from "./axios-instance";

/** AI visibility (AI_VISIBILITY_PLAN.md). Shapes mirror nestjs ai-visibility. */

export const AI_ENGINES = ["chatgpt", "perplexity", "gemini", "claude", "grok"] as const;
export type AiEngine = (typeof AI_ENGINES)[number];
export type Cadence = "daily" | "three_weekly" | "weekly";
export type PackageKey = "starter" | "growth" | "pro" | "custom";
export type Period = "7d" | "30d" | "90d";
export type PromptIntent = "informational" | "commercial" | "transactional";
export type PromptStatus = "active" | "suggested" | "archived";
export type DomainType = "corporate" | "editorial" | "institutional" | "ugc" | "reference" | "directory" | "other";
export type ActionStatus = "new" | "in_progress" | "done" | "dismissed";
export type ActionKind = "own_content" | "comparison_page" | "earned_media" | "directory" | "community" | "reference" | "technical" | "fact_fix";

export interface EngineInfo {
  engine: AiEngine;
  label: string;
  model: string;
  available: boolean;
  micro_usd_per_answer: number;
  measured: boolean;
}

export interface CostEstimate {
  answers_per_month: number;
  micro_usd_per_month: number;
  eur_cents_per_month: number;
  suggested_cap_eur_cents: number;
  per_engine: Array<{
    engine: AiEngine;
    answers_per_month: number;
    micro_usd_per_answer: number;
    measured: boolean;
    micro_usd_per_month: number;
    eur_cents_per_month: number;
  }>;
}

export interface Project {
  id: string;
  brand_name: string;
  brand_aliases: string[];
  brand_domains: string[];
  website_url: string | null;
  description: string | null;
  industry: string | null;
  country: string | null;
  language: string;
  engines: AiEngine[];
  cadence: Cadence;
  package: PackageKey;
  prompt_limit: number;
  monthly_cap_eur_cents: number;
  status: "setup" | "active" | "paused";
  paused_reason: "manual" | "cap" | "key" | null;
  next_run_at: string | null;
  last_run_at: string | null;
  created_at: string;
}

export interface Competitor {
  id: string;
  name: string;
  aliases: string[];
  domains: string[];
  color: string | null;
  source: string;
  status: "tracked" | "rejected";
}

export interface Topic {
  id: string;
  name: string;
}

export interface Prefill {
  brand_name: string;
  brand_aliases: string[];
  brand_domains: string[];
  website_url: string | null;
  description: string | null;
  industry: string | null;
  country: string | null;
  language: string;
  services: string[];
}

export interface LatestBatch {
  id: string;
  trigger: string;
  run_date: string;
  answers_planned: number;
  answers_done: number;
  answers_failed: number;
  cost_micro_usd: number;
  error: string | null;
  started_at: string;
  finished_at: string | null;
  running: boolean;
}

export type JobKind = "analyze_site" | "suggest_prompts" | "refresh_actions" | "run" | "classify_domains";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

/** A durable background job (ai_visibility_jobs). Survives closed tabs and restarts. */
export interface Job {
  id: string;
  project_id: string | null;
  kind: JobKind;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: unknown;
  error: string | null;
  attempts: number;
  max_attempts: number;
  cancel_requested: boolean;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  seen_at: string | null;
}

export const isActiveJob = (j: Pick<Job, "status">) => j.status === "queued" || j.status === "running";

export interface KeyState {
  connected: boolean;
  status: string | null;
  last_error: string | null;
}

export type Status =
  | {
      project: null;
      jobs: Job[];
      prefill: Prefill;
      key: KeyState;
      engines: EngineInfo[];
      packages: Array<{ key: PackageKey; prompt_limit: number; engines: AiEngine[] }>;
      disabled: boolean;
    }
  | {
      project: Project;
      jobs: Job[];
      key: KeyState;
      active_prompts: number;
      competitors: Competitor[];
      topics: Topic[];
      spend: { month_micro_usd: number; month_eur_cents: number; cap_micro_usd: number; cap_eur_cents: number };
      estimate: { at_limit: CostEstimate; at_active: CostEstimate };
      engines: EngineInfo[];
      packages: Array<{ key: PackageKey; prompt_limit: number; engines: AiEngine[] }>;
      latest_batch: LatestBatch | null;
      actions_generated_at: string | null;
      disabled: boolean;
    };

export type ProjectState = Extract<Status, { project: Project }>;

export interface BrandMetrics {
  key: string;
  name: string;
  is_own: boolean;
  answers: number;
  answers_named: number;
  visibility: number | null;
  mentions: number;
  share_of_voice: number | null;
  position: number | null;
  tone: number | null;
  color?: string | null;
  previous_visibility?: number | null;
}

export interface EngineRow {
  engine: AiEngine;
  answers: number;
  failed: number;
  visibility: number | null;
  position: number | null;
  tone: number | null;
  cited: number;
}

export interface DomainRow {
  domain: string;
  owner: "own" | "competitor" | null;
  owner_name: string | null;
  answers_used: number;
  used_pct: number;
  citations: number;
  citation_share: number;
  urls: number;
  gap_answers: number;
  gap_competitors: number;
  gap_score: number;
  type: DomainType | null;
  type_source?: string | null;
}

export interface UrlRow {
  url: string;
  domain: string;
  title: string | null;
  owner: "own" | "competitor" | null;
  answers_used: number;
  citations: number;
  prompts: number;
  gap_answers: number;
  gap_score: number;
  type: DomainType | null;
}

export interface Action {
  id: string;
  kind: ActionKind;
  title: string;
  why: string;
  steps: string[];
  evidence: Record<string, unknown>;
  impact: number;
  status: ActionStatus;
  status_changed_at: string | null;
  created_at: string;
  updated_at: string;
  /** The CRM task "I'm on it" created, while it exists. */
  task_id: string | null;
  task_status: "todo" | "in_progress" | "done" | null;
  task_due_date: string | null;
  task_assignee_id: string | null;
  task_assignee_name: string | null;
}

export type FactTopic = "hours" | "address" | "phone" | "email" | "website" | "services" | "prices";

/** "What AI gets wrong about you". ready=false: the server is not set up for it yet (migration 197). */
export type FactsSummary =
  | { ready: false; known: FactTopic[] }
  | {
      ready: true;
      /** Topics we can check, from the business details. Empty = ask for them. */
      known: FactTopic[];
      /** Answers that said something concrete about the business. */
      checked: number;
      ok: number;
      wrong: Array<{
        topic: FactTopic;
        fact: string;
        answers: number;
        engines: AiEngine[];
        examples: Array<{ said: string; engine: AiEngine; answer_id: string; run_date: string }>;
      }>;
      words: { own: string[]; rival: { name: string; words: string[] } | null };
    };

export interface Overview {
  period: Period;
  from: string;
  to: string;
  answers: number;
  failed: number;
  own: BrandMetrics & { rank: number | null; recommended: number | null };
  previous: BrandMetrics & { rank: number | null };
  brands_count: number;
  cited_not_named: number;
  brands: BrandMetrics[];
  trend: Array<{ date: string; answers: number; values: Record<string, number | null> }>;
  engines: EngineRow[];
  top_sources: DomainRow[];
  actions: Action[];
}

export interface PromptRow {
  id: string;
  text: string;
  topic_id: string | null;
  topic: string | null;
  country: string | null;
  intent: PromptIntent;
  branded: boolean;
  status: PromptStatus;
  source: string;
  created_at: string;
  metrics: {
    answers: number;
    visibility: number | null;
    position: number | null;
    tone: number | null;
    top_brands: Array<{ key: string; name: string; visibility: number }>;
  } | null;
}

export interface PromptsPage {
  period: Period;
  limit: number;
  active: number;
  topics: Topic[];
  prompts: PromptRow[];
}

export interface AnswerSummary {
  id: string;
  prompt_id: string;
  prompt: string;
  engine: AiEngine;
  model: string;
  run_date: string;
  own_mentioned: boolean;
  own_position: number | null;
  own_sentiment: number | null;
  recommended: boolean;
  own_cited: boolean;
  grounded: boolean;
  brands_total: number;
  error: string | null;
  created_at: string;
  brands: Array<{ name: string; is_own: boolean; competitor_id: string | null; position: number }>;
}

export interface AnswerDetail extends Omit<AnswerSummary, "brands" | "brands_total"> {
  country: string | null;
  answer_text: string | null;
  cost_micro_usd: number;
  latency_ms: number | null;
  mentions: Array<{
    name: string;
    is_own: boolean;
    competitor_id: string | null;
    position: number;
    mention_count: number;
    sentiment: number | null;
    color: string | null;
  }>;
  sources: Array<{ url: string; domain: string; title: string | null; position: number; owner: "own" | "competitor" | null; owner_name: string | null }>;
}

export interface PromptDetail {
  prompt: Omit<PromptRow, "topic" | "metrics">;
  own: BrandMetrics & { rank: number | null };
  brands: BrandMetrics[];
  engines: EngineRow[];
  sources: DomainRow[];
  answers: { total: number; items: AnswerSummary[] };
}

export interface CompetitorsPage {
  period: Period;
  brands: Array<BrandMetrics & { aliases: string[]; domains: string[]; source: string | null }>;
  suggestions: Array<{ name: string; answers: number }>;
  rejected: Array<{ id: string; name: string }>;
}

export interface SourcesPage {
  period: Period;
  answers: number;
  grounded: number | null;
  cited_not_named: number;
  by_type: Record<string, number>;
  domains: DomainRow[];
  urls: UrlRow[];
  gaps: DomainRow[];
}

export interface SiteProfile extends Prefill {
  competitors: Array<{ name: string; domain: string | null }>;
  topics: string[];
  read_pages: number;
  cost_micro_usd: number;
}

export interface BatchStart {
  batch_id: string | null;
  planned: number;
  skipped: "no_prompts" | "no_key" | "cap" | "disabled" | "nothing_due" | "not_active" | null;
}

export interface BatchProgress {
  batch_id: string;
  planned: number;
  done: number;
  failed: number;
  cost_micro_usd: number;
  finished: boolean;
  error: string | null;
  engines: Array<{ engine: string; done: number }>;
}

export interface Filters {
  period: Period;
  engine?: AiEngine | null;
  topic_id?: string | null;
}

function params(f: object) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) if (v !== null && v !== undefined && v !== "") out[k] = String(v);
  return out;
}

const base = "/ai-visibility";

export const aiVisibilityApi = {
  status: () => apiClient.get<Status>(base).then((r) => r.data),
  saveProject: (body: Partial<Omit<Project, "id" | "status">> & { monthly_cap_eur_cents?: number }) =>
    apiClient.put<ProjectState>(`${base}/project`, body).then((r) => r.data),
  deleteProject: () => apiClient.delete(`${base}/project`),
  estimate: (body: { prompts: number; engines: AiEngine[]; cadence: Cadence }) =>
    apiClient.post<CostEstimate>(`${base}/estimate`, body).then((r) => r.data),
  /** Queues the website read; the result lands on the job (kind analyze_site). */
  analyzeSite: (url: string | null) => apiClient.post<{ job: Job; existing: boolean }>(`${base}/setup/analyze-site`, { url }).then((r) => r.data),
  /** Queues question writing; results are saved as suggested questions. */
  suggestPrompts: (body: { count?: number; topics?: string[] }) =>
    apiClient.post<{ job: Job; existing: boolean }>(`${base}/setup/suggest-prompts`, body).then((r) => r.data),
  activate: (runNow = true) => apiClient.post<{ batch: BatchStart | null }>(`${base}/activate`, { run_now: runNow }).then((r) => r.data),
  pause: () => apiClient.post<ProjectState>(`${base}/pause`).then((r) => r.data),
  resume: () => apiClient.post<ProjectState>(`${base}/resume`).then((r) => r.data),
  run: () => apiClient.post<BatchStart & { job_id: string | null }>(`${base}/run`).then((r) => r.data),
  progress: (batchId: string) => apiClient.get<BatchProgress>(`${base}/runs/${batchId}`).then((r) => r.data),

  overview: (f: Filters) => apiClient.get<Overview>(`${base}/overview`, { params: params(f) }).then((r) => r.data),
  facts: (f: Filters) => apiClient.get<FactsSummary>(`${base}/facts`, { params: params(f) }).then((r) => r.data),
  prompts: (f: Filters) => apiClient.get<PromptsPage>(`${base}/prompts`, { params: params(f) }).then((r) => r.data),
  prompt: (id: string, f: Filters) => apiClient.get<PromptDetail>(`${base}/prompts/${id}`, { params: params(f) }).then((r) => r.data),
  competitors: (f: Filters) => apiClient.get<CompetitorsPage>(`${base}/competitors`, { params: params(f) }).then((r) => r.data),
  sources: (f: Filters) => apiClient.get<SourcesPage>(`${base}/sources`, { params: params(f) }).then((r) => r.data),
  answers: (f: Filters & { prompt_id?: string | null; mentioned?: "yes" | "no" | null; limit?: number; offset?: number }) =>
    apiClient.get<{ total: number; items: AnswerSummary[] }>(`${base}/answers`, { params: params(f) }).then((r) => r.data),
  answer: (id: string) => apiClient.get<AnswerDetail>(`${base}/answers/${id}`).then((r) => r.data),

  addCompetitor: (body: { name: string; aliases?: string[]; domains?: string[]; source?: "setup" | "suggestion" | "manual" }) =>
    apiClient.post<Competitor>(`${base}/competitors`, body).then((r) => r.data),
  updateCompetitor: (id: string, body: Partial<Pick<Competitor, "name" | "aliases" | "domains" | "status">>) =>
    apiClient.patch(`${base}/competitors/${id}`, body),
  deleteCompetitor: (id: string) => apiClient.delete(`${base}/competitors/${id}`),
  rejectSuggestion: (name: string) => apiClient.post(`${base}/competitors/reject`, { name }),

  addTopic: (name: string) => apiClient.post<{ id: string }>(`${base}/topics`, { name }).then((r) => r.data),
  renameTopic: (id: string, name: string) => apiClient.patch(`${base}/topics/${id}`, { name }),
  deleteTopic: (id: string) => apiClient.delete(`${base}/topics/${id}`),

  addPrompts: (
    prompts: Array<{ text: string; topic?: string | null; topic_id?: string | null; intent?: PromptIntent; country?: string | null }>,
    status: "active" | "suggested" = "active",
  ) => apiClient.post<{ added: number; skipped: number }>(`${base}/prompts`, { prompts, status }).then((r) => r.data),
  updatePrompt: (id: string, body: Partial<Pick<PromptRow, "text" | "topic_id" | "intent" | "country" | "branded" | "status">>) =>
    apiClient.patch(`${base}/prompts/${id}`, body),
  bulkPrompts: (ids: string[], action: PromptStatus | "delete") =>
    apiClient.post<{ updated: number }>(`${base}/prompts/bulk`, { ids, action }).then((r) => r.data),

  actions: () => apiClient.get<{ generated_at: string | null; actions: Action[] }>(`${base}/actions`).then((r) => r.data),
  setActionStatus: (id: string, status: ActionStatus) => apiClient.patch(`${base}/actions/${id}`, { status }),
  /** "I'm on it": creates (or returns) the linked task, assigned to me, due in 7 days. */
  startAction: (id: string) => apiClient.post<{ task_id: string; created: boolean }>(`${base}/actions/${id}/start`).then((r) => r.data),
  refreshActions: () => apiClient.post<{ job: Job; existing: boolean }>(`${base}/actions/refresh`).then((r) => r.data),

  jobs: () => apiClient.get<Job[]>(`${base}/jobs`).then((r) => r.data),
  cancelJob: (id: string) => apiClient.post<Job>(`${base}/jobs/${id}/cancel`).then((r) => r.data),
  retryJob: (id: string) => apiClient.post<Job>(`${base}/jobs/${id}/retry`).then((r) => r.data),
  seenJob: (id: string) => apiClient.post(`${base}/jobs/${id}/seen`),

  setDomainType: (domain: string, type: DomainType) => apiClient.put(`${base}/domain-types`, { domain, type }),
};

/**
 * Follow a run over SSE. Raw fetch, not EventSource: the endpoint needs the
 * Authorization and X-Workspace-Id headers. Resolves when the run finishes.
 */
export async function streamRun(batchId: string, onProgress: (p: BatchProgress) => void, signal?: AbortSignal): Promise<BatchProgress | null> {
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  const token = getStoredToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const workspaceId = getStoredWorkspaceId();
  if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
  const res = await fetch(`${apiClient.defaults.baseURL ?? ""}${base}/runs/${batchId}/stream`, { headers, signal });
  if (!res.ok || !res.body) throw new Error(`${res.status} ${res.statusText}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let last: BatchProgress | null = null;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      let event = "message";
      const data: string[] = [];
      for (const line of chunk.split("\n")) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }
      if (!data.length) continue;
      try {
        const payload = JSON.parse(data.join("\n"));
        if (event === "error") throw new Error(payload?.message ?? "Run stream failed");
        last = payload as BatchProgress;
        onProgress(last);
        if (event === "done") return last;
      } catch (err) {
        if (event === "error") throw err;
      }
    }
  }
  return last;
}

export function apiErrorCode(error: unknown): string | null {
  const e = error as { response?: { data?: { code?: string } } } | null;
  return e?.response?.data?.code ?? null;
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const e = error as { response?: { data?: { message?: string | string[] } }; message?: string } | null;
  const m = e?.response?.data?.message;
  if (Array.isArray(m)) return m.join(", ");
  return m || e?.message || fallback;
}
