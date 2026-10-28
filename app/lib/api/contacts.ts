import { apiClient } from "./axios-instance";
import type { ContactType } from "~/lib/contacts/contact-types";
import type { Salutation } from "~/lib/contacts/contact-salutations";

export interface PatchContactBody {
  /** Language the customer gets emails in; null = not known. */
  locale?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  salutation?: Salutation | null;
  newsletter_opt_in?: boolean;
  newsletter_opt_in_at?: string | null;
  contact_type?: ContactType;
  /** Companies only. */
  company_name?: string | null;
  /** null removes the link. */
  parent_contact_id?: string | null;
  /** A typed company name instead; found by exact name or created. */
  parent_company_name?: string | null;
  /** Position of a person at their company. */
  job_title?: string | null;
  /** Registered name (companies only; company_name stays the trading name). */
  legal_name?: string | null;
  /** VAT ID / EIN (companies only). */
  tax_number?: string | null;
}

export async function patchContact(
  contactId: string,
  body: PatchContactBody,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/contacts/${contactId}`,
    body,
  );
  return res.data;
}

export async function deleteContact(contactId: string): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}`);
}

export async function patchContactEmail(
  contactId: string,
  emailId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/contacts/${contactId}/emails/${emailId}`,
    body,
  );
  return res.data;
}

export async function patchContactPhone(
  contactId: string,
  phoneId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/contacts/${contactId}/phones/${phoneId}`,
    body,
  );
  return res.data;
}

export async function patchContactAddress(
  contactId: string,
  addressId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/contacts/${contactId}/addresses/${addressId}`,
    body,
  );
  return res.data;
}

export async function addContactEmail(
  contactId: string,
  body: { address: string; type?: string; is_primary?: boolean },
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    `/contacts/${contactId}/emails`,
    body,
  );
  return res.data;
}

export async function deleteContactEmail(
  contactId: string,
  emailId: string,
): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}/emails/${emailId}`);
}

export async function addContactPhone(
  contactId: string,
  body: {
    number: string;
    type?: string;
    label?: string | null;
    is_primary?: boolean;
  },
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    `/contacts/${contactId}/phones`,
    body,
  );
  return res.data;
}

export async function deleteContactPhone(
  contactId: string,
  phoneId: string,
): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}/phones/${phoneId}`);
}

export async function addContactAddress(
  contactId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    `/contacts/${contactId}/addresses`,
    body,
  );
  return res.data;
}

export async function deleteContactAddress(
  contactId: string,
  addressId: string,
): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}/addresses/${addressId}`);
}

export async function addContactWebsite(
  contactId: string,
  body: { url: string; is_primary?: boolean },
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    `/contacts/${contactId}/websites`,
    body,
  );
  return res.data;
}

export async function patchContactWebsite(
  contactId: string,
  websiteId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/contacts/${contactId}/websites/${websiteId}`,
    body,
  );
  return res.data;
}

export async function deleteContactWebsite(
  contactId: string,
  websiteId: string,
): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}/websites/${websiteId}`);
}
