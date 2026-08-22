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

/** A Stripe catalogue line item on a deal. */
export interface DealProduct {
  id: string;
  stripe_product_id: string;
  stripe_price_id: string;
  quantity: number;
  /** Live from Stripe when reachable, otherwise the attach-time snapshot. */
  name: string;
  image: string | null;
  unit_amount: number | null;
  currency: string | null;
  line_total: number | null;
  price_type: "one_time" | "recurring" | null;
  recurring_interval: string | null;
  recurring_interval_count: number | null;
  /** From the server's warm catalogue cache only; null when it is cold. */
  is_physical: boolean | null;
  stock: number | null;
  /**
   * Stripe could not confirm this line — archived, deleted, or the account is
   * disconnected. Rendered from the snapshot rather than dropped.
   */
  stale: boolean;
  price_active: boolean | null;
  created_at: string;
}

/** The Stripe customer a deal is invoiced to. */
export interface DealCustomer {
  stripe_customer_id: string;
  stripe_account_id: string;
  contact_id: string | null;
  name: string | null;
  email: string | null;
  /** Fixed by Stripe after the first invoice; null before that. */
  currency: string | null;
  linked_at: string;
  linked_by_name: string | null;
  /** Stripe could not confirm the customer (deleted or unreachable). */
  stale: boolean;
  /** Linked on a different Stripe account than the one connected now. */
  account_mismatch: boolean;
}

/** Offered when no customer is linked: the primary contact, maybe with a remembered customer. */
export interface DealCustomerSuggestion {
  contact_id: string;
  name: string | null;
  email: string | null;
  stripe_customer_id: string | null;
}

export interface DealInvoiceLine {
  /** Null for custom (non-catalogue) lines of a linked invoice. */
  price_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_amount: number | null;
  currency: string | null;
  price_type: "one_time" | "recurring" | null;
  interval: string | null;
  interval_count: number | null;
}

export type DealInvoiceKind = "invoice" | "subscription" | "renewal";

export interface DealInvoice {
  id: string;
  kind: DealInvoiceKind;
  stripe_invoice_id: string;
  stripe_subscription_id: string | null;
  stripe_customer_id: string;
  /** draft | open | paid | void | uncollectible */
  status: string | null;
  /** active | past_due | canceled | unpaid | incomplete | trialing */
  subscription_status: string | null;
  /** Minor units. */
  total: number | null;
  currency: string | null;
  number: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  days_until_due: number | null;
  due_at: string | null;
  paid_at: string | null;
  voided_at: string | null;
  /** When we first asked Stripe to email it. Drives the Send / Sent state. */
  sent_at: string | null;
  sent_count: number;
  sent_by_name: string | null;
  created_at: string;
  created_by_name: string | null;
  lines: DealInvoiceLine[];
  /** Stripe could not be asked for a fresh status. */
  stale: boolean;
}

export type InvoiceBlocker =
  | "no_customer"
  | "customer_account_mismatch"
  | "stale_customer"
  | "no_lines"
  | "stale_line"
  | "inactive_price"
  | "mixed_currency"
  | "customer_currency_mismatch"
  | "mixed_intervals"
  | "too_many_lines";

export interface InvoiceReadiness {
  kind: "invoice" | "subscription" | null;
  blockers: InvoiceBlocker[];
  currency: string | null;
  /** Minor units, one period for recurring lines. */
  total: number | null;
  one_time_count: number;
  recurring_count: number;
}

