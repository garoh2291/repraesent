import { apiClient } from "./axios-instance";

export interface PatchContactBody {
  first_name?: string | null;
  last_name?: string | null;
  notes?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  newsletter_opt_in?: boolean;
  newsletter_opt_in_at?: string | null;
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
