import { apiClient } from "./axios-instance";

export type LeadCheckoutOutcome =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "expired";

export interface LeadCheckoutLineItem {
  price_id: string;
  product_id: string;
  name: string;
  quantity: number;
  unit_amount: number | null;
  currency: string;
  type: "one_time" | "recurring";
  interval: string | null;
  interval_count: number | null;
}

export interface LeadCheckoutAddressDto {
  line1: string | null;
  line2: string | null;
  city: string | null;
  postal_code: string | null;
  state: string | null;
  country: string | null;
}

export interface LeadCheckoutCustomerDetails {
  billing: {
    name: string | null;
    email: string | null;
    phone: string | null;
    address: LeadCheckoutAddressDto | null;
  } | null;
  shipping: {
    name: string | null;
    address: LeadCheckoutAddressDto | null;
  } | null;
}

/** One Stripe Checkout Session a lead opened (mirror of FormCheckoutSessionDto). */
export interface LeadCheckoutSession {
  id: string;
  form_id: string;
  lead_id: string;
  stripe_account_id: string;
  stripe_session_id: string;
  status: string;
  payment_status: string;
  outcome: LeadCheckoutOutcome;
  mode: string;
  livemode: boolean;
  amount_subtotal: number | null;
  amount_total: number | null;
  currency: string | null;
  customer_email: string | null;
  stripe_customer_id: string | null;
  payment_intent_id: string | null;
  subscription_id: string | null;
  line_items: LeadCheckoutLineItem[];
  customer_details: LeadCheckoutCustomerDetails | null;
  last_event_type: string | null;
  last_event_at: string | null;
  created_at: string;
  fulfilled_at: string | null;
  expires_at: string;
}

export async function getLeadCheckoutSessions(
  leadId: string,
): Promise<LeadCheckoutSession[]> {
  const res = await apiClient.get<LeadCheckoutSession[]>(
    `/leads/${leadId}/checkout-sessions`,
  );
  return res.data;
}
