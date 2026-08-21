import { apiClient } from "./axios-instance";

/**
 * Read-only view of the workspace's connected Stripe catalogue.
 *
 * Nothing here is mirrored into our database and nothing here writes to
 * Stripe. The backend loads the whole catalogue (products + every price) once
 * per minute per account and classifies it; the page filters, sorts and
 * searches that snapshot locally. Editing happens in the Stripe dashboard.
 */

export interface PackageDimensions {
  height: number;
  length: number;
  weight: number;
  width: number;
}

export interface CatalogPrice {
  id: string;
  product_id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  nickname: string | null;
  type: "one_time" | "recurring";
  interval: string | null;
  interval_count: number | null;
  /** "per_unit" | "tiered" */
  billing_scheme: string;
  lookup_key: string | null;
  trial_period_days: number | null;
  tax_behavior: string | null;
  is_default: boolean;
  created: number;
}

export interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  images: string[];
  active: boolean;
  livemode: boolean;
  shippable: boolean | null;
  package_dimensions: PackageDimensions | null;
  marketing_features: string[];
  /** shippable, or has dimensions, or tagged physical in metadata. */
  is_physical: boolean;
  /** Has at least one active recurring price. */
  has_recurring: boolean;
  /** Has at least one active one-time price. */
  has_one_time: boolean;
  /** Stock read from metadata; null when no known key carries a number. */
  stock: number | null;
  /** Which metadata key the stock came from. */
  stock_key: string | null;
  unit_label: string | null;
  statement_descriptor: string | null;
  tax_code: string | null;
  url: string | null;
  default_price_id: string | null;
  default_price: CatalogPrice | null;
  /** Every price (active only in the list; archived included on the single-product call). */
  prices: CatalogPrice[];
  metadata: Record<string, string>;
  created: number;
  updated: number;
}

export interface CatalogCounts {
  all: number;
  physical: number;
  subscriptions: number;
  one_time: number;
}

export interface CatalogList {
  data: CatalogProduct[];
  /** The account has more products than the load cap; use server search. */
  truncated: boolean;
  /** Unix ms when the backend fetched this snapshot from Stripe. */
  fetched_at: number;
  counts: CatalogCounts;
}

export interface CatalogAccount {
  id: string;
  name: string | null;
  email: string | null;
  default_currency: string | null;
  livemode: boolean;
  charges_enabled: boolean;
  details_submitted: boolean;
}

export interface StripeCustomerSummary {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Fixed after the customer's first invoice; null before that. */
  currency: string | null;
  livemode: boolean;
  created: number;
}

export interface ListProductsParams {
  include_archived?: boolean;
  refresh?: boolean;
  /** Server-side Stripe search — only when the catalogue is truncated. */
  search?: string;
}

export type CatalogTab = "all" | "physical" | "subscriptions" | "one_time";

export const CATALOG_TABS: CatalogTab[] = [
  "all",
  "physical",
  "subscriptions",
  "one_time",
];

export function productMatchesTab(p: CatalogProduct, tab: CatalogTab): boolean {
  switch (tab) {
    case "physical":
      return p.is_physical;
    case "subscriptions":
      return p.has_recurring;
    case "one_time":
      return p.has_one_time && !p.has_recurring;
    default:
      return true;
  }
}

/** Case-insensitive match on name, description, id and metadata values. */
export function productMatchesSearch(p: CatalogProduct, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  if (p.name.toLowerCase().includes(q)) return true;
  if (p.description?.toLowerCase().includes(q)) return true;
  if (p.id.toLowerCase().includes(q)) return true;
  return Object.values(p.metadata).some((v) => v.toLowerCase().includes(q));
}

/**
 * Deep link into the connected account's own dashboard. Standard accounts
 * accept the `/{acct}/` prefix; test mode adds `/test/`.
 */
export function stripeDashboardUrl(
  account: string | null | undefined,
  livemode: boolean | null | undefined,
  path: string,
): string {
  const base = "https://dashboard.stripe.com";
  const acct = account ? `/${account}` : "";
  const mode = livemode === false ? "/test" : "";
  return `${base}${acct}${mode}/${path.replace(/^\//, "")}`;
}

/**
 * The backend answers 409 with this code when the workspace has no connected
 * account. The Products page keys its empty state off it rather than showing a
 * generic error.
 */
export const STRIPE_NOT_CONNECTED = "stripe_not_connected";

export function isStripeNotConnected(error: unknown): boolean {
  const data = (error as { response?: { data?: { code?: string } } })?.response
    ?.data;
  return data?.code === STRIPE_NOT_CONNECTED;
}

export async function getCatalogAccount(): Promise<CatalogAccount> {
  const res = await apiClient.get<CatalogAccount>("/stripe-catalog/account");
  return res.data;
}

export async function listCatalogProducts(
  params: ListProductsParams = {},
): Promise<CatalogList> {
  const res = await apiClient.get<CatalogList>("/stripe-catalog/products", {
    params: {
      ...(params.include_archived && { include_archived: "true" }),
      ...(params.refresh && { refresh: "1" }),
      ...(params.search && { search: params.search }),
    },
  });
  return res.data;
}

export async function getCatalogProduct(
  productId: string,
): Promise<CatalogProduct> {
  const res = await apiClient.get<CatalogProduct>(
    `/stripe-catalog/products/${encodeURIComponent(productId)}`,
  );
  return res.data;
}

export async function searchStripeCustomers(
  search: string,
  limit = 20,
): Promise<StripeCustomerSummary[]> {
  const res = await apiClient.get<StripeCustomerSummary[]>(
    "/stripe-catalog/customers",
    { params: { ...(search && { search }), limit } },
  );
  return res.data;
}
