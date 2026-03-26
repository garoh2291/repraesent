import { apiClient } from "./axios-instance";
import type { LeadAnalyticsPeriod } from "./leads";

export interface BrandWorkspaceServiceItem {
  service_id: string;
  service_name: string;
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
