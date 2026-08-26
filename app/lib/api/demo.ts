import { apiClient } from "./axios-instance";
import type { SupportedLocale } from "~/i18n/locales";
import type { ClientType } from "~/lib/client-types";

/**
 * Industries the demo offers: every brand client type plus the demo-only
 * trades the backend accepts (see nestjs-monolith demo-industries.ts). These
 * extras are NOT brand client types and never reach a client_type column.
 */
export const DEMO_EXTRA_INDUSTRIES = ["electrician"] as const;

export type DemoIndustry =
  | ClientType
  | (typeof DEMO_EXTRA_INDUSTRIES)[number];

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
  industry: DemoIndustry,
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
