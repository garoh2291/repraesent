import { apiClient } from "./axios-instance";

export type ResultPeriod = "7d" | "30d" | "90d" | "12m";

export type SourceBucket =
  | "google"
  | "facebook"
  | "instagram"
  | "website"
  | "chat"
  | "openai"
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
    };

export async function getResultsSummary(
  period: ResultPeriod,
): Promise<ResultsSummary> {
  const { data } = await apiClient.get("/results/summary", {
    params: { period },
  });
  return data;
}
