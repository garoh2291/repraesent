import { apiClient } from "./axios-instance";

export type ContactCompanyRole =
  | "employee"
  | "owner"
  | "manager"
  | "contact"
  | "other";

export interface ContactCompanyLink {
  id: string;
  contact_id: string;
  company_id: string;
  role: ContactCompanyRole;
  job_title: string | null;
  department: string | null;
  is_primary: boolean;
  started_on: string | null;
  ended_on: string | null;
  created_at?: string;
  updated_at?: string;
  company_name?: string | null;
  company_legal_form?: string | null;
  company_website?: string | null;
}

export interface CreateContactCompanyBody {
  company_id: string;
  role?: ContactCompanyRole;
  job_title?: string | null;
  department?: string | null;
  is_primary?: boolean;
  started_on?: string | null;
  ended_on?: string | null;
}

export interface UpdateContactCompanyBody {
  role?: ContactCompanyRole;
  job_title?: string | null;
  department?: string | null;
  is_primary?: boolean;
  started_on?: string | null;
  ended_on?: string | null;
}

export async function listContactCompanies(
  contactId: string,
): Promise<ContactCompanyLink[]> {
  const res = await apiClient.get<ContactCompanyLink[]>(
    `/contacts/${contactId}/companies`,
  );
  return res.data;
}

export async function createContactCompany(
  contactId: string,
  body: CreateContactCompanyBody,
): Promise<ContactCompanyLink> {
  const res = await apiClient.post<ContactCompanyLink>(
    `/contacts/${contactId}/companies`,
    body,
  );
  return res.data;
}

export async function updateContactCompany(
  contactId: string,
  linkId: string,
  body: UpdateContactCompanyBody,
): Promise<ContactCompanyLink> {
  const res = await apiClient.patch<ContactCompanyLink>(
    `/contacts/${contactId}/companies/${linkId}`,
    body,
  );
  return res.data;
}

export async function deleteContactCompany(
  contactId: string,
  linkId: string,
): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}/companies/${linkId}`);
}
