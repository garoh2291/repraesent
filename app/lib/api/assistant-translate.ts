import { apiClient } from "./axios-instance";
import type { AiLocale } from "./ai-assistants";

/**
 * AI translation of an assistant's per-locale widget strings.
 *
 * Deliberately its own module rather than a section of `ai-assistants.ts`: the
 * endpoint persists nothing, is scoped to the appearance panel's local draft,
 * and — unlike every other assistant call — is billed to the workspace's own
 * OpenRouter key on the server side.
 */

export interface TranslateAssistantRequest {
  source_locale: AiLocale;
  items: Record<string, { value: string; format?: "text" | "html" }>;
  targets: { locale: AiLocale; keys: string[] }[];
}

export interface TranslateAssistantLocaleResult {
  locale: AiLocale;
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

export interface TranslateAssistantResponse {
  source_locale: AiLocale;
  results: TranslateAssistantLocaleResult[];
}

export async function translateAssistant(
  assistantId: string,
  body: TranslateAssistantRequest,
): Promise<TranslateAssistantResponse> {
  const response = await apiClient.post<TranslateAssistantResponse>(
    `/ai-assistants/${assistantId}/translate`,
    body,
    // apiClient's default is 30s; the server allows itself 45s per locale and
    // would keep spending the workspace's tokens after the client gave up.
    { timeout: 90_000 },
  );
  return response.data;
}
