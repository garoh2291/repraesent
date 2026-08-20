import { apiClient } from "./axios-instance";
import type { LeadHistoryItem } from "./leads";

export type DealStatus = "new" | "won" | "lost";

/**
 * Parse a user-entered deal value string into a number.
 * Accepts comma or dot as the decimal separator; returns null for empty or
 * non-numeric input. Shared by the create/edit forms and the dirty-check so
 * they all interpret the value identically.
 */
export function parseDealValue(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function formatDealValueInput(raw: string): string {
  const stripped = raw.replace(/,/g, "");
  if (stripped === "" || !/^\d*\.?\d*$/.test(stripped)) return raw;
  const parts = stripped.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * Deal stages are workspace-configurable pipeline-stage keys now — use
 * `useDealStages()` (app/lib/hooks/usePipelineStages.ts) for the actual set,
 * order, labels and colors.
 */
export type DealStageKey = string;

export interface DealListItem {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  lead_id: string | null;
  title: string | null;
  status: DealStatus;
  value: string | null;
  stage: string;
  won_at: string | null;
  lost_at: string | null;
  expected_close_date: string | null;
  assigned_to: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  created_at: string;
  updated_at: string;
  stage_changed_at: string | null;
  contact_full_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  board_position: number | null;
}

export interface PaginatedDeals {
  data: DealListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface GetDealsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: DealStatus;
  stage?: string;
  assigned_to?: string;
  contact_id?: string;
}

export async function getDeals(
  params: GetDealsParams = {},
): Promise<PaginatedDeals> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.stage) searchParams.set("stage", params.stage);
  if (params.assigned_to)
    searchParams.set("assigned_to", params.assigned_to);
  if (params.contact_id) searchParams.set("contact_id", params.contact_id);

  const res = await apiClient.get<PaginatedDeals>(
    `/deals?${searchParams.toString()}`,
  );
  return res.data;
}

export interface DealContact {
  id: string;
  full_name: string | null;
  is_primary: boolean;
  primary_email: string | null;
  primary_phone: string | null;
}

export type DealDetailResponse = {
  deal: Record<string, unknown>;
  /** Primary contact (mirrors deals.contact_id); kept for backward compatibility. */
  contact: Record<string, unknown> | null;
  /** All contacts attached to the deal, primary first. */
  contacts: DealContact[];
};

export async function getDeal(dealId: string): Promise<DealDetailResponse> {
  const res = await apiClient.get<DealDetailResponse>(`/deals/${dealId}`);
  return res.data;
}

export async function getDealHistory(
  dealId: string,
): Promise<LeadHistoryItem[]> {
  const res = await apiClient.get<LeadHistoryItem[]>(
    `/deals/${dealId}/history`,
  );
  return res.data;
}

export interface PatchDealBody {
  title?: string | null;
  stage?: string;
  status?: DealStatus;
  value?: number | null;
  assigned_to?: string | null;
  expected_close_date?: string | null;
}

export async function patchDeal(
  dealId: string,
  body: PatchDealBody,
): Promise<DealDetailResponse> {
  const res = await apiClient.patch<DealDetailResponse>(
    `/deals/${dealId}`,
    body,
  );
  return res.data;
}

export async function patchDealStatus(
  dealId: string,
  status: "won" | "lost",
): Promise<DealDetailResponse> {
  const res = await apiClient.patch<DealDetailResponse>(
    `/deals/${dealId}/status`,
    { status },
  );
  return res.data;
}

export async function reorderDeal(
  dealId: string,
  stage: string,
  position: number,
): Promise<DealDetailResponse> {
  const res = await apiClient.patch<DealDetailResponse>(
    `/deals/${dealId}/reorder`,
    { stage, position },
  );
  return res.data;
}

export async function getDealContacts(
  dealId: string,
): Promise<DealContact[]> {
  const res = await apiClient.get<DealContact[]>(`/deals/${dealId}/contacts`);
  return res.data;
}

export async function attachDealContact(
  dealId: string,
  contactId: string,
  isPrimary = false,
): Promise<DealDetailResponse> {
  const res = await apiClient.post<DealDetailResponse>(
    `/deals/${dealId}/contacts`,
    { contact_id: contactId, is_primary: isPrimary },
  );
  return res.data;
}

export async function detachDealContact(
  dealId: string,
  contactId: string,
): Promise<DealDetailResponse> {
  const res = await apiClient.delete<DealDetailResponse>(
    `/deals/${dealId}/contacts/${encodeURIComponent(contactId)}`,
  );
  return res.data;
}

export async function setDealPrimaryContact(
  dealId: string,
  contactId: string,
): Promise<DealDetailResponse> {
  const res = await apiClient.patch<DealDetailResponse>(
    `/deals/${dealId}/contacts/${encodeURIComponent(contactId)}/primary`,
    {},
  );
  return res.data;
}

export interface CreateDealBody {
  title: string;
  stage?: string;
  value?: number | null;
  contact_id?: string | null;
  assigned_to?: string | null;
  expected_close_date?: string | null;
}

export async function createDeal(
  body: CreateDealBody,
): Promise<{ id: string }> {
  const res = await apiClient.post<{ id: string }>("/deals", body);
  return res.data;
}

export async function deleteDeal(dealId: string): Promise<void> {
  await apiClient.delete(`/deals/${dealId}`);
}

export async function getDealsForContact(
  contactId: string,
): Promise<DealListItem[]> {
  const res = await apiClient.get<DealListItem[]>(
    `/contacts/${encodeURIComponent(contactId)}/deals`,
  );
  return res.data;
}