export type DealDetailResponse = {
  deal: Record<string, unknown>;
  /** Primary contact (mirrors deals.contact_id); kept for backward compatibility. */
  contact: Record<string, unknown> | null;
  /** All contacts attached to the deal, primary first. */
  contacts: DealContact[];
  /** Stripe catalogue line items. Empty when nothing is attached. */
  products: DealProduct[];
  customer: DealCustomer | null;
  customer_suggestion: DealCustomerSuggestion | null;
  /** Newest first. */
  invoices: DealInvoice[];
  invoice_readiness: InvoiceReadiness;
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

/**
 * Attach a Stripe price to a deal.
 *
 * Attaching a price already on the deal increases its quantity rather than
 * failing, and the server recomputes `deals.value` from the resulting lines —
 * which is why all four of these return the full refreshed detail payload.
 */
export async function attachDealProduct(
  dealId: string,
  stripePriceId: string,
  quantity = 1,
): Promise<DealDetailResponse> {
  const res = await apiClient.post<DealDetailResponse>(
    `/deals/${dealId}/products`,
    { stripe_price_id: stripePriceId, quantity },
  );
  return res.data;
}

export async function setDealProductQuantity(
  dealId: string,
  lineId: string,
  quantity: number,
): Promise<DealDetailResponse> {
  const res = await apiClient.patch<DealDetailResponse>(
    `/deals/${dealId}/products/${encodeURIComponent(lineId)}`,
    { quantity },
  );
  return res.data;
}

export async function detachDealProduct(
  dealId: string,
  lineId: string,
): Promise<DealDetailResponse> {
  const res = await apiClient.delete<DealDetailResponse>(
    `/deals/${dealId}/products/${encodeURIComponent(lineId)}`,
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

// ---------------------------------------------------------------------------
// Stripe customer on a deal
// ---------------------------------------------------------------------------

export async function linkDealCustomer(
  dealId: string,
  stripeCustomerId: string,
): Promise<DealDetailResponse> {
  const res = await apiClient.put<DealDetailResponse>(
    `/deals/${dealId}/customer`,
    { stripe_customer_id: stripeCustomerId },
  );
  return res.data;
}

export async function createDealCustomer(
  dealId: string,
  body: { name: string; email: string; contact_id?: string },
): Promise<DealDetailResponse> {
  const res = await apiClient.post<DealDetailResponse>(
    `/deals/${dealId}/customer`,
    body,
  );
  return res.data;
}

export async function unlinkDealCustomer(
  dealId: string,
): Promise<DealDetailResponse> {
  const res = await apiClient.delete<DealDetailResponse>(
    `/deals/${dealId}/customer`,
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Invoices & subscriptions raised from a deal
// ---------------------------------------------------------------------------

export async function getDealInvoices(dealId: string): Promise<DealInvoice[]> {
  const res = await apiClient.get<DealInvoice[]>(`/deals/${dealId}/invoices`);
  return res.data;
}

export interface CreateDealInvoiceBody {
  days_until_due: number;
  send_now: boolean;
  memo?: string;
  /** One per dialog open; a retry with the same key never creates a second document. */
  idempotency_key: string;
}

export async function createDealInvoice(
  dealId: string,
  body: CreateDealInvoiceBody,
): Promise<DealDetailResponse> {
  const res = await apiClient.post<DealDetailResponse>(
    `/deals/${dealId}/invoices`,
    body,
    // Building a subscription plus its first invoice is several Stripe calls.
    { timeout: 60_000 },
  );
  return res.data;
}

async function invoiceAction(
  dealId: string,
  invoiceId: string,
  action: "send" | "void" | "mark-paid" | "cancel-subscription",
): Promise<DealDetailResponse> {
  const res = await apiClient.post<DealDetailResponse>(
    `/deals/${dealId}/invoices/${encodeURIComponent(invoiceId)}/${action}`,
  );
  return res.data;
}

export const sendDealInvoice = (dealId: string, invoiceId: string) =>
  invoiceAction(dealId, invoiceId, "send");
export const voidDealInvoice = (dealId: string, invoiceId: string) =>
  invoiceAction(dealId, invoiceId, "void");
export const markDealInvoicePaid = (dealId: string, invoiceId: string) =>
  invoiceAction(dealId, invoiceId, "mark-paid");
export const cancelDealSubscription = (dealId: string, invoiceId: string) =>
  invoiceAction(dealId, invoiceId, "cancel-subscription");

/** Removes the row only — Stripe, products, value and customer stay untouched. */
export async function unlinkDealInvoice(
  dealId: string,
  invoiceId: string,
): Promise<DealDetailResponse> {
  const res = await apiClient.delete<DealDetailResponse>(
    `/deals/${dealId}/invoices/${encodeURIComponent(invoiceId)}`,
  );
  return res.data;
}

// ---------------------------------------------------------------------------
// Linking an existing Stripe invoice
// ---------------------------------------------------------------------------

export interface AvailableInvoiceLine {
  description: string | null;
  quantity: number | null;
  price_id: string | null;
  product_id: string | null;
}

export interface AvailableInvoiceCustomer {
  id: string;
  name: string | null;
  email: string | null;
  deleted: boolean;
}

export type AvailableInvoiceScope = "customer" | "all";

/** A Stripe invoice as the "link existing" picker sees it. */
export interface AvailableInvoice {
  id: string;
  number: string | null;
  status: string | null;
  /** Minor units. */
  total: number;
  currency: string;
  /** Unix seconds. */
  created: number;
  due_at: string | null;
  hosted_invoice_url: string | null;
  customer: AvailableInvoiceCustomer | null;
  subscription_id: string | null;
  /** First page of lines — enough for the confirm panel. */
  lines: AvailableInvoiceLine[];
  lines_truncated: boolean;
  linked_deal_id: string | null;
  linked_deal_title: string | null;
  linked_via: "invoice" | "subscription" | null;
}

export async function getAvailableDealInvoices(
  dealId: string,
  scope: AvailableInvoiceScope,
): Promise<AvailableInvoice[]> {
  const res = await apiClient.get<AvailableInvoice[]>(
    `/deals/${dealId}/invoices/available`,
    { params: { scope } },
  );
  return res.data;
}

export async function linkDealInvoice(
  dealId: string,
  body: { stripe_invoice_id: string; sync_products: boolean },
): Promise<DealDetailResponse> {
  const res = await apiClient.post<DealDetailResponse>(
    `/deals/${dealId}/invoices/link`,
    body,
    // Line paging + price lookups on the Stripe side.
    { timeout: 60_000 },
  );
  return res.data;
}
