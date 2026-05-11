import { apiClient, getStoredWorkspaceId, getStoredToken } from "./axios-instance";
import type { Lead, LeadHistoryItem } from "./leads";
import type { Note } from "./notes";

const BASE = "/users/me/workspace/doorboost-brand";

export interface BrandRetailer {
  retailer_id: string;
  retailer_name: string;
}

export interface BrandRetailerCampaign {
  campaign_id: string;
  campaign_name: string | null;
  campaign_status: string | null;
  account_id: string;
  account_name: string | null;
  platform: string;
  budget_daily: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface InsightSeriesPoint {
  date: string;
  cost: number | null;
  impressions: number | null;
  clicks: number | null;
  reach: number | null;
  conversions: number | null;
  conversions_value: number | null;
}

export interface InsightTotals {
  cost: number;
  impressions: number;
  clicks: number;
  reach: number;
  conversions: number;
  conversions_value: number;
}

export interface RetailerSocialAdsResponse {
  totals: InsightTotals;
  series: InsightSeriesPoint[];
}

export interface RetailerLead {
  id: string;
  platform: string;
  platform_created_at: string;
  platform_lead_id: string;
  platform_account_id: string;
  platform_campaign_id: string;
  campaign_id: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  created_at: string;
}

export interface RetailerLeadsResponse {
  data: RetailerLead[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface RetailerLeadFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  platform?: string;
  /** Drill-in from the social-ads page. */
  platform_campaign_id?: string;
  from?: string;
  to?: string;
}

/**
 * Filters for the brand-wide leads endpoint. Same as the retailer scope plus
 * an optional `retailer_id` to narrow aggregated results to a single retailer.
 */
export interface BrandLeadFilters extends RetailerLeadFilters {
  retailer_id?: string;
}

/** Brand-wide campaign summary — extends the per-retailer shape with retailer info. */
export interface BrandCampaign extends BrandRetailerCampaign {
  retailer_id: string;
  retailer_name: string;
}

export async function listBrandRetailers(): Promise<BrandRetailer[]> {
  const r = await apiClient.get<BrandRetailer[]>(`${BASE}/retailers`);
  return r.data;
}

export async function listBrandRetailerCampaigns(
  retailerId: string,
  opts: { platform?: string; search?: string; limit?: number } = {},
): Promise<BrandRetailerCampaign[]> {
  // Backend returns a paginated envelope { data, total, page, ... }. The
  // backend already scopes campaigns to the workspace's doorboost_brand_id —
  // we just forward optional platform/search so e.g. the leads-page dropdown
  // can narrow by platform without paging.
  const r = await apiClient.get<{ data: BrandRetailerCampaign[] }>(
    `${BASE}/retailers/${retailerId}/campaigns`,
    {
      params: {
        limit: opts.limit ?? 100,
        ...(opts.platform ? { platform: opts.platform } : {}),
        ...(opts.search ? { search: opts.search } : {}),
      },
    },
  );
  return Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
}

export async function getBrandRetailerSocialAds(
  retailerId: string,
  opts: {
    from?: string;
    to?: string;
    campaignIds?: string[];
    platform?: string;
  } = {},
): Promise<RetailerSocialAdsResponse> {
  const r = await apiClient.get<RetailerSocialAdsResponse>(
    `${BASE}/retailers/${retailerId}/social-ads`,
    {
      params: {
        ...(opts.from && { from: opts.from }),
        ...(opts.to && { to: opts.to }),
        ...(opts.platform && { platform: opts.platform }),
        ...(opts.campaignIds?.length && {
          campaign_ids: opts.campaignIds.join(","),
        }),
      },
    },
  );
  return r.data;
}

export async function listBrandRetailerLeads(
  retailerId: string,
  opts: RetailerLeadFilters = {},
): Promise<RetailerLeadsResponse> {
  const r = await apiClient.get<RetailerLeadsResponse>(
    `${BASE}/retailers/${retailerId}/leads`,
    { params: opts },
  );
  return r.data;
}

/**
 * Build a fully-authenticated download URL for the leads xlsx export.
 * Token is appended as a query param so the browser's <a download> works
 * without needing axios. Workspace context is also encoded as a query
 * param so the backend's WorkspaceGuard accepts it (mirrored to header
 * by the auth middleware).
 *
 * Falls back to header-driven downloads when this isn't possible.
 */
export function buildBrandRetailerLeadsExportUrl(
  retailerId: string,
  opts: RetailerLeadFilters = {},
): string {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.status) params.set("status", opts.status);
  if (opts.platform) params.set("platform", opts.platform);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  const wsId = getStoredWorkspaceId();
  const token = getStoredToken();
  if (wsId) params.set("workspace_id", wsId);
  if (token) params.set("access_token", token);
  return `${apiClient.defaults.baseURL ?? ""}${BASE}/retailers/${retailerId}/leads/export?${params.toString()}`;
}

/**
 * Fetch the export blob via axios (so the X-Workspace-Id header is set
 * automatically) and trigger a browser download. Preferred over the URL
 * builder when reliable header-based auth is available.
 */
export interface BrandPlatformCampaign {
  campaign_id: string;
  platform: string;
  retailer_id: string;
  campaign_name: string;
}

export interface BrandPlatformCampaignsPage {
  data: BrandPlatformCampaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/**
 * Step 2 of the bulk-export modal: paginated + searchable list of every
 * platform campaign attached to the chosen retailers (backend scopes to the
 * caller's brand). Search matches campaign_name or campaign_id.
 */
export async function listBrandPlatformCampaignsForRetailers(
  retailerIds: string[],
  opts: { q?: string; page?: number; limit?: number } = {},
): Promise<BrandPlatformCampaignsPage> {
  // POST not GET — a brand can hold hundreds of retailer ids, which would
  // blow past URL length limits as a query string.
  // An empty `retailerIds` is intentional and means "all brand retailers";
  // the backend expands it server-side. We do NOT short-circuit here.
  const r = await apiClient.post<BrandPlatformCampaignsPage>(
    `${BASE}/platform-campaigns`,
    {
      retailer_ids: retailerIds,
      ...(opts.q ? { q: opts.q } : {}),
      ...(opts.page ? { page: opts.page } : {}),
      ...(opts.limit ? { limit: opts.limit } : {}),
    },
  );
  return r.data;
}

/**
 * Bulk export across many retailers + platform campaigns. Triggers a
 * browser download with `leads-YYYY-MM-DD.xlsx`.
 */
export async function downloadBulkBrandLeadsXlsx(
  retailerIds: string[],
  platformCampaignIds: string[],
): Promise<void> {
  const response = await apiClient.post<Blob>(
    `${BASE}/leads/export-bulk`,
    {
      retailer_ids: retailerIds,
      platform_campaign_ids: platformCampaignIds,
    },
    { responseType: "blob" },
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadBrandRetailerLeadsXlsx(
  retailerId: string,
  retailerName: string | undefined,
  opts: RetailerLeadFilters = {},
): Promise<void> {
  const response = await apiClient.get<Blob>(
    `${BASE}/retailers/${retailerId}/leads/export`,
    {
      params: opts,
      responseType: "blob",
    },
  );
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe =
    (retailerName ?? retailerId)
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "retailer";
  a.download = `${safe}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── brand-wide aggregations (across every retailer in the brand) ──

export async function getBrandSocialAds(
  opts: {
    from?: string;
    to?: string;
    campaignIds?: string[];
    platform?: string;
  } = {},
): Promise<RetailerSocialAdsResponse> {
  const r = await apiClient.get<RetailerSocialAdsResponse>(
    `${BASE}/social-ads`,
    {
      params: {
        ...(opts.from && { from: opts.from }),
        ...(opts.to && { to: opts.to }),
        ...(opts.platform && { platform: opts.platform }),
        ...(opts.campaignIds?.length && {
          campaign_ids: opts.campaignIds.join(","),
        }),
      },
    },
  );
  return r.data;
}

export async function listBrandCampaigns(
  opts: { platform?: string; search?: string; limit?: number } = {},
): Promise<BrandCampaign[]> {
  const r = await apiClient.get<{ data: BrandCampaign[] }>(
    `${BASE}/campaigns`,
    {
      params: {
        limit: opts.limit ?? 200,
        ...(opts.platform ? { platform: opts.platform } : {}),
        ...(opts.search ? { search: opts.search } : {}),
      },
    },
  );
  return Array.isArray(r.data) ? r.data : (r.data?.data ?? []);
}

/** Full paginated envelope of brand-wide campaigns. */
export interface BrandCampaignsPage {
  data: BrandCampaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface BrandCampaignFilters {
  page?: number;
  limit?: number;
  platform?: string;
  search?: string;
  status?: "active" | "inactive";
  /** ISO YYYY-MM-DD. campaign.start_date >= this. */
  start_date_from?: string;
  /** ISO YYYY-MM-DD. campaign.end_date <= this. */
  end_date_to?: string;
}

/**
 * Paginated brand-wide campaigns. Used by the dedicated /brand-campaigns
 * page. Returns the full envelope so the table can drive server-side
 * pagination directly off the response.
 */
export async function listBrandCampaignsPage(
  opts: BrandCampaignFilters = {},
): Promise<BrandCampaignsPage> {
  const r = await apiClient.get<BrandCampaignsPage>(`${BASE}/campaigns`, {
    params: opts,
  });
  return r.data;
}

export async function listBrandLeads(
  opts: BrandLeadFilters = {},
): Promise<RetailerLeadsResponse> {
  const r = await apiClient.get<RetailerLeadsResponse>(`${BASE}/leads`, {
    params: opts,
  });
  return r.data;
}

// ── brand-scoped lead detail (read-only) ──

/**
 * Fetch a single lead via the brand-scoped endpoint. Authorisation is by
 * brand-campaign membership, not workspace, so a brand admin can audit leads
 * that live in a retailer's lead-form workspace.
 */
export async function getBrandLead(leadId: string): Promise<Lead> {
  const r = await apiClient.get<Lead>(`${BASE}/leads/${leadId}`);
  return r.data;
}

export async function getBrandLeadNotes(leadId: string): Promise<Note[]> {
  const r = await apiClient.get<Note[]>(`${BASE}/leads/${leadId}/notes`);
  return r.data;
}

export async function getBrandLeadHistory(
  leadId: string,
): Promise<LeadHistoryItem[]> {
  const r = await apiClient.get<LeadHistoryItem[]>(
    `${BASE}/leads/${leadId}/history`,
  );
  return r.data;
}

/**
 * Fetch a brand-wide leads XLSX via axios and trigger a browser download.
 * Filename derives from the workspace name when supplied, else "brand".
 */
export async function downloadBrandLeadsXlsx(
  brandName: string | undefined,
  opts: BrandLeadFilters = {},
): Promise<void> {
  const response = await apiClient.get<Blob>(`${BASE}/leads/export`, {
    params: opts,
    responseType: "blob",
  });
  const blob = new Blob([response.data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safe =
    (brandName ?? "brand")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "brand";
  a.download = `${safe}-leads-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
