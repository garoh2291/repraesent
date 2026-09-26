import { apiClient } from "./axios-instance";
import type { PlaceCandidate } from "./onboarding-v2";

/** Google review asks (GOOGLE_REVIEWS_PLAN.md). Experimental — pilot workspaces only. */

export type ReviewMoment = "visit" | "paid";
export type ReviewDecision = "whatsapp" | "email" | "copy" | "skipped" | "later";

export type ReviewStatus =
  | { enabled: false }
  | {
      enabled: true;
      /** Migration 198 applied. */
      ready: boolean;
      moment: ReviewMoment;
      place_id: string | null;
      google_name: string | null;
      review_url: string | null;
      business_name: string | null;
      search_hint: string | null;
      places_available: boolean;
      /** "Don't ask" can be stored (migration 199). */
      can_skip?: boolean;
    };

export interface ReviewCandidate {
  contact_id: string;
  deal_id: string;
  deal_title: string | null;
  name: string;
  first_name: string | null;
  phone: string | null;
  email: string | null;
  done_at: string;
  /** Finished in the last 3 days. */
  fresh: boolean;
  /** "Not now" was pressed before. */
  snoozed: boolean;
}

export interface ReviewSummary {
  review_url: string;
  rating: number | null;
  total: number | null;
  new_since: number | null;
  since: string | null;
  asked_this_month: number;
}

export function reviewStatusKey(workspaceId: string | null | undefined) {
  return ["google-reviews", "status", workspaceId ?? null] as const;
}
export function reviewCandidatesKey(workspaceId: string | null | undefined) {
  return ["google-reviews", "candidates", workspaceId ?? null] as const;
}
export function reviewSummaryKey(workspaceId: string | null | undefined) {
  return ["google-reviews", "summary", workspaceId ?? null] as const;
}

export async function getReviewStatus(): Promise<ReviewStatus> {
  return (await apiClient.get<ReviewStatus>("/google-reviews/status")).data;
}

export async function getReviewCandidates(): Promise<{ total: number; items: ReviewCandidate[] }> {
  return (await apiClient.get<{ total: number; items: ReviewCandidate[] }>("/google-reviews/candidates")).data;
}

export async function getReviewForDeal(dealId: string): Promise<ReviewCandidate | null> {
  const { data } = await apiClient.get<ReviewCandidate | null | "">(`/google-reviews/deals/${dealId}`);
  return data || null;
}

export async function getReviewSummary(): Promise<ReviewSummary | null> {
  const { data } = await apiClient.get<ReviewSummary | null | "">("/google-reviews/summary");
  return data || null;
}

export async function decideReview(body: {
  contact_id: string;
  deal_id?: string | null;
  channel: ReviewDecision;
}): Promise<void> {
  await apiClient.post("/google-reviews/decisions", body);
}

export async function undoReview(contactId: string): Promise<void> {
  await apiClient.post("/google-reviews/decisions/undo", { contact_id: contactId });
}

export async function findGoogleListing(query: string): Promise<PlaceCandidate[]> {
  return (await apiClient.post<{ candidates: PlaceCandidate[] }>("/google-reviews/find", { query })).data.candidates;
}
