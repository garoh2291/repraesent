import { apiClient } from "./axios-instance";

export type ResultPeriod = "7d" | "30d" | "90d" | "12m";

export type SourceBucket =
  | "google"
  | "facebook"
  | "instagram"
  | "website"
  | "chat"
  | "openai"
  | "ai_assistants"
  | "booking"
  | "onboarding"
  | "manual"
  | "other";

export interface Funnel {
  people_saw: number | null;
  contacted: number;
  leads: number;
  new_customers: number;
  earned: number;
  /** Of `earned`, what is marked paid (deals + paid checkouts). Null/absent = paid tracking not ready. */
  paid?: number | null;
  /** `earned − paid`. */
  to_collect?: number | null;
}

export interface SourceRow {
  source: SourceBucket;
  saw: number | null;
  contacted: number;
  leads: number;
  customers: number;
  earned: number;
}

export type ResultsSummary =
  | { supported: false }
  | {
      supported: true;
      is_root: boolean;
      period: ResultPeriod;
      range: { from: string; to: string };
      previous_range: { from: string; to: string };
      currency: string;
      /** True once the workspace has marked a deal paid. Older API: absent. */
      paid_tracking?: boolean;
      funnel: Funnel;
      previous: Funnel;
      saw_parts: {
        website: number | null;
        ads: Record<string, number> | null;
        openai: number | null;
      };
      other_currencies: Record<string, number>;
      connected: { website: boolean; ads: string[]; openai: boolean };
      by_source: SourceRow[];
      trend: { date: string; leads: number }[] | null;
      /** Median time to the first reply. Null/absent = could not compute. */
      first_reply?: { median_minutes: number | null; sample: number; waiting: number } | null;
      /** Last AI visibility checks, read only. Null/absent = could not read. */
      ai_visibility?: AiVisibilitySummary | null;
      /** People AI assistants sent (organic referrals, not ChatGPT ads). Older API: absent. */
      from_ai?: { saw: number | null; contacted: number; customers: number; earned: number };
    };

export type AiVisibilitySummary =
  | { set_up: false }
  | {
      set_up: true;
      status: "active" | "paused";
      period_used: "7d" | "30d" | "90d";
      last_run_at: string | null;
      answers: number;
      named: number;
      visibility: number | null;
      previous_answers: number;
      previous_named: number;
      previous_visibility: number | null;
      rank: number | null;
      brands_count: number;
    };

export async function getResultsSummary(
  period: ResultPeriod,
): Promise<ResultsSummary> {
  const { data } = await apiClient.get("/results/summary", {
    params: { period },
  });
  return data;
}
