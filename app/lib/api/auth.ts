import {
  apiClient,
  extractErrorMessage,
  createApiError,
  type ApiError,
  setStoredRefreshToken,
} from "./axios-instance";
import { normalizeLocale, type SupportedLocale } from "~/i18n/locales";

/**
 * User information from backend
 */
export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  user_type: string;
  locale?: string;
  brand_id?: string | null;
  onboarding_completed_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Brand info for brand users
 */
export interface BrandInfo {
  id: string;
  name: string;
  logo: string | null;
}

/**
 * Brand workspace (simplified, no member role)
 */
export interface BrandWorkspace {
  id: string;
  name: string;
  status: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Brand user context response
 */
export interface BrandContextResponse {
  user: User;
  brand: BrandInfo;
  workspaces: BrandWorkspace[];
}

/**
 * Auth response from magic link verify (same shape as login)
 */
export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

/**
 * Workspace service item
 * Use getLocalizedServiceName() to display based on user's preferred language
 */
export interface WorkspaceService {
  service_id: string;
  service_name: string;
  service_name_en: string | null;
  service_name_de: string | null;
  service_name_fr: string | null;
  service_name_nl: string | null;
  service_image: string | null;
  service_slug: string | null;
  service_type: string | null;
  service_icon: string | null;
  service_order: number;
  service_config: Record<string, unknown> | null;
}

/**
 * Get service display name based on user's preferred language (i18n).
 * Uses personal language override, not workspace language.
 */
export function getLocalizedServiceName(
  service: Pick<
    WorkspaceService,
    | "service_name"
    | "service_name_en"
    | "service_name_de"
    | "service_name_fr"
    | "service_name_nl"
  >,
  lang: string
): string {
  const byLocale: Record<SupportedLocale, string | null | undefined> = {
    de: service.service_name_de,
    en: service.service_name_en,
    fr: service.service_name_fr,
    nl: service.service_name_nl,
  };
  // Chosen language → German → English → fallback name.
  return (
    byLocale[normalizeLocale(lang)] ??
    service.service_name_de ??
    service.service_name_en ??
    service.service_name
  );
}

/**
 * Workspace with services and member role
 */
export interface WorkspaceProduct {
  id: string;
  stripe_product_id: string;
  stripe_product_name: string;
  stripe_price_id: string;
  unit_amount?: string | null;
  currency?: string | null;
  recurring_interval?: string | null;
  status: string;
  stripe_subscription_id?: string | null;
  hosted_invoice_url?: string | null;
}

export type WorkspaceType = "retailer" | "doorboost_brand";

export interface WorkspaceContext {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  status?: "active" | "pending" | "past_due" | "canceled" | "trial";
  stripe_contact_id?: string | null;
  unpaid_invoice_due_date?: string | null;
  unpaid_invoice_url?: string | null;
  products?: WorkspaceProduct[];
  services: WorkspaceService[];
  has_plausible_analytics?: boolean;
  member_role: "admin" | "editor" | "viewer";
  was_doorboost_client?: boolean;
  doorboost_partner_house_id?: string | null;
  type?: WorkspaceType;
  doorboost_brand_id?: string | null;
}

/**
 * Register for self-service (sends magic link)
 */
export const register = async (
  email: string,
  locale?: SupportedLocale
): Promise<{ status: string }> => {
  try {
    const response = await apiClient.post<{ status: string }>("/auth/register", {
      email,
      locale,
    });
    return response.data;
  } catch (error) {
    const apiError = createApiError(error);
    if (apiError.status === 409) {
      throw new Error("This email is managed by an admin account. Use the login page.");
    }
    throw new Error(apiError.message || "Failed to register");
  }
};

/**
 * User context response (user + workspaces for regular users, or brand context for brand users)
 */
export interface UserContextResponse {
  user: User;
  workspaces: WorkspaceContext[];
  /** Present only for brand users */
  brand?: BrandInfo;
  /** Present only for brand users (brand-connected workspaces) */
  brandWorkspaces?: BrandWorkspace[];
}

/**
 * Request a magic link to be sent to the given email
 */
export const requestMagicLink = async (
  email: string,
  locale?: SupportedLocale
): Promise<void> => {
  try {
    await apiClient.post("/users/magic-link", { email, locale });
  } catch (error) {
    const apiError = createApiError(error);
    throw new Error(apiError.message || "Failed to send magic link");
  }
};

/**
 * Verify magic link token and exchange for access + refresh tokens
 */
export const verifyMagicLink = async (
  token: string
): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post<AuthResponse>(
      "/users/magic-link/verify",
      { token }
    );

    if (response.data.refresh_token) {
      setStoredRefreshToken(response.data.refresh_token);
    }

    return response.data;
  } catch (error) {
    const apiError = createApiError(error);
    throw new Error(apiError.message || "Invalid or expired magic link");
  }
};

/**
 * Get user dashboard context (user + workspaces with services and role)
 */
export const getUserContext = async (): Promise<UserContextResponse> => {
  try {
    const response = await apiClient.get<UserContextResponse>(
      "/users/me/context"
    );
    return response.data;
  } catch (error) {
    const apiError = createApiError(error);
    if (apiError.status === 401 || apiError.status === 403) {
      throw error;
    }
    throw new Error(apiError.message || "Failed to fetch user context");
  }
};

/**
 * Update current user's locale
 */
export const updateUserLocale = async (
  locale: SupportedLocale
): Promise<void> => {
  await apiClient.patch("/users/me/locale", { locale });
};

/**
 * Mark the onboarding tour as completed for the current user
 */
export const completeOnboarding = async (): Promise<void> => {
  await apiClient.patch("/users/me/onboarding/complete");
};

/**
 * Logout (client-side only)
 */
export const logout = async (): Promise<void> => {
  return Promise.resolve();
};
