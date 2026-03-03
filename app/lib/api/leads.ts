import { apiClient } from "./axios-instance";

export const LEAD_STATUSES = [
  "new_lead",
  "pending",
  "in_progress",
  "rejected",
  "on_hold",
  "stale",
  "success",
  "hidden",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  metadata: Record<string, unknown>;
  source_id: string;
  source_table: string;
  source_label: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LeadHistoryItem {
  action: string;
  details: Record<string, unknown>;
  user_id: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  created_at: string;
}

export interface GetLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: LeadStatus;
  source?: "website";
}

export interface PaginatedLeads {
  data: Lead[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export async function getLeads(
  params: GetLeadsParams = {}
): Promise<PaginatedLeads> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.source) searchParams.set("source", params.source);

  const res = await apiClient.get<PaginatedLeads>(
    `/leads?${searchParams.toString()}`
  );
  return res.data;
}

export async function getLead(id: string): Promise<Lead> {
  const res = await apiClient.get<Lead>(`/leads/${id}`);
  return res.data;
}

export async function updateLeadStatus(
  id: string,
  status: LeadStatus
): Promise<Lead> {
  const res = await apiClient.patch<Lead>(`/leads/${id}`, { status });
  return res.data;
}

export async function getLeadHistory(id: string): Promise<LeadHistoryItem[]> {
  const res = await apiClient.get<LeadHistoryItem[]>(`/leads/${id}/history`);
  return res.data;
}

export interface LeadStats {
  total: number;
  new_this_week: number;
}

export async function getLeadStats(): Promise<LeadStats> {
  const res = await apiClient.get<LeadStats>("/leads/stats");
  return res.data;
}
