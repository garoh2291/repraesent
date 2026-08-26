import { apiClient } from "./axios-instance";

// ---------------------------------------------------------------------------
// Connection
// ---------------------------------------------------------------------------

export interface OpenaiAdsConnectionStatus {
  connected: boolean;
  ad_account_id: string | null;
  ad_account_name: string | null;
  api_key_masked: string | null;
  status: "connected" | "error" | "revoked" | null;
  auth_failed_at: string | null;
  last_error: string | null;
  pixel_id: string | null;
  conversions_enabled: boolean;
  connected_at: string | null;
}

export async function getOpenaiAdsConnection(): Promise<OpenaiAdsConnectionStatus> {
  const res = await apiClient.get<OpenaiAdsConnectionStatus>(
    "/openai-ads/connection",
  );
  return res.data;
}

export async function connectOpenaiAds(
  apiKey: string,
): Promise<OpenaiAdsConnectionStatus> {
  const res = await apiClient.put<OpenaiAdsConnectionStatus>(
    "/openai-ads/connection",
    { api_key: apiKey },
  );
  return res.data;
}

export async function testOpenaiAds(): Promise<{
  ok: boolean;
  ad_account_id: string | null;
  ad_account_name: string | null;
}> {
  const res = await apiClient.post("/openai-ads/connection/test");
  return res.data;
}

export async function disconnectOpenaiAds(): Promise<void> {
  await apiClient.delete("/openai-ads/connection");
}

/**
 * A workspace with no connection answers 409 with this code on every
 * /openai-ads route — the difference between the connect empty state and an
 * error toast.
 */
