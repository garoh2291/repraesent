import { apiClient } from "./axios-instance";

export interface CreateCompanyBody {
  name: string;
  legal_form?: string | null;
  founded_on?: string | null;
  website?: string | null;
  notes?: string | null;
  newsletter_opt_in?: boolean;
  newsletter_opt_in_at?: string | null;
}

export interface PatchCompanyBody {
  name?: string;
  legal_form?: string | null;
  founded_on?: string | null;
  website?: string | null;
  notes?: string | null;
  newsletter_opt_in?: boolean;
  newsletter_opt_in_at?: string | null;
}

export async function listCompanies(search?: string): Promise<
  Record<string, unknown>[]
> {
  const q = search?.trim()
    ? `?search=${encodeURIComponent(search.trim())}`
    : "";
  const res = await apiClient.get<Record<string, unknown>[]>(
    `/companies${q}`,
  );
  return res.data;
}

export async function getCompany(
  companyId: string,
): Promise<Record<string, unknown>> {
  const res = await apiClient.get<Record<string, unknown>>(
    `/companies/${companyId}`,
  );
  return res.data;
}

export async function createCompany(
  body: CreateCompanyBody,
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    "/companies",
    body,
  );
  return res.data;
}

export async function patchCompany(
  companyId: string,
  body: PatchCompanyBody,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/companies/${companyId}`,
    body,
  );
  return res.data;
}

export async function deleteCompany(companyId: string): Promise<void> {
  await apiClient.delete(`/companies/${companyId}`);
}

export async function patchCompanyEmail(
  companyId: string,
  emailId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/companies/${companyId}/emails/${emailId}`,
    body,
  );
  return res.data;
}

export async function patchCompanyPhone(
  companyId: string,
  phoneId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/companies/${companyId}/phones/${phoneId}`,
    body,
  );
  return res.data;
}

export async function patchCompanyAddress(
  companyId: string,
  addressId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.patch<Record<string, unknown>>(
    `/companies/${companyId}/addresses/${addressId}`,
    body,
  );
  return res.data;
}

export async function addCompanyEmail(
  companyId: string,
  body: { address: string; type?: string; is_primary?: boolean },
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    `/companies/${companyId}/emails`,
    body,
  );
  return res.data;
}

export async function deleteCompanyEmail(
  companyId: string,
  emailId: string,
): Promise<void> {
  await apiClient.delete(`/companies/${companyId}/emails/${emailId}`);
}

export async function addCompanyPhone(
  companyId: string,
  body: {
    number: string;
    type?: string;
    label?: string | null;
    is_primary?: boolean;
  },
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    `/companies/${companyId}/phones`,
    body,
  );
  return res.data;
}

export async function deleteCompanyPhone(
  companyId: string,
  phoneId: string,
): Promise<void> {
  await apiClient.delete(`/companies/${companyId}/phones/${phoneId}`);
}

export async function addCompanyAddress(
  companyId: string,
  body: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const res = await apiClient.post<Record<string, unknown>>(
    `/companies/${companyId}/addresses`,
    body,
  );
  return res.data;
}

export async function deleteCompanyAddress(
  companyId: string,
  addressId: string,
): Promise<void> {
  await apiClient.delete(`/companies/${companyId}/addresses/${addressId}`);
}
