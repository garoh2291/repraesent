import { apiClient } from "./axios-instance";

/**
 * Root workspace onboarding config (backend: root-workspace module).
 * Every endpoint 404s outside the root workspace or for non-admins.
 */

export interface SalesHost {
  /** Calendar the calls are written to (same grammar as calendarKeyFor). */
  targetKey: string;
  userId: string;
  label?: string;
  avatarUrl?: string;
  email?: string;
}

/** Sales regions (backend common/sales-region.ts). Europe's team is `hosts`. */
export const SALES_REGIONS = ["europe", "us", "canada", "australia"] as const;
export type SalesRegion = (typeof SALES_REGIONS)[number];

export interface RootBookingConfig {
  hosts: SalesHost[];
  /** US / Canada / Australia teams; an empty list = that region uses Europe's team. */
  regionHosts?: Partial<Record<Exclude<SalesRegion, "europe">, SalesHost[]>>;
  checkAllOwnerCalendars: boolean;
  durationMinutes: number;
  window: { start: string; end: string };
  weekdays: string[];
  timezone: string;
  minNoticeHours: number;
  maxDaysAhead: number;
}

export type AssignPolicy = "booked_host" | "fixed" | "none";

export interface RootOnboardingSettings {
  workspace_id: string;
  booking_enabled: boolean;
  booking: RootBookingConfig;
  meeting_title: string | null;
  pipeline_id: string | null;
  stage_key: string | null;
  assign_policy: AssignPolicy;
  assign_user_id: string | null;
  updated_at: string | null;
}

export type RootOnboardingSettingsInput = Omit<
  RootOnboardingSettings,
  "workspace_id" | "updated_at"
>;

export interface RootPipelineOption {
  id: string;
  name: string;
  is_default: boolean;
  stages: Array<{
    key: string;
    label: string | null;
    category: string;
    is_entry: boolean;
  }>;
}

export interface MergedDay {
  date: string;
  state: "open" | "closed" | "past" | "horizon";
  free: number;
  hostIndexes: number[];
}

export interface MergedSlot {
  slot: string;
  hostUserIds: string[];
  hostIndexes: number[];
}

export interface MergedDaysResult {
  days: MergedDay[];
  unavailable: boolean;
  failedHostIndexes: number[];
}

export interface MergedSlotsResult {
  slots: MergedSlot[];
  unavailable: boolean;
  failedHostIndexes: number[];
}

export interface TestIntakeResult {
  leadId: string;
  contactId: string | null;
  dealId: string | null;
  noteId: string | null;
  booking: {
    start: string;
    end: string;
    host_user_id: string | null;
    host_label: string | null;
    meet_link: string | null;
  } | null;
}

export async function getRootOnboardingSettings(): Promise<RootOnboardingSettings> {
  const { data } = await apiClient.get<RootOnboardingSettings>(
    "/root-onboarding/settings",
  );
  return data;
}

export async function saveRootOnboardingSettings(
  input: RootOnboardingSettingsInput,
): Promise<RootOnboardingSettings> {
  const { data } = await apiClient.put<RootOnboardingSettings>(
    "/root-onboarding/settings",
    input,
  );
  return data;
}

export async function getRootPipelines(): Promise<RootPipelineOption[]> {
  const { data } = await apiClient.get<RootPipelineOption[]>(
    "/root-onboarding/pipelines",
  );
  return data;
}

export async function previewRootDays(
  booking: RootBookingConfig,
  from: string,
  to: string,
): Promise<MergedDaysResult> {
  const { data } = await apiClient.post<MergedDaysResult>(
    "/root-onboarding/availability/preview-days",
    { booking, from, to },
  );
  return data;
}

export async function previewRootSlots(
  booking: RootBookingConfig,
  date: string,
): Promise<MergedSlotsResult> {
  const { data } = await apiClient.post<MergedSlotsResult>(
    "/root-onboarding/availability/preview-slots",
    { booking, date },
  );
  return data;
}

export async function runRootTestIntake(
  slot?: string,
): Promise<TestIntakeResult> {
  const { data } = await apiClient.post<TestIntakeResult>(
    "/root-onboarding/test-intake",
    slot ? { slot } : {},
  );
  return data;
}

// ── Prices (Settings → Onboarding → Prices) ──────────────────────────────────

/** Minor units (cents), excl. VAT. Mirrors nestjs pricing.core RegionPrices. */
export interface RegionPrices {
  plan: { yearly: number; monthly: number };
  addons: {
    cmsTransfer: number;
    newWebsite: number;
    franchise: number[];
    managedAds: { monthly: number; setup: number };
    contentUpdates: { monthly: number; yearly: number };
    socialPosts: { monthly: number; yearly: number };
    hourly: number;
  };
}

export type PriceSource = "seed" | "manual" | "website" | "fallback";

export interface PriceRegion {
  key: string;
  label: string;
  currency: string;
  countries: string[];
  timezones: string[];
  isDefault: boolean;
  prices: RegionPrices;
  source: PriceSource;
  fallbackFrom: string | null;
  syncedAt: string | null;
  updatedAt: string | null;
}

export interface PricingSettings {
  regions: PriceRegion[];
  /** false until migration 184 is applied — the built-in prices are in use. */
  editable: boolean;
  url: string;
}

export type SyncOutcome = "priced" | "not_priced_on_site" | "unreadable";

export interface ProposedRegion {
  key: string;
  label: string;
  currency: string;
  countries: string[];
  timezones: string[];
  isNew: boolean;
  outcome: SyncOutcome;
  source: "website" | "fallback";
  fallbackFrom: string | null;
  prices: RegionPrices;
  found: string[];
  rejected: string[];
  changes: Array<{ path: string; from: number | null; to: number }>;
  currencyChanged: boolean;
}

export interface PricingProposal {
  id: string;
  createdAt: string;
  url: string;
  regions: ProposedRegion[];
  missingOnSite: string[];
  hasChanges: boolean;
}

export const pricingKey = (workspaceId: string | null | undefined) => ["root-onboarding", "pricing", workspaceId ?? null] as const;

export async function getPricing(): Promise<PricingSettings> {
  return (await apiClient.get<PricingSettings>("/root-onboarding/pricing")).data;
}

export async function saveRegion(
  key: string,
  body: { label: string; currency: string; countries: string[]; timezones: string[]; prices: RegionPrices },
): Promise<{ regions: PriceRegion[] }> {
  return (await apiClient.put<{ regions: PriceRegion[] }>(`/root-onboarding/pricing/regions/${encodeURIComponent(key)}`, body)).data;
}

export async function deleteRegion(key: string): Promise<{ regions: PriceRegion[] }> {
  return (await apiClient.delete<{ regions: PriceRegion[] }>(`/root-onboarding/pricing/regions/${encodeURIComponent(key)}`)).data;
}

export async function previewPricingSync(): Promise<{ proposal: PricingProposal; signature: string }> {
  return (await apiClient.post<{ proposal: PricingProposal; signature: string }>("/root-onboarding/pricing/sync/preview", undefined, { timeout: 180_000 })).data;
}

export async function applyPricingSync(proposal: PricingProposal, signature: string): Promise<{ regions: PriceRegion[] }> {
  return (await apiClient.post<{ regions: PriceRegion[] }>("/root-onboarding/pricing/sync/apply", { proposal, signature })).data;
}

export async function setPricingUrl(url: string | null): Promise<{ url: string }> {
  return (await apiClient.put<{ url: string }>("/root-onboarding/pricing/url", { url })).data;
}
