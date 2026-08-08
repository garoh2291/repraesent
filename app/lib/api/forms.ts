import axios from "axios";
import { apiClient } from "./axios-instance";
import type {
  FormConfirmationEmail,
  FormDefinition,
  FormDefinitionIssue,
  FormLocale,
  PublicFormPayload,
  SubmitFormResult,
} from "~/lib/forms/schema";

export interface FormSummary {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published";
  has_unpublished_changes: boolean;
  locales: FormLocale[];
  default_locale: FormLocale;
  submission_count: number;
  last_submission_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormRecord extends FormSummary {
  workspace_id: string;
  definition: FormDefinition;
  published_definition: FormDefinition | null;
  published_at: string | null;
  confirmation_email: FormConfirmationEmail | null;
  /** Machine codes blocking publish. Empty means publishable. */
  issues: FormDefinitionIssue[];
}

export interface UpdateFormDto {
  name?: string;
  definition?: FormDefinition;
  locales?: FormLocale[];
  default_locale?: FormLocale;
}

export type SnippetMode = "html" | "iframe" | "script";

// --- Authenticated -----------------------------------------------------------

export async function getForms(): Promise<FormSummary[]> {
  const response = await apiClient.get<FormSummary[]>("/forms");
  return response.data ?? [];
}

export async function getForm(formId: string): Promise<FormRecord> {
  const response = await apiClient.get<FormRecord>(`/forms/${formId}`);
  return response.data;
}

export async function createForm(payload: {
  name: string;
  default_locale?: FormLocale;
}): Promise<FormRecord> {
  const response = await apiClient.post<FormRecord>("/forms", payload);
  return response.data;
}

export async function updateForm(
  formId: string,
  dto: UpdateFormDto,
): Promise<FormRecord> {
  const response = await apiClient.patch<FormRecord>(`/forms/${formId}`, dto);
  return response.data;
}

export async function publishForm(formId: string): Promise<FormRecord> {
  const response = await apiClient.post<FormRecord>(`/forms/${formId}/publish`);
  return response.data;
}

export async function unpublishForm(formId: string): Promise<FormRecord> {
  const response = await apiClient.post<FormRecord>(
    `/forms/${formId}/unpublish`,
  );
  return response.data;
}

export async function duplicateForm(formId: string): Promise<FormRecord> {
  const response = await apiClient.post<FormRecord>(
    `/forms/${formId}/duplicate`,
  );
  return response.data;
}

export async function deleteForm(formId: string): Promise<void> {
  await apiClient.delete(`/forms/${formId}`);
}

export async function updateFormConfirmationEmail(
  formId: string,
  dto: FormConfirmationEmail,
): Promise<FormRecord> {
  const response = await apiClient.put<FormRecord>(
    `/forms/${formId}/confirmation-email`,
    dto,
  );
  return response.data;
}

export async function getFormSnippet(
  formId: string,
  mode: SnippetMode,
  locale?: FormLocale,
): Promise<string> {
  const params = new URLSearchParams({ mode });
  if (locale) params.set("locale", locale);
  const response = await apiClient.get<{ snippet: string }>(
    `/forms/${formId}/snippet?${params.toString()}`,
  );
  return response.data?.snippet ?? "";
}

// --- AI translation ----------------------------------------------------------

/** Reserved keys for the confirmation e-mail, alongside the content keys. */
export const EMAIL_SUBJECT_KEY = "email.subject";
export const EMAIL_BODY_KEY = "email.body_html";

export interface TranslateFormRequest {
  source_locale: FormLocale;
  items: Record<string, { value: string; format?: "text" | "html" }>;
  targets: { locale: FormLocale; keys: string[] }[];
}

export interface TranslateFormLocaleResult {
  locale: FormLocale;
  ok: boolean;
  error_code?: string;
  values: Record<string, string>;
  stats: {
    requested: number;
    translated: number;
    fallback: number;
    dropped: number;
  };
}

export interface TranslateFormResponse {
  source_locale: FormLocale;
  results: TranslateFormLocaleResult[];
}

export async function translateForm(
  formId: string,
  body: TranslateFormRequest,
): Promise<TranslateFormResponse> {
  const response = await apiClient.post<TranslateFormResponse>(
    `/forms/${formId}/translate`,
    body,
    // apiClient's default is 30s; the server allows itself 45s per locale and
    // would keep spending tokens after the client had already given up.
    { timeout: 90_000 },
  );
  return response.data;
}

// --- Public (no auth) --------------------------------------------------------

/**
 * A bare client for the unauthenticated endpoints.
 *
 * Deliberately NOT the shared apiClient: its response interceptor clears tokens
 * and redirects to /login on any 401. These endpoints never 401, but a visitor
 * carrying a stale token in localStorage should never be at risk of being
 * bounced out of a public form page.
 */
const publicClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8001/api",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

export async function getPublicForm(
  formId: string,
): Promise<PublicFormPayload> {
  const response = await publicClient.get<PublicFormPayload>(
    `/public/forms/${formId}`,
  );
  return response.data;
}

export interface SubmitPublicFormPayload {
  locale: FormLocale;
  values: Record<string, unknown>;
  meta?: Record<string, string>;
  hp?: string;
  rt?: string;
  elapsed_ms?: number;
}

export async function submitPublicForm(
  formId: string,
  payload: SubmitPublicFormPayload,
): Promise<SubmitFormResult> {
  const response = await publicClient.post<SubmitFormResult>(
    `/public/forms/${formId}/submit`,
    payload,
  );
  return response.data;
}
