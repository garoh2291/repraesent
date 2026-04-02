import { apiClient } from "./axios-instance";

export interface ConnectedCampaign {
  id: string;
  campaign_id: string;
  campaign_name: string | null;
  campaign_status: string | null;
  account_id: string;
  account_name: string | null;
  platform: string;
  budget_daily: string | null;
  advertising_channel_type: string | null;
}

export interface InsightTotals {
  cost: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversions_value: number;
}

export interface DailyInsight {
  date: string;
  cost: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  conversions: number | null;
  conversions_value: number | null;
}

export interface CampaignInsightsResponse {
  totals: InsightTotals;
  series: DailyInsight[];
}

export interface WeeklyInsight {
  campaign_id: string;
  week_start: string;
  week_end: string;
  total_clicks: number | null;
  total_cost: number | null;
}

export interface AdInsight {
  campaign_id: string;
  ad_id: string;
  ad_name: string | null;
  platform: string;
  currency: string | null;
  cost: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  conversions: number | null;
}

export interface AdSetInsight {
  campaign_id: string;
  ad_set_id: string;
  ad_set_name: string | null;
  platform: string;
  currency: string | null;
  cost: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  conversions: number | null;
}

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface PaginatedCampaigns {
  data: ConnectedCampaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface CampaignListParams {
  platform?: string;
  search?: string;
  status?: "active" | "inactive";
  page?: number;
  limit?: number;
}

export async function getConnectedCampaigns(
  params: CampaignListParams = {}
): Promise<PaginatedCampaigns> {
  const res = await apiClient.get<PaginatedCampaigns>(
    "/users/me/workspace/campaigns",
    {
      params: {
        ...(params.platform ? { platform: params.platform } : {}),
        ...(params.search ? { search: params.search } : {}),
        ...(params.status ? { status: params.status } : {}),
        page: params.page ?? 1,
        limit: params.limit ?? 20,
      },
    }
  );
  return res.data;
}

export async function getCampaignsOverview(
  range: DateRange,
  platform?: string,
  campaignIds?: string[]
): Promise<CampaignInsightsResponse> {
  const res = await apiClient.get<CampaignInsightsResponse>(
    "/users/me/workspace/campaigns/overview",
    {
      params: {
        start_date: range.startDate,
        end_date: range.endDate,
        ...(platform ? { platform } : {}),
        ...(campaignIds?.length ? { campaign_ids: campaignIds.join(",") } : {}),
      },
    }
  );
  return res.data;
}

export async function getCampaignInsights(
  campaignId: string,
  range: DateRange
): Promise<CampaignInsightsResponse> {
  const res = await apiClient.get<CampaignInsightsResponse>(
    `/users/me/workspace/campaigns/${campaignId}/insights`,
    { params: { start_date: range.startDate, end_date: range.endDate } }
  );
  return res.data;
}

export async function getCampaignWeekly(
  campaignId: string
): Promise<WeeklyInsight[]> {
  const res = await apiClient.get<WeeklyInsight[]>(
    `/users/me/workspace/campaigns/${campaignId}/insights/weekly`
  );
  return res.data;
}

export async function getCampaignAds(
  campaignId: string
): Promise<AdInsight[]> {
  const res = await apiClient.get<AdInsight[]>(
    `/users/me/workspace/campaigns/${campaignId}/insights/ads`
  );
  return res.data;
}

export async function getCampaignAdSets(
  campaignId: string
): Promise<AdSetInsight[]> {
  const res = await apiClient.get<AdSetInsight[]>(
    `/users/me/workspace/campaigns/${campaignId}/insights/ad-sets`
  );
  return res.data;
}
