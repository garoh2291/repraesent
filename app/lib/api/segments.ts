import { apiClient } from "./axios-instance";
import type { ConditionGroup } from "./workflows";

/**
 * Contact segments — mirror of nestjs-monolith/src/modules/contact-segments.
 * The condition vocabulary is the workflow one (lib/api/workflows.ts).
 */

export interface SegmentSummary {
  id: string;
  name: string;
  description: string | null;
  kind: "dynamic" | "manual";
  definition: ConditionGroup | null;
  matched_count: number | null;
  sendable_count: number | null;
  counts_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SegmentCounts {
  matched: number;
  sendable: number;
}

export interface SegmentMemberRow {
  member_id: string;
  id: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  contact_type: string;
  primary_email: string | null;
  added_at: string;
}

export interface PaginatedMembers {
  data: SegmentMemberRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export async function listSegments(): Promise<SegmentSummary[]> {
  const { data } = await apiClient.get("/segments");
  return data;
}

export async function getSegment(id: string): Promise<SegmentSummary> {
  const { data } = await apiClient.get(`/segments/${id}`);
  return data;
}

export async function createSegment(payload: {
  name: string;
  description?: string;
  kind?: "dynamic" | "manual";
  definition?: ConditionGroup;
}): Promise<SegmentSummary> {
  const { data } = await apiClient.post("/segments", payload);
  return data;
}

export async function updateSegment(
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    definition?: ConditionGroup;
  },
): Promise<SegmentSummary> {
  const { data } = await apiClient.patch(`/segments/${id}`, payload);
  return data;
}

export async function deleteSegment(id: string): Promise<void> {
  await apiClient.delete(`/segments/${id}`);
}

export async function previewSegmentCount(
  definition: ConditionGroup,
): Promise<SegmentCounts> {
  const { data } = await apiClient.post("/segments/preview-count", {
    definition,
  });
  return data;
}

export async function refreshSegmentCounts(id: string): Promise<SegmentCounts> {
  const { data } = await apiClient.post(`/segments/${id}/refresh-counts`);
  return data;
}

export async function listSegmentMembers(
  id: string,
  params: { page?: number; limit?: number },
): Promise<PaginatedMembers> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const { data } = await apiClient.get(`/segments/${id}/members?${query}`);
  return data;
}

export async function addSegmentMembers(
  id: string,
  contactIds: string[],
): Promise<{ added: number }> {
  const { data } = await apiClient.post(`/segments/${id}/members`, {
    contact_ids: contactIds,
  });
  return data;
}

export async function importSegmentMembers(
  id: string,
  emails: string[],
): Promise<{ added: number; unmatched: string[] }> {
  const { data } = await apiClient.post(`/segments/${id}/members/import`, {
    emails,
  });
  return data;
}

export async function removeSegmentMember(
  id: string,
  contactId: string,
): Promise<void> {
  await apiClient.delete(`/segments/${id}/members/${contactId}`);
}
