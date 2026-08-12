import { apiClient } from "./axios-instance";

/**
 * Live proxy over the workspace's connected Stripe catalogue.
 *
 * Nothing here is mirrored into our database — every call hits Stripe through
 * the backend, so the page always agrees with the Stripe dashboard.
 */

export type ProductKind = "physical" | "digital" | "service";

export interface PackageDimensions {
  height: number;
  length: number;
  weight: number;
  width: number;
}

export interface CatalogPrice {
  id: string;
  active: boolean;
  currency: string;
  unit_amount: number | null;
  nickname: string | null;
  /** "one_time" | "recurring" */
  type: string;
  interval: string | null;
  interval_count: number | null;
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
  kind: ProductKind;
  category: string | null;
  /** Stripe has no stock field — this lives in product metadata. */
  inventory_count: number | null;
  unit_label: string | null;
  statement_descriptor: string | null;
  tax_code: string | null;
  url: string | null;
  package_dimensions: PackageDimensions | null;
  default_price_id: string | null;
  default_price: CatalogPrice | null;
  /** Only present on the single-product endpoint. */
  prices?: CatalogPrice[];
  metadata: Record<string, string>;
  created: number;
  updated: number;
}

export interface CatalogList {
  data: CatalogProduct[];
  has_more: boolean;
  next_cursor: string | null;
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

export interface TaxCode {
  id: string;
  name: string;
  description: string;
}

export interface CreatePriceBody {
  unit_amount: number;
  currency: string;
  interval?: "day" | "week" | "month" | "year";
  interval_count?: number;
  nickname?: string | null;
  tax_behavior?: "inclusive" | "exclusive" | "unspecified";
  set_as_default?: boolean;
}

export interface ProductBody {
  name: string;
  description?: string | null;
  images?: string[];
  active?: boolean;
  kind?: ProductKind;
  category?: string | null;
  inventory_count?: number | null;
  package_dimensions?: PackageDimensions | null;
  unit_label?: string | null;
  statement_descriptor?: string | null;
  tax_code?: string | null;
  url?: string | null;
  metadata?: Record<string, string>;
}

export interface CreateProductBody extends ProductBody {
  price?: CreatePriceBody;
}

export interface ListProductsParams {
  limit?: number;
  starting_after?: string;
  /** "true" | "false" | undefined for both */
  active?: string;
  search?: string;
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
      limit: params.limit ?? 20,
      ...(params.starting_after && { starting_after: params.starting_after }),
      ...(params.active && { active: params.active }),
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

export async function createCatalogProduct(
  body: CreateProductBody,
): Promise<CatalogProduct> {
  const res = await apiClient.post<CatalogProduct>(
    "/stripe-catalog/products",
    body,
  );
  return res.data;
}

export async function updateCatalogProduct(
  productId: string,
  body: Partial<ProductBody> & { default_price?: string },
): Promise<CatalogProduct> {
  const res = await apiClient.patch<CatalogProduct>(
    `/stripe-catalog/products/${encodeURIComponent(productId)}`,
    body,
  );
  return res.data;
}

/**
 * Stripe refuses to delete a product that has prices, so the backend archives
 * it instead. The flags say which happened — the user needs to know.
 */
export async function deleteCatalogProduct(
  productId: string,
): Promise<{ deleted: boolean; archived: boolean }> {
  const res = await apiClient.delete<{ deleted: boolean; archived: boolean }>(
    `/stripe-catalog/products/${encodeURIComponent(productId)}`,
  );
  return res.data;
}

export async function createCatalogPrice(
  productId: string,
  body: CreatePriceBody,
): Promise<CatalogProduct> {
  const res = await apiClient.post<CatalogProduct>(
    `/stripe-catalog/products/${encodeURIComponent(productId)}/prices`,
    body,
  );
  return res.data;
}

/** Prices are immutable in Stripe: only these three fields can change. */
export async function updateCatalogPrice(
  priceId: string,
  body: { active?: boolean; nickname?: string | null },
): Promise<CatalogProduct> {
  const res = await apiClient.patch<CatalogProduct>(
    `/stripe-catalog/prices/${encodeURIComponent(priceId)}`,
    body,
  );
  return res.data;
}

export async function setCatalogDefaultPrice(
  productId: string,
  priceId: string,
): Promise<CatalogProduct> {
  const res = await apiClient.post<CatalogProduct>(
    `/stripe-catalog/products/${encodeURIComponent(productId)}/default-price/${encodeURIComponent(priceId)}`,
  );
  return res.data;
}

/**
 * Upload a product image and get a public URL back.
 *
 * Stripe's `product.images` takes URLs, not files, so the bytes go to Stripe's
 * own file store first and the returned `files.stripe.com/links/…` URL is what
 * gets saved on the product. We host nothing.
 */
export async function uploadProductImage(
  file: File,
): Promise<{ url: string; file_id: string }> {
  const form = new FormData();
  form.append("file", file);

  const res = await apiClient.post<{ url: string; file_id: string }>(
    "/stripe-catalog/images",
    form,
    {
      // Unset the client's JSON default so the browser writes the multipart
      // boundary itself — same as the contacts and leads importers.
      headers: { "Content-Type": undefined },
      timeout: 60000,
    },
  );
  return res.data;
}

export async function listTaxCodes(): Promise<TaxCode[]> {
  const res = await apiClient.get<TaxCode[]>("/stripe-catalog/tax-codes");
  return res.data;
}
