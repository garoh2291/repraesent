import { apiClient } from "./axios-instance";
import type { LeadHistoryItem } from "./leads";

import type { ContactType } from "~/lib/contacts/contact-types";

export interface ContactListItem {
  id: string;
  source: string;
  lead_id: string | null;
  assigned_to: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  created_at: string;
  updated_at: string;
  contact_full_name: string | null;
  contact_type: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  lifetime_value: string | null;
  lost_value: string | null;
  pipeline_value: string | null;
  last_contacted_at: string | null;
}

export interface PaginatedContacts {
  data: ContactListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface GetContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  assigned_to?: string;
  source?: string;
  contact_type?: string;
}

export async function getContacts(
  params: GetContactsParams = {}
): Promise<PaginatedContacts> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.search) searchParams.set("search", params.search);
  if (params.assigned_to) searchParams.set("assigned_to", params.assigned_to);
  if (params.source) searchParams.set("source", params.source);
  if (params.contact_type)
    searchParams.set("contact_type", params.contact_type);

  const res = await apiClient.get<PaginatedContacts>(
    `/contacts?${searchParams.toString()}`
  );
  return res.data;
}

export async function getContactIdByLead(
  leadId: string
): Promise<string | null> {
  const res = await apiClient.get<{ id: string | null }>(
    `/contacts?leadId=${encodeURIComponent(leadId)}`
  );
  return res.data.id;
}

export type ContactDetail = {
  crm: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  emails: Record<string, unknown>[];
  phones: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
};

export async function getContact(id: string): Promise<ContactDetail> {
  const res = await apiClient.get<ContactDetail>(`/contacts/${id}`);
  return res.data;
}

export async function getContactHistory(
  contactId: string
): Promise<LeadHistoryItem[]> {
  const res = await apiClient.get<LeadHistoryItem[]>(
    `/contacts/${contactId}/history`
  );
  return res.data;
}

export interface PatchContactCrmBody {
  assigned_to?: string | null;
  last_contacted_at?: string | null;
  contact_type?: ContactType;
}

export async function patchContactCrm(
  id: string,
  body: PatchContactCrmBody
): Promise<ContactDetail> {
  const res = await apiClient.patch<ContactDetail>(`/contacts/${id}/crm`, body);
  return res.data;
}

export interface CreateContactBody {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
}

export async function createContact(
  body: CreateContactBody
): Promise<{ id: string }> {
  const res = await apiClient.post<{ id: string }>("/contacts", body);
  return res.data;
}

export async function convertLeadToContact(
  leadId: string
): Promise<{ id: string; contact_id: string }> {
  const res = await apiClient.post<{ id: string; contact_id: string }>(
    `/contacts/from-lead/${encodeURIComponent(leadId)}`
  );
  return res.data;
}
