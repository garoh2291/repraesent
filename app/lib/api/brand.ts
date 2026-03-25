import { apiClient } from "./axios-instance";
import type { LeadAnalyticsPeriod } from "./leads";

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
