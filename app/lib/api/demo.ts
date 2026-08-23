import { apiClient } from "./axios-instance";
import type { SupportedLocale } from "~/i18n/locales";
import type { ClientType } from "~/lib/client-types";

export interface CreateDemoResponse {
  redirect_url: string;
  expires_at: string;
}

/**
 * "Try a live demo": asks the backend to create a throwaway, prefilled demo
 * workspace. Returns a one-time magic-link URL the browser should navigate
 * to (full page load — the callback route finishes the login).
 * `website` is a honeypot and must stay empty.
 */
export const createDemo = async (
  industry: ClientType,
  locale: SupportedLocale,
  website = "",
): Promise<CreateDemoResponse> => {
  const response = await apiClient.post<CreateDemoResponse>("/public/demo", {
    industry,
    locale,
    website,
  });
  return response.data;
};
