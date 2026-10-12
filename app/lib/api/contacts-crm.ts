import type { ContactDealValues } from "~/lib/utils/format";
import { apiClient } from "./axios-instance";
import type { LeadHistoryItem } from "./leads";

import type { ContactType } from "~/lib/contacts/contact-types";

export type ContactKind = "person" | "company";

export interface ContactListItem {
  id: string;
  source: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
  contact_full_name: string | null;
  contact_type: string | null;
  /** "person" or "company". Optional: older backends don't send it. */
  kind?: ContactKind;
  /** The company a person works at, or the company a company is part of. */
  parent_contact_id?: string | null;
  parent_full_name?: string | null;
  /** Position of a person at their company. */
  job_title?: string | null;
  /** Companies only: how many people work there. */
  people_count?: number;
  primary_email: string | null;
  primary_phone: string | null;
  lifetime_value: string | null;
  lost_value: string | null;
  pipeline_value: string | null;
  /** Per-currency won/lost/pipeline totals (migration 187). */
  deal_values?: ContactDealValues | null;
  last_contacted_at: string | null;
  /** Optional: older backends don't send it (deploy skew). */
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
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
  source?: string;
  contact_type?: string;
  kind?: ContactKind;
  /** Only the people and companies that belong to this company. */
  parent_contact_id?: string;
}

export async function getContacts(
  params: GetContactsParams = {},
): Promise<PaginatedContacts> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.search) searchParams.set("search", params.search);
  if (params.source) searchParams.set("source", params.source);
  if (params.contact_type)
    searchParams.set("contact_type", params.contact_type);
  if (params.kind) searchParams.set("kind", params.kind);
  if (params.parent_contact_id)
    searchParams.set("parent_contact_id", params.parent_contact_id);

  const res = await apiClient.get<PaginatedContacts>(
    `/contacts?${searchParams.toString()}`,
  );
  return res.data;
}

export interface ContactCompanyRef {
  id: string;
  full_name: string | null;
  kind: ContactKind;
}

export interface ContactCompanyPerson extends ContactCompanyRef {
  job_title?: string | null;
  primary_email: string | null;
  primary_phone: string | null;
}

export type ContactDetail = {
  crm: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  emails: Record<string, unknown>[];
  phones: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
  /** The company a person works at, or the company this company is part of. */
  company?: ContactCompanyRef | null;
  /** People who work here (companies only). */
  people?: ContactCompanyPerson[];
  /** Companies that are part of this one (companies only). */
  includes?: ContactCompanyRef[];
};

export async function getContact(id: string): Promise<ContactDetail> {
  const res = await apiClient.get<ContactDetail>(`/contacts/${id}`);
  return res.data;
}

export async function getContactHistory(
  contactId: string,
): Promise<LeadHistoryItem[]> {
  const res = await apiClient.get<LeadHistoryItem[]>(
    `/contacts/${contactId}/history`,
  );
  return res.data;
}

export interface PatchContactCrmBody {
  last_contacted_at?: string | null;
  contact_type?: ContactType;
}

export async function patchContactCrm(
  id: string,
  body: PatchContactCrmBody,
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
  contact_type?: ContactType | null;
  kind?: ContactKind;
  /** Required when kind is "company". */
  company_name?: string | null;
  /** A picked company: where a person works, or what a company is part of. */
  parent_contact_id?: string | null;
  /** A typed company name instead; found by exact name or created. */
  parent_company_name?: string | null;
  /** Position of a person at their company. */
  job_title?: string | null;
}

export async function createContact(
  body: CreateContactBody,
): Promise<{ id: string }> {
  const res = await apiClient.post<{ id: string }>("/contacts", body);
  return res.data;
}

export interface AddContactAddressBody {
  type?: "work" | "home" | "billing" | "shipping" | "other";
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_primary?: boolean;
}

export async function addContactAddress(
  contactId: string,
  body: AddContactAddressBody,
): Promise<void> {
  await apiClient.post(`/contacts/${contactId}/addresses`, body);
}

export async function convertLeadToContact(
  leadId: string,
): Promise<{ id: string; contact_id: string }> {
  const res = await apiClient.post<{ id: string; contact_id: string }>(
    `/contacts/from-lead/${encodeURIComponent(leadId)}`,
  );
  return res.data;
}

export interface ContactCompanyMatch {
  id: string;
  full_name: string | null;
}

export interface ContactEmailMatch {
  id: string;
  full_name: string | null;
  primary_email: string | null;
  lead_id: string | null;
}
