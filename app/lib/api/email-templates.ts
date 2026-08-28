import { apiClient } from "./axios-instance";

/**
 * Email templates — hand-written mirror of
 * nestjs-monolith/src/modules/email-templates (block.types.ts + DTOs), the
 * same way lib/api/workflows.ts mirrors the workflow types.
 */

export const BLOCK_TYPES = [
  "heading",
  "text",
  "image",
  "button",
  "divider",
  "spacer",
  "columns",
  "html",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];
export type BlockAlign = "left" | "center" | "right";

export interface Block {
  id: string;
  type: BlockType;
  attrs: Record<string, unknown>;
  /** Only for type "columns": one block list per column (no further nesting). */
  columns?: Block[][];
}

export interface TemplateLocaleContent {
  subject: string;
  preheader?: string;
  blocks: Block[];
  /** Unsubscribe wording in this language; falls back to the template default. */
  unsubscribe_text?: string;
  /**
   * Which source string each translation here came from, and what was written —
   * two hashes per key. Lets an edit in another language update this one
   * WITHOUT overwriting copy a person has since rewritten by hand. See
   * `lib/email-templates/translation-sync.ts`.
   *
   * Optional and additive: the server validates only `subject` and `blocks`
   * (`isTemplateDocument`) and stores the document verbatim, so older templates
   * simply have none and are treated as unlinked until someone links them.
   */
  translated?: Record<string, { src: string; out: string }>;
}

export interface TemplateDocument {
  version: 1;
  locales: Record<string, TemplateLocaleContent>;
}

export interface TemplateSettings {
  /** Default unsubscribe wording for locales that set none of their own. */
  unsubscribe_text?: string;
  /**
   * Whether the automatic unsubscribe footer is appended. Default true.
   * Template-wide: an opt-out present in one language and missing in another
   * is worse than one consistently absent. Turning it off makes the template
   * unschedulable as a campaign — the server enforces that.
   */
  unsubscribe_enabled?: boolean;
  width?: number;
  background_color?: string;
  content_background_color?: string;
  font_family?: string;
  text_color?: string;
  link_color?: string;
}

export interface EmailTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  default_locale: string;
  current_version: number;
  complete_locales: string[];
  has_unpublished_changes: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateDetail {
  id: string;
  name: string;
  description: string | null;
  default_locale: string;
  content: TemplateDocument;
  settings: TemplateSettings;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface SavedRow {
  id: string;
  name: string;
  category: "header" | "content" | "footer";
  blocks: Block[];
  created_at: string;
  updated_at: string;
}

export interface TemplatePreviewResult {
  subject: string;
  html: string;
  unresolved: string[];
  locale_complete: boolean;
}

export interface PaginatedTemplates {
  data: EmailTemplateSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export async function listEmailTemplates(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedTemplates> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search) query.set("search", params.search);
  const { data } = await apiClient.get(`/email-templates?${query.toString()}`);
  return data;
}

export async function getEmailTemplate(
  id: string,
): Promise<EmailTemplateDetail> {
  const { data } = await apiClient.get(`/email-templates/${id}`);
  return data;
}

export async function createEmailTemplate(payload: {
  name: string;
  description?: string;
  default_locale?: string;
  content?: TemplateDocument;
  settings?: TemplateSettings;
}): Promise<EmailTemplateDetail> {
  const { data } = await apiClient.post("/email-templates", payload);
  return data;
}

export async function updateEmailTemplate(
  id: string,
  payload: {
    name?: string;
    description?: string | null;
    default_locale?: string;
    content?: TemplateDocument;
    settings?: TemplateSettings;
    /** Republish after saving when a published version exists (autosave). */
    auto_publish?: boolean;
  },
): Promise<EmailTemplateDetail> {
  const { data } = await apiClient.patch(`/email-templates/${id}`, payload);
  return data;
}

export async function publishEmailTemplate(
  id: string,
): Promise<{ id: string; version: number }> {
  const { data } = await apiClient.post(`/email-templates/${id}/publish`);
  return data;
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  await apiClient.delete(`/email-templates/${id}`);
}

export async function previewEmailTemplate(
  id: string,
  payload: {
    locale: string;
    contact_id?: string;
    content?: TemplateDocument;
    settings?: TemplateSettings;
  },
): Promise<TemplatePreviewResult> {
  const { data } = await apiClient.post(
    `/email-templates/${id}/preview`,
    payload,
  );
  return data;
}

export async function renderEmailTemplate(
  id: string,
  payload: {
    locale: string;
    contact_id?: string;
    /**
     * What the destination sends. "transactional" strips the unsubscribe
     * footer — a form or appointment confirmation should not offer to opt out
     * of a reply the person just asked for. Defaults to "marketing".
     */
    purpose?: "marketing" | "transactional";
  },
): Promise<TemplatePreviewResult> {
  const { data } = await apiClient.post(
    `/email-templates/${id}/render`,
    payload,
  );
  return data;
}

export async function testSendEmailTemplate(
  id: string,
  payload: {
    to: string;
    locale: string;
    contact_id?: string;
    email_account_id?: string;
  },
): Promise<{ sent: true }> {
  const { data } = await apiClient.post(
    `/email-templates/${id}/test-send`,
    payload,
  );
  return data;
}

export interface TranslateTemplateResponse {
  source_locale: string;
  results: {
    locale: string;
    ok: boolean;
    error_code?: string;
    values: Record<string, string>;
    stats: {
      requested: number;
      translated: number;
      fallback: number;
      dropped: number;
    };
  }[];
}

export async function translateEmailTemplate(
  id: string,
  body: {
    source_locale: string;
    items: Record<string, { value: string; format?: "text" | "html" }>;
    targets: { locale: string; keys: string[] }[];
  },
): Promise<TranslateTemplateResponse> {
  // apiClient default timeout is 30s; the server allows 45s per locale.
  const { data } = await apiClient.post(
    `/email-templates/${id}/translate`,
    body,
    { timeout: 90_000 },
  );
  return data;
}

export async function listSavedRows(): Promise<SavedRow[]> {
  const { data } = await apiClient.get("/email-templates/rows");
  return data;
}

export async function createSavedRow(payload: {
  name: string;
  category?: "header" | "content" | "footer";
  blocks: Block[];
}): Promise<SavedRow> {
  const { data } = await apiClient.post("/email-templates/rows", payload);
  return data;
}

export async function deleteSavedRow(id: string): Promise<void> {
  await apiClient.delete(`/email-templates/rows/${id}`);
}