export function isOpenaiAdsNotConnected(error: unknown): boolean {
  const e = error as {
    response?: { data?: { code?: string } };
  } | null;
  return e?.response?.data?.code === "openai_ads_not_connected";
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

export interface OpenaiCampaign {
  id: string;
  name: string;
  status: string;
  description?: string | null;
  bidding_type?: string;
  budget?: { lifetime_spend_limit_micros?: number };
  start_time?: string | null;
  end_time?: string | null;
}

export interface OpenaiAdGroup {
  id: string;
  campaign_id: string;
  name: string;
  status: string;
  bidding_config?: { billing_event_type?: string; max_bid_micros?: number };
}

export interface OpenaiAd {
  id: string;
  ad_group_id: string;
  name: string;
  status: string;
  review_status?: "in_review" | "rejected" | "approved";
  creative?: {
    type?: string;
    title?: string;
    body?: string;
    target_url?: string;
    file_id?: string;
    price?: string;
  };
}

interface EntityList<T> {
  data: T[];
  truncated: boolean;
}

export async function listOpenaiCampaigns(): Promise<
  EntityList<OpenaiCampaign>
> {
  const res = await apiClient.get<EntityList<OpenaiCampaign>>(
    "/openai-ads/campaigns",
  );
  return res.data;
}

export async function listOpenaiAdGroups(
  campaignId: string,
): Promise<EntityList<OpenaiAdGroup>> {
  const res = await apiClient.get<EntityList<OpenaiAdGroup>>(
    "/openai-ads/ad-groups",
    { params: { campaign_id: campaignId } },
  );
  return res.data;
}

export async function listOpenaiAds(
  adGroupId: string,
): Promise<EntityList<OpenaiAd>> {
  const res = await apiClient.get<EntityList<OpenaiAd>>("/openai-ads/ads", {
    params: { ad_group_id: adGroupId },
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export type OpenaiInsightsLevel = "ad_account" | "campaign" | "ad_group" | "ad";

export interface OpenaiInsightRow {
  date: string | null;
  impressions: number;
  clicks: number;
  spend_micros: number;
  ctr: number | null;
  cpc_micros: number | null;
  cpm_micros: number | null;
  conversions: number;
  click_through_conversions: number;
  view_through_conversions: number;
}

export interface OpenaiInsights {
  rows: OpenaiInsightRow[];
  summary: Omit<OpenaiInsightRow, "date">;
  truncated: boolean;
}

export async function getOpenaiInsights(params: {
  level: OpenaiInsightsLevel;
  entity_id?: string;
  since: string;
  until: string;
  granularity?: "hourly" | "daily" | "monthly" | "none";
}): Promise<OpenaiInsights> {
  const res = await apiClient.get<OpenaiInsights>("/openai-ads/insights", {
    params,
  });
  return res.data;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type OpenaiEntityAction = "activate" | "pause" | "archive";
export type OpenaiEntityKind = "campaigns" | "ad-groups" | "ads";

export async function openaiEntityAction(
  kind: OpenaiEntityKind,
  id: string,
  action: OpenaiEntityAction,
): Promise<void> {
  await apiClient.post(
    `/openai-ads/${kind}/${encodeURIComponent(id)}/actions`,
    { action },
  );
}

export async function updateOpenaiCampaignBudget(
  campaignId: string,
  lifetimeSpendLimitMicros: number,
): Promise<OpenaiCampaign> {
  const res = await apiClient.patch<OpenaiCampaign>(
    `/openai-ads/campaigns/${encodeURIComponent(campaignId)}`,
    { lifetime_spend_limit_micros: lifetimeSpendLimitMicros },
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export async function uploadOpenaiFile(
  file: File,
): Promise<{ file_id: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await apiClient.post<{ file_id: string }>(
    "/openai-ads/files",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data;
}

export async function createOpenaiCampaign(body: {
  name: string;
  lifetime_spend_limit_micros: number;
  bidding_type?: "impressions" | "clicks" | "conversions";
  conversion_event_setting_ids?: string[];
  description?: string;
}): Promise<OpenaiCampaign> {
  const res = await apiClient.post<OpenaiCampaign>(
    "/openai-ads/campaigns",
    body,
  );
  return res.data;
}

export async function createOpenaiAdGroup(body: {
  campaign_id: string;
  name: string;
  billing_event_type: "impression" | "click";
  max_bid_micros: number;
  context_hints?: string[];
}): Promise<OpenaiAdGroup> {
  const res = await apiClient.post<OpenaiAdGroup>(
    "/openai-ads/ad-groups",
    body,
  );
  return res.data;
}

export async function createOpenaiAd(body: {
  ad_group_id: string;
  name: string;
  creative_type: "chat_card" | "product_ad_template";
  title: string;
  body: string;
  target_url: string;
  file_id?: string;
  price?: string;
}): Promise<OpenaiAd> {
  const res = await apiClient.post<OpenaiAd>("/openai-ads/ads", body);
  return res.data;
}

export async function previewOpenaiAd(
  adId: string,
): Promise<Record<string, unknown>> {
  const res = await apiClient.post(
    `/openai-ads/ads/${encodeURIComponent(adId)}/preview`,
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Conversions
// ---------------------------------------------------------------------------

export interface OpenaiConversionsSetupResult {
  pixel_id: string;
  conversions_enabled: boolean;
  lead_event_setting_id: string | null;
  appointment_event_setting_id: string | null;
}

export async function setupOpenaiConversions(): Promise<OpenaiConversionsSetupResult> {
  const res = await apiClient.post<OpenaiConversionsSetupResult>(
    "/openai-ads/conversions/setup",
  );
  return res.data;
}

export interface OpenaiConversionsQueueStatus {
  pending: number;
  sent: number;
  failed_recently: number;
  last_error: string | null;
}

export async function getOpenaiConversionsStatus(): Promise<OpenaiConversionsQueueStatus> {
  const res = await apiClient.get<OpenaiConversionsQueueStatus>(
    "/openai-ads/conversions/status",
  );
  return res.data;
}

export async function getOpenaiConversionsDebug(): Promise<{
  data: Record<string, unknown>[];
}> {
  const res = await apiClient.get("/openai-ads/conversions/debug");
  return res.data;
}

/** The copy-paste pixel snippet for externally hosted landing pages. */
export function buildPixelSnippet(pixelId: string): string {
  return `<script>
  (function (w, d, s, u) {
    if (w.oaiq) return;
    var q = function () { q.q.push(arguments); };
    q.q = [];
    w.oaiq = q;
    var js = d.createElement(s);
    js.async = true;
    js.src = u;
    var f = d.getElementsByTagName(s)[0];
    f.parentNode.insertBefore(js, f);
  })(window, document, "script", "https://bzrcdn.openai.com/sdk/oaiq.min.js");

  oaiq("init", { pixelId: "${pixelId}" });
</script>`;
}
