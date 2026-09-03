/**
 * Stripe Checkout facts a product-form lead carries in its metadata.
 *
 * Mirrors lib/leads/appointment.ts: one place that knows the stamp keys, so
 * the kanban card, the table, the sheet and the full page read the same shape
 * and "Additional info" can hide the raw keys.
 */
import type { Lead } from "~/lib/api/leads";
import { countryName } from "~/lib/forms/commerce";

export type CheckoutStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "expired";
export type CheckoutMode = "payment" | "subscription";

export interface LeadCheckoutAddress {
  line1: string | null;
  line2: string | null;
  city: string | null;
  postalCode: string | null;
  state: string | null;
  country: string | null;
}

export interface LeadCheckout {
  status: CheckoutStatus;
  mode: CheckoutMode | null;
  /** Minor units, as Stripe reports them. */
  amountTotal: number | null;
  currency: string | null;
  /** "Appointment, Lead Crm ×2" — the ticked lines, stamped by the server. */
  products: string[];
  sessionId: string | null;
  customerId: string | null;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  completedAt: Date | null;
  billing: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: LeadCheckoutAddress | null;
  } | null;
  shipping: { name: string | null; address: LeadCheckoutAddress | null } | null;
}

/** Minimal lead shape so brand-view row types can use these helpers too. */
export type CheckoutLeadLike = Pick<Lead, "id" | "metadata">;

const STATUSES: readonly CheckoutStatus[] = [
  "pending",
  "processing",
  "paid",
  "failed",
  "expired",
];

/**
 * Every key the checkout stamps write. Enumerated, not prefix-matched: a form
 * field the editor happened to call "billing_note" must stay visible.
 */
export const CHECKOUT_META_KEYS: readonly string[] = [
  "checkout_status",
  "checkout_payment_status",
  "checkout_amount_total",
  "checkout_currency",
  "checkout_mode",
  "checkout_session_id",
  "checkout_completed_at",
  "checkout_products",
  "stripe_customer_id",
  "stripe_payment_intent_id",
  "stripe_subscription_id",
  "billing_name",
  "billing_email",
  "billing_phone",
  "billing_address_line1",
  "billing_address_line2",
  "billing_address_city",
  "billing_address_postal_code",
  "billing_address_state",
  "billing_address_country",
  "shipping_name",
  "shipping_address_line1",
  "shipping_address_line2",
  "shipping_address_city",
  "shipping_address_postal_code",
  "shipping_address_state",
  "shipping_address_country",
];

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value)) return Number(value);
  return null;
}

function date(value: unknown): Date | null {
  const s = str(value);
  if (!s) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
}

function address(
  meta: Record<string, unknown>,
  prefix: "billing_address" | "shipping_address",
): LeadCheckoutAddress | null {
  const a: LeadCheckoutAddress = {
    line1: str(meta[`${prefix}_line1`]),
    line2: str(meta[`${prefix}_line2`]),
    city: str(meta[`${prefix}_city`]),
    postalCode: str(meta[`${prefix}_postal_code`]),
    state: str(meta[`${prefix}_state`]),
    country: str(meta[`${prefix}_country`]),
  };
  return Object.values(a).some((v) => v != null) ? a : null;
}

/** null unless the lead went through a product form's checkout. */
export function extractLeadCheckout(
  lead: CheckoutLeadLike,
): LeadCheckout | null {
  const metadata = lead.metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const meta = metadata as Record<string, unknown>;
  const status = str(meta.checkout_status);
  if (!status || !(STATUSES as readonly string[]).includes(status)) return null;

  const mode = str(meta.checkout_mode);
  const billingAddress = address(meta, "billing_address");
  const billingName = str(meta.billing_name);
  const billingEmail = str(meta.billing_email);
  const billingPhone = str(meta.billing_phone);
  const shippingAddress = address(meta, "shipping_address");
  const shippingName = str(meta.shipping_name);

  return {
    status: status as CheckoutStatus,
    mode: mode === "payment" || mode === "subscription" ? mode : null,
    amountTotal: num(meta.checkout_amount_total),
    currency: str(meta.checkout_currency),
    products: (str(meta.checkout_products) ?? "")
      .split(", ")
      .map((p) => p.trim())
      .filter(Boolean),
    sessionId: str(meta.checkout_session_id),
    customerId: str(meta.stripe_customer_id),
    paymentIntentId: str(meta.stripe_payment_intent_id),
    subscriptionId: str(meta.stripe_subscription_id),
    completedAt: date(meta.checkout_completed_at),
    billing:
      billingName || billingEmail || billingPhone || billingAddress
        ? {
            name: billingName,
            email: billingEmail,
            phone: billingPhone,
            address: billingAddress,
          }
        : null,
    shipping:
      shippingName || shippingAddress
        ? { name: shippingName, address: shippingAddress }
        : null,
  };
}

/** Keys hidden from "Additional info" because the payment block shows them. */
export function checkoutClaimedMetaKeys(lead: CheckoutLeadLike): Set<string> {
  return extractLeadCheckout(lead) ? new Set(CHECKOUT_META_KEYS) : new Set();
}

/** "Musterstraße 1, 10115 Berlin, Germany" — same order as the contact hero. */
export function formatCheckoutAddressOneLine(
  a: LeadCheckoutAddress,
  locale: string,
): string {
  const cityLine = [a.postalCode, a.city].filter(Boolean).join(" ");
  return [
    a.line1,
    a.line2,
    cityLine || null,
    a.state,
    a.country ? countryName(a.country, locale) : null,
  ]
    .filter(Boolean)
    .join(", ");
}
