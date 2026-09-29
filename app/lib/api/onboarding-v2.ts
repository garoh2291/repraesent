import { apiClient } from "./axios-instance";
import type { AssistantLevel } from "./onboarding-chat";

/** Backend: nestjs-monolith/src/modules/onboarding-v2 (see ONBOARDING_V2_PLAN.md). */

export const ONBOARDING_STEPS = [
  "business",
  "website",
  "reading",
  "details",
  "you",
  "google",
  "social",
  "goals",
  "growth",
  "sales",
  "email",
  "domain",
  "team",
  "notifications",
  "billing",
  "plan",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type ProfileData = Record<string, Record<string, unknown>>;

export interface FieldSource {
  source: "user" | "website" | "google" | "facebook" | "system";
  url?: string;
  confirmed: boolean;
  at: string;
}

export interface ProgressEvent {
  code:
    | "started"
    | "pages_found"
    | "found_address"
    | "found_contact"
    | "found_hours"
    | "found_legal"
    | "found_socials"
    | "found_team"
    | "found_offer"
    | "found_cms"
    | "understanding"
    | "done"
    | "skipped_changed_site"
    | "failed";
  count?: number;
  value?: string;
}

export interface EnrichmentJob {
  id: string;
  kind: "website" | "google" | "facebook";
  status: "queued" | "running" | "done" | "failed";
  progress: ProgressEvent[];
  found_count: number | null;
  fields: string[];
  error: string | null;
  input_url: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface PriceQuote {
  /** Region key from Settings → Onboarding → Prices (europe, canada, …). */
  region: string;
  /** ISO 4217 — any currency a region is set up with. */
  currency: string;
  yearly: number;
  monthly: number;
  twelveMonthly: number;
  saved: number;
  /** Free months at the start; nothing is invoiced before `firstInvoiceMonth`. */
  freeMonths: number;
  firstInvoiceMonth?: number;
  perDay: number;
  addons: {
    cmsTransfer: number;
    newWebsite: number;
    franchise: number[];
    managedAds: { monthly: number; setup: number };
    contentUpdates: { monthly: number; yearly: number };
    socialPosts: { monthly: number; yearly: number };
    hourly: number;
  };
  vatIncluded: false;
}

export type NotificationKey =
  | "weekly_leads_digest"
  | "daily_tasks_digest"
  | "weekly_pipeline_summary"
  | "stale_leads_reminder"
  | "monthly_performance_report";

export const NOTIFICATION_KEYS: NotificationKey[] = [
  "weekly_leads_digest",
  "daily_tasks_digest",
  "weekly_pipeline_summary",
  "stale_leads_reminder",
  "monthly_performance_report",
];

export interface Answers {
  notifications?: {
    keys: NotificationKey[];
    audience: "all_members" | "selected";
    recipient_emails: string[];
  };
  plan?: { cycle: "yearly" };
}

export interface Invite {
  email: string;
  role: "admin" | "editor" | "viewer";
}

export interface OnboardingState {
  /** Who calls after setup (intro screen): names + photos of the sales hosts. */
  sales_team?: Array<{ label: string | null; avatar_url: string | null }>;
  /** The AI onboarding assistant: offered only when the root switched it on (texts resolved for this customer). */
  assistant?: {
    available: boolean;
    /** The picked assistant's name (null until the customer picks one in the chat). */
    name: string | null;
    assistants?: Array<{ key: AssistantLevel; name: string }>;
    chosen?: AssistantLevel | null;
    intro: { headline: string | null; sub: string | null } | null;
  };
  user: { id: string; email: string; first_name: string | null; last_name: string | null; locale: string };
  run: {
    id: string;
    status: "in_progress" | "completed" | "abandoned";
    current_step: OnboardingStep;
    adopted: boolean;
    answers: Answers;
    invites: Invite[];
    booking: { start: string; end: string; host_label: string | null; meet_link: string | null } | null;
    started_at: string;
    completed_at: string | null;
    intake_ready: boolean;
    welcome_dismissed: boolean;
  } | null;
  workspace: { id: string; name: string; status: string | null; website: string | null; has_billing: boolean } | null;
  profile: { data: ProfileData; field_sources: Record<string, FieldSource> } | null;
  jobs: EnrichmentJob[];
  billing_prefill: Record<string, string | null> | null;
  pricing: PriceQuote;
  privacy_url: string;
  terms_url: string | null;
  steps: OnboardingStep[];
  tax_id_rejected?: boolean;
}

export interface PlaceCandidate {
  place_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  rating: number | null;
  review_count: number | null;
  maps_url: string | null;
  website: string | null;
  primary_type: string | null;
  lat: number | null;
  lng: number | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  hours: Record<string, Array<{ open: string; close: string }>> | null;
}

export interface FacebookCandidate {
  url: string;
  title: string;
  snippet: string;
  from: "website" | "search";
}

const base = "/onboarding/v2";

export async function getOnboardingState(): Promise<OnboardingState> {
  // The browser's time zone picks the price region (CA$ for Canada) before the
  // business has a country of its own.
  let tz: string | undefined;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    tz = undefined;
  }
  return (await apiClient.get<OnboardingState>(`${base}/state`, tz ? { params: { tz } } : undefined)).data;
}

export async function startBusiness(body: { name: string; website?: string | null; timezone?: string }) {
  return (await apiClient.post<OnboardingState>(`${base}/business`, body)).data;
}

export async function updateBusiness(body: { name?: string; website?: string | null }) {
  return (await apiClient.patch<OnboardingState>(`${base}/business`, body)).data;
}

export async function saveStep(body: {
  step: OnboardingStep;
  next_step: OnboardingStep;
  profile?: ProfileData;
  answers?: Answers;
  confirm_paths?: string[];
  skipped?: boolean;
}) {
  return (await apiClient.post<OnboardingState>(`${base}/steps`, body)).data;
}

export async function trackStepEvent(step: OnboardingStep, event: "view" | "back" | "skip" | "error") {
  try {
    await apiClient.post(`${base}/events`, { step, event });
  } catch {
    /* analytics must never break the wizard */
  }
}

export async function saveInvites(invites: Invite[]) {
  return (await apiClient.post<OnboardingState>(`${base}/invites`, { invites })).data;
}

export async function saveBilling(body: {
  legal_name: string;
  contact_name: string;
  email: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  postal_code: string;
  state?: string | null;
  country: string;
  vat_id?: string | null;
}) {
  return (await apiClient.post<OnboardingState>(`${base}/billing`, body)).data;
}

export async function completeOnboarding() {
  return (await apiClient.post<OnboardingState>(`${base}/complete`, { consent: true })).data;
}

export async function lookupGoogle(body: { mode: "phone" | "find"; phone?: string; name?: string; city?: string }) {
  return (await apiClient.post<{ jobId: string; candidates: PlaceCandidate[] }>(`${base}/enrich/google`, body)).data;
}

export async function lookupFacebook(body: { name?: string; city?: string } = {}) {
  return (await apiClient.post<{ jobId: string | null; candidates: FacebookCandidate[] }>(`${base}/enrich/facebook`, body)).data;
}

export async function retryWebsiteRead() {
  return (await apiClient.post<OnboardingState>(`${base}/enrich/website/retry`)).data;
}

export async function getEnrichmentJob(jobId: string) {
  return (
    await apiClient.get<{ job: EnrichmentJob; profile: OnboardingState["profile"] }>(`${base}/enrich/${jobId}`)
  ).data;
}

export interface SalesConfig {
  /** The workspace the (latest completed) onboarding set up. */
  workspace_id?: string;
  enabled: boolean;
  ready: boolean;
  booking: { start: string; end: string; host_label: string | null; meet_link: string | null } | null;
  duration_minutes?: number;
  timezone?: string;
  max_days_ahead?: number;
  hosts: Array<{ label: string | null; avatar_url: string | null }>;
}

export async function getSalesConfig() {
  return (await apiClient.get<SalesConfig>(`${base}/sales/config`)).data;
}

export async function getSalesDays(from: string, to: string) {
  return (
    await apiClient.get<{ days: Array<{ date: string; state: string; free: number }>; unavailable: boolean }>(
      `${base}/sales/days`,
      { params: { from, to } },
    )
  ).data;
}

export async function getSalesSlots(date: string) {
  return (await apiClient.get<{ slots: string[]; unavailable: boolean }>(`${base}/sales/slots`, { params: { date } })).data;
}

export async function bookSalesCall(slot: string) {
  return (
    await apiClient.post<{ booking: { start: string; end: string; host_label: string | null; meet_link: string | null } }>(
      `${base}/sales/book`,
      { slot },
    )
  ).data;
}

export async function dismissWelcome() {
  await apiClient.post(`${base}/welcome/dismiss`);
}

/** `response.data.details.errors` → { "path": "reason" } (or {}). */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  const data = (error as { response?: { data?: { details?: { errors?: Record<string, string> } } } })?.response?.data;
  return data?.details?.errors ?? {};
}

export function errorCodeOf(error: unknown): string | undefined {
  return (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
}

export interface DomainDetectResult {
  domain: string | null;
  /** Our registrar key when the registry (or the nameservers) said so. */
  registrar: string | null;
  /** The registry's own words, e.g. "InterNetX GmbH". */
  registrar_name: string | null;
  registrar_source: "rdap" | "nameservers" | null;
  dns_host: string | null;
}

/** Where the business domain is registered and who runs its DNS (best effort). */
export async function detectDomain(domain?: string) {
  return (await apiClient.post<DomainDetectResult>(`${base}/enrich/domain`, domain ? { domain } : {})).data;
}
