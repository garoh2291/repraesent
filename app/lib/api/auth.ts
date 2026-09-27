import {
  apiClient,
  extractErrorCode,
  extractErrorMessage,
  createApiError,
  type ApiError,
  setStoredRefreshToken,
} from "./axios-instance";
import { normalizeLocale, type SupportedLocale } from "~/i18n/locales";
import type { ClientType } from "~/lib/client-types";

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
  /** Optional: older backends don't send it (deploy skew). */
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Onboarding v2: finished, welcome screen (intro call) not closed yet. */
  onboarding_welcome_workspace_id?: string | null;
}

/**
 * Brand info for brand users
 */
export interface BrandInfo {
  id: string;
  name: string;
  logo: string | null;
  /** What the brand calls its connected workspaces; optional for deploy skew. */
  client_type?: ClientType;
  /** "Try a live demo" brand (demo_brands row); optional for deploy skew. */
  is_demo?: boolean;
  demo_expires_at?: string | null;
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
  lang: string,
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
  stripe_customer_id?: string | null;
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
  /** "Try a live demo" throwaway workspace (migration 126). */
  is_demo?: boolean;
  /** The platform's own workspace (migration 176): owns onboarding config. */
  is_root?: boolean;
  /** Root's Settings → Support switched "Contact re:praesent" on for this workspace. */
  support_contact_enabled?: boolean;
  /** Business type from the workspace profile (CLIENT_TYPES); drives default deal-stage words. Older API: absent. */
  industry?: string | null;
  /** Onboarding v2 in progress for this workspace, and whether it's mine. */
  onboarding?: { open: boolean; owner_is_me: boolean } | null;
  demo_expires_at?: string | null;
  /** Optional: older backends don't send it (deploy skew). */
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
}

/**
 * Register for self-service (sends magic link)
 */
export const register = async (
  email: string,
  locale?: SupportedLocale,
): Promise<{ status: string }> => {
  try {
    const response = await apiClient.post<{ status: string }>(
      "/auth/register",
      {
        email,
        locale,
      },
    );
    return response.data;
  } catch (error) {
    const apiError = createApiError(error);
    if (apiError.status === 409) {
      throw new Error(
        "This email is managed by an admin account. Use the login page.",
      );
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
  locale?: SupportedLocale,
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
/** The API's machine-readable causes for a link that did not work. */
export const MAGIC_LINK_UNKNOWN = "MAGIC_LINK_UNKNOWN";
export const MAGIC_LINK_USED = "MAGIC_LINK_USED";
export const MAGIC_LINK_EXPIRED = "MAGIC_LINK_EXPIRED";

/** Carries the API's `code` so the callback can say which thing went wrong. */
export class MagicLinkError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = "MagicLinkError";
  }
}

export const verifyMagicLink = async (token: string): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post<AuthResponse>(
      "/users/magic-link/verify",
      { token },
    );

    if (response.data.refresh_token) {
      setStoredRefreshToken(response.data.refresh_token);
    }

    return response.data;
  } catch (error) {
    // Carry the code through. Flattening this to a bare Error is what forced
    // the callback to substring-match an English sentence to work out whether
    // a link was expired, already used, or simply unknown.
    const apiError = createApiError(error);
    throw new MagicLinkError(
      apiError.message || "Invalid or expired magic link",
      extractErrorCode(error),
    );
  }
};

/** Causes for a 6-digit login code that did not work (PWA_PUSH_PLAN.md). */
export const CODE_INVALID = "CODE_INVALID";
export const CODE_EXPIRED = "CODE_EXPIRED";
export const CODE_TOO_MANY = "CODE_TOO_MANY";
export const MAGIC_LINK_INELIGIBLE = "MAGIC_LINK_INELIGIBLE";

/**
 * Sign in with the 6-digit code from the login email. Same response and the
 * same refresh-token storage as `verifyMagicLink`; failures carry the API's
 * `code` (CODE_INVALID | CODE_EXPIRED | CODE_TOO_MANY | MAGIC_LINK_INELIGIBLE)
 * so the login page can say what happened.
 */
export const verifyMagicCode = async (email: string, code: string): Promise<AuthResponse> => {
  try {
    const response = await apiClient.post<AuthResponse>("/users/magic-link/verify-code", {
      email: email.trim(),
      code,
    });
    if (response.data.refresh_token) {
      setStoredRefreshToken(response.data.refresh_token);
    }
    return response.data;
  } catch (error) {
    const apiError = createApiError(error);
    // 429 from a rate limiter without a body code still means "too many".
    const code = extractErrorCode(error) ?? (apiError.status === 429 ? CODE_TOO_MANY : null);
    throw new MagicLinkError(apiError.message || "Invalid or expired code", code);
  }
};

/**
 * Get user dashboard context (user + workspaces with services and role)
 */
export const getUserContext = async (): Promise<UserContextResponse> => {
  try {
    const response =
      await apiClient.get<UserContextResponse>("/users/me/context");
    return response.data;
  } catch (error) {
    const apiError = createApiError(error);
    if (apiError.status === 401 || apiError.status === 403) {
      throw error;
    }
    throw new Error(apiError.message || "Failed to fetch user context");
  }
};

/** 401/403 from the context call: the session really is gone. */
export function isAuthRejection(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return status === 401 || status === 403;
}

/**
 * getUserContext, retried with backoff on anything that is NOT an auth
 * rejection (5xx, pool timeout, network). A transient database blip must never
 * cost the user their session — and after a magic link the one-time token is
 * already spent, so giving up would strand them (the demo has no password).
 */
export async function getUserContextWithRetry(
  delaysMs: number[] = [1000, 2000, 4000, 8000],
  onRetry?: (attempt: number) => void,
): Promise<UserContextResponse> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getUserContext();
    } catch (error) {
      if (isAuthRejection(error) || attempt >= delaysMs.length) throw error;
      onRetry?.(attempt + 1);
      await new Promise((r) => setTimeout(r, delaysMs[attempt]));
    }
  }
}

/**
 * Update current user's locale
 */
export const updateUserLocale = async (
  locale: SupportedLocale,
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
  // A signed-out phone must not keep showing this person's inquiries on the
  // lock screen. Best effort, capped so signing out never hangs.
  const { forgetThisDeviceForAlerts } = await import("~/lib/pwa/use-pwa");
  await Promise.race([
    forgetThisDeviceForAlerts().catch(() => undefined),
    new Promise((r) => setTimeout(r, 2500)),
  ]);
};
