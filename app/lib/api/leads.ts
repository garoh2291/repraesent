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

export interface LeadTasksSummary {
  open_count: number;
  nearest_due_date: string | null;
  nearest_urgency: "overdue" | "due_soon" | "upcoming" | null;
  nearest_title: string | null;
}

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
  form_name: string;
  source_label: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  tasks_summary: LeadTasksSummary;
}

export interface LeadHistoryItem {
  action: string;
  details: Record<string, unknown>;
  user_id: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  user_email: string | null;
  user_is_deleted: boolean;
  created_at: string;
}

export interface GetLeadsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: LeadStatus;
  source?: "website";
  form_name?: string;
  include_hidden?: boolean;
  platform_campaign_id?: string;
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
  if (params.form_name) searchParams.set("form_name", params.form_name);
  if (params.include_hidden) searchParams.set("include_hidden", "true");
  if (params.platform_campaign_id)
    searchParams.set("platform_campaign_id", params.platform_campaign_id);

  const res = await apiClient.get<PaginatedLeads>(
    `/leads?${searchParams.toString()}`
  );
  return res.data;
}

export interface GetKanbanCountsParams {
  search?: string;
  source?: "website";
  form_name?: string;
  platform_campaign_id?: string;
}

export type KanbanCounts = Record<LeadStatus, number>;

export async function getLeadsKanbanCounts(
  params: GetKanbanCountsParams = {},
): Promise<KanbanCounts> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.source) searchParams.set("source", params.source);
  if (params.form_name) searchParams.set("form_name", params.form_name);
  if (params.platform_campaign_id)
    searchParams.set("platform_campaign_id", params.platform_campaign_id);

  const res = await apiClient.get<KanbanCounts>(
    `/leads/kanban-counts?${searchParams.toString()}`,
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

export async function getLeadFormNames(): Promise<string[]> {
  const res = await apiClient.get<string[]>("/leads/form-names");
  return res.data;
}

export async function getLeadStats(): Promise<LeadStats> {
  const res = await apiClient.get<LeadStats>("/leads/stats");
  return res.data;
}

export type LeadAnalyticsPeriod =
  | "1d"
  | "7d"
  | "30d"
  | "all_time";

export interface LeadAnalytics {
  series: { date: string; count: number }[];
  form_names: { form_name: string; label: string; count: number }[];
  total: number;
}

export async function getLeadAnalytics(
  period: LeadAnalyticsPeriod
): Promise<LeadAnalytics> {
  const res = await apiClient.get<LeadAnalytics>(
    `/leads/analytics?period=${period}`
  );
  return res.data;
}
