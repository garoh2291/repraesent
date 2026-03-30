import { apiClient } from "./axios-instance";
import type { LeadAnalyticsPeriod } from "./leads";

export interface BrandWorkspaceServiceItem {
  service_id: string;
  service_name: string;
  service_name_en: string | null;
  service_name_de: string | null;
  service_slug: string | null;
  service_type: string | null;
  service_icon: string | null;
}

export interface BrandWorkspaceMemberItem {
  user_id: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  role: string;
  last_activity_at: string | null;
}

export interface BrandWorkspaceLeadByForm {
  form_name: string;
  count: number;
}

export interface BrandWorkspaceOverviewItem {
  id: string;
  name: string;
  status: string;
  created_at: string;
  last_activity_at: string | null;
  leads_count: number;
  leads_by_form: BrandWorkspaceLeadByForm[];
  services: BrandWorkspaceServiceItem[];
  members: BrandWorkspaceMemberItem[];
}

export interface BrandWorkspacesOverviewResponse {
  data: BrandWorkspaceOverviewItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface BrandService {
  id: string;
  name: string;
  name_en: string | null;
  name_de: string | null;
}

export interface BrandAnalyticsWorkspace {
  id: string;
  name: string;
  has_analytics: boolean;
  shared_link: string | null;
}

export async function getBrandAnalyticsWorkspaces(): Promise<BrandAnalyticsWorkspace[]> {
  const res = await apiClient.get<BrandAnalyticsWorkspace[]>(
    "/brands/me/analytics-workspaces"
  );
  return res.data;
}

export async function getBrandServices(): Promise<BrandService[]> {
  const res = await apiClient.get<BrandService[]>("/brands/me/services");
  return res.data;
}

export async function getBrandWorkspacesOverview(params?: {
  search?: string;
  page?: number;
  limit?: number;
  service_id?: string;
}): Promise<BrandWorkspacesOverviewResponse> {
  const res = await apiClient.get<BrandWorkspacesOverviewResponse>(
    "/brands/me/workspaces-overview",
    {
      params: {
        ...(params?.search && { search: params.search }),
        ...(params?.page && { page: params.page }),
        ...(params?.limit && { limit: params.limit }),
        ...(params?.service_id && { service_id: params.service_id }),
      },
    }
  );
  return res.data;
}

export interface WorkspaceLeadSeries {
  workspace_id: string;
  workspace_name: string;
  series: { date: string; count: number }[];
  total: number;
  status_breakdown: { status: string; count: number }[];
}

export interface BrandAnalytics {
  bookings: WorkspaceLeadSeries[];
  submissions: WorkspaceLeadSeries[];
}

/**
 * Fetch brand-level lead analytics across all connected workspaces.
 * Backend endpoint: GET /brands/me/analytics?period=...
 *
 * Returns:
 *  - bookings: workspaces with leads where form_name = 'appointment_booking'
 *  - submissions: workspaces with leads that are not hidden and not appointment_booking
 */
export async function getBrandAnalytics(
  period: LeadAnalyticsPeriod
): Promise<BrandAnalytics> {
  const res = await apiClient.get<BrandAnalytics>(
    `/brands/me/analytics?period=${period}`
  );
  return res.data;
}

// ─── Brand Plausible Analytics ───────────────────────────────

export interface PlausibleWorkspaceSeries {
  workspace_id: string;
  workspace_name: string;
  visitors: number;
  pageviews: number;
  visits: number;
  views_per_visit: number;
  timeseries: { date: string; visitors: number }[];
}

export interface BrandPlausibleAnalytics {
  workspaces: PlausibleWorkspaceSeries[];
}

export async function getBrandPlausibleAnalytics(
  period: LeadAnalyticsPeriod
): Promise<BrandPlausibleAnalytics> {
  const res = await apiClient.get<BrandPlausibleAnalytics>(
    `/brands/me/analytics/plausible?period=${period}`
  );
  return res.data;
}

// ─── Brand Orders ────────────────────────────────────────────────

export interface BrandOrderStripeProduct {
  id: string;
  name: string;
  description: string | null;
  features: string[];
  prices: {
    id: string;
    interval: "month" | "year";
    amount: number;
    currency: string;
  }[];
}

export interface BrandOrderService {
  id: string;
  name: string;
  name_en: string | null;
  name_de: string | null;
  icon: string | null;
  type: string | null;
  already_active: boolean;
}

export interface BrandOrderWorkspace {
  id: string;
  name: string;
}

export interface BrandOrder {
  id: string;
  order_type: "workspace" | "service";
  workspace_id: string | null;
  workspace_name: string | null;
  status: "new" | "pending" | "completed" | "declined";
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateBrandOrderPayload {
  order_type: "workspace" | "service";
  workspace_id?: string;
  metadata: {
    product_id?: string;
    price_id?: string;
    billing?: "monthly" | "yearly";
    service_ids?: string[];
    notes?: string;
  };
}

export interface BrandOrdersResponse {
  data: BrandOrder[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export async function getBrandOrderStripeProducts(): Promise<
  BrandOrderStripeProduct[]
> {
  const res = await apiClient.get<BrandOrderStripeProduct[]>(
    "/brands/me/orders/stripe-products"
  );
  return res.data;
}

export async function getBrandOrderWorkspaces(): Promise<
  BrandOrderWorkspace[]
> {
  const res = await apiClient.get<BrandOrderWorkspace[]>(
    "/brands/me/orders/workspaces"
  );
  return res.data;
}

export async function getBrandOrderAvailableServices(
  workspaceId: string
): Promise<BrandOrderService[]> {
  const res = await apiClient.get<BrandOrderService[]>(
    `/brands/me/orders/available-services?workspace_id=${workspaceId}`
  );
  return res.data;
}

export async function createBrandOrder(
  payload: CreateBrandOrderPayload
): Promise<BrandOrder> {
  const res = await apiClient.post<BrandOrder>(
    "/brands/me/orders",
    payload
  );
  return res.data;
}

export async function listMyBrandOrders(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<BrandOrdersResponse> {
  const res = await apiClient.get<BrandOrdersResponse>(
    "/brands/me/orders",
    { params }
  );
  return res.data;
}

export async function exportBrandReport(
  workspaceId: string,
  period: string,
  workspaceName: string,
): Promise<void> {
  const res = await apiClient.get("/brands/me/export-report", {
    params: { workspace_id: workspaceId, period },
    responseType: "blob",
  });
  const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `report-${workspaceName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
