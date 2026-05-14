import { apiClient } from "./axios-instance";

export type CustomerStatus =
  | "imported"
  | "active"
  | "completed"
  | "churned"
  | "lost";

export interface CustomerListItem {
  id: string;
  status: string;
  source: string;
  lead_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  assigned_to: string | null;
  assignee_first_name: string | null;
  assignee_last_name: string | null;
  created_at: string;
  updated_at: string;
  contact_full_name: string | null;
}

export interface PaginatedCustomers {
  data: CustomerListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface GetCustomersParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: CustomerStatus;
  assigned_to?: string;
}

export async function getCustomers(
  params: GetCustomersParams = {},
): Promise<PaginatedCustomers> {
  const searchParams = new URLSearchParams();
  if (params.page != null) searchParams.set("page", String(params.page));
  if (params.limit != null) searchParams.set("limit", String(params.limit));
  if (params.search) searchParams.set("search", params.search);
  if (params.status) searchParams.set("status", params.status);
  if (params.assigned_to)
    searchParams.set("assigned_to", params.assigned_to);

  const res = await apiClient.get<PaginatedCustomers>(
    `/customers?${searchParams.toString()}`,
  );
  return res.data;
}

export async function getCustomerIdByLead(
  leadId: string,
): Promise<string | null> {
  const res = await apiClient.get<{ id: string | null }>(
    `/customers?leadId=${encodeURIComponent(leadId)}`,
  );
  return res.data.id;
}

export type CustomerDetail = {
  customer: Record<string, unknown>;
  contact: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  emails: Record<string, unknown>[];
  phones: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
  contact_companies: Record<string, unknown>[];
};

export async function getCustomer(id: string): Promise<CustomerDetail> {
  const res = await apiClient.get<CustomerDetail>(`/customers/${id}`);
  return res.data;
}

export interface PatchCustomerBody {
  status?: CustomerStatus;
  assigned_to?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  notes?: string | null;
  lifetime_value?: number | null;
  first_purchase_date?: string | null;
  last_purchase_date?: string | null;
  last_contacted_at?: string | null;
}

export async function patchCustomer(
  id: string,
  body: PatchCustomerBody,
): Promise<CustomerDetail> {
  const res = await apiClient.patch<CustomerDetail>(`/customers/${id}`, body);
  return res.data;
}

export interface CreateCustomerBody {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  company_id?: string | null;
  notes?: string | null;
}

export async function createCustomer(
  body: CreateCustomerBody,
): Promise<{ id: string }> {
  const res = await apiClient.post<{ id: string }>("/customers", body);
  return res.data;
}
