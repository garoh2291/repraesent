import { apiClient } from "./axios-instance";

export const FORM_WEBHOOK_EVENTS = [
  "form.submitted",
  "checkout.completed",
  "checkout.failed",
  "checkout.expired",
] as const;
export type FormWebhookEvent = (typeof FORM_WEBHOOK_EVENTS)[number];

/** checkout.* only exists on product forms. */
export const CHECKOUT_WEBHOOK_EVENTS: FormWebhookEvent[] = [
  "checkout.completed",
  "checkout.failed",
  "checkout.expired",
];

/**
 * Which keys of the flat `data` object go out, and under what name. The
 * envelope (form / submission / contact / checkout) is never mapped.
 */
export interface FormWebhookFieldMap {
  default: "include" | "exclude";
  keys: Record<string, { include: boolean; as?: string }>;
}

export const EMPTY_FIELD_MAP: FormWebhookFieldMap = {
  default: "include",
  keys: {},
};

export interface FormWebhook {
  id: string;
  form_id: string;
  name: string;
  /** scheme + host + last four path chars — the API never returns the URL. */
  url_masked: string;
  url_host: string;
  events: FormWebhookEvent[];
  field_map: FormWebhookFieldMap;
  is_active: boolean;
  /** "whsec_••••3f9a" */
  secret_masked: string;
  failure_count: number;
  last_error: string | null;
  last_success_at: string | null;
  last_delivery_at: string | null;
  disabled_reason: string | null;
  created_at: string;
  updated_at: string;
  /** Only on the create and rotate responses. */
  secret?: string;
}

export interface PayloadKey {
  key: string;
  label: string;
  type: "string" | "number" | "boolean" | "string[]" | "object" | "null";
  example: unknown;
  source: "field" | "column" | "metadata" | "checkout";
}

export interface PayloadKeyGroup {
  group: "fields" | "contact" | "submission" | "checkout";
  keys: PayloadKey[];
}

export interface PayloadKeysResponse {
  groups: PayloadKeyGroup[];
  envelope_example: Record<string, unknown>;
}

export interface FormWebhookDelivery {
  id: string;
  event_type: string;
  event_id: string;
  status: "pending" | "failed" | "succeeded" | "exhausted";
  attempts: number;
  response_status: number | null;
  response_body: string | null;
  duration_ms: number | null;
  last_error: string | null;
  lead_id: string | null;
  payload: unknown;
  next_attempt_at: string;
  created_at: string;
  delivered_at: string | null;
}

export interface WebhookTestResult {
  ok: boolean;
  status: number | null;
  duration_ms: number;
  body_excerpt: string | null;
  error: string | null;
  delivery_id: string;
}

/** Sent as `url` on PATCH when the editor did not touch the field. */
export const WEBHOOK_URL_UNCHANGED = "WEBHOOK_URL_UNCHANGED";

export interface CreateFormWebhookBody {
  name: string;
  url: string;
  events: FormWebhookEvent[];
  field_map?: FormWebhookFieldMap;
  is_active?: boolean;
}

export interface UpdateFormWebhookBody {
  name?: string;
  url?: string;
  events?: FormWebhookEvent[];
  field_map?: FormWebhookFieldMap;
  is_active?: boolean;
}

const base = (formId: string) => `/forms/${formId}/webhooks`;

export async function listFormWebhooks(formId: string): Promise<FormWebhook[]> {
  const res = await apiClient.get<FormWebhook[]>(base(formId));
  return res.data;
}

export async function getFormWebhookPayloadKeys(
  formId: string,
): Promise<PayloadKeysResponse> {
  const res = await apiClient.get<PayloadKeysResponse>(
    `${base(formId)}/payload-keys`,
  );
  return res.data;
}

export async function createFormWebhook(
  formId: string,
  body: CreateFormWebhookBody,
): Promise<FormWebhook> {
  const res = await apiClient.post<FormWebhook>(base(formId), body);
  return res.data;
}

export async function updateFormWebhook(
  formId: string,
  id: string,
  body: UpdateFormWebhookBody,
): Promise<FormWebhook> {
  const res = await apiClient.patch<FormWebhook>(`${base(formId)}/${id}`, body);
  return res.data;
}

export async function deleteFormWebhook(
  formId: string,
  id: string,
): Promise<void> {
  await apiClient.delete(`${base(formId)}/${id}`);
}

export async function testFormWebhook(
  formId: string,
  id: string,
  event?: FormWebhookEvent,
): Promise<WebhookTestResult> {
  const res = await apiClient.post<WebhookTestResult>(
    `${base(formId)}/${id}/test`,
    undefined,
    { params: event ? { event } : undefined },
  );
  return res.data;
}

export async function listFormWebhookDeliveries(
  formId: string,
  id: string,
  limit = 50,
): Promise<FormWebhookDelivery[]> {
  const res = await apiClient.get<FormWebhookDelivery[]>(
    `${base(formId)}/${id}/deliveries`,
    { params: { limit } },
  );
  return res.data;
}

export async function redeliverFormWebhook(
  formId: string,
  id: string,
  deliveryId: string,
): Promise<FormWebhookDelivery> {
  const res = await apiClient.post<FormWebhookDelivery>(
    `${base(formId)}/${id}/deliveries/${deliveryId}/redeliver`,
  );
  return res.data;
}

export async function revealFormWebhookSecret(
  formId: string,
  id: string,
): Promise<string> {
  const res = await apiClient.get<{ secret: string }>(
    `${base(formId)}/${id}/secret`,
  );
  return res.data.secret;
}

export async function rotateFormWebhookSecret(
  formId: string,
  id: string,
): Promise<FormWebhook> {
  const res = await apiClient.post<FormWebhook>(
    `${base(formId)}/${id}/rotate-secret`,
  );
  return res.data;
}
