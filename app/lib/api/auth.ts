import {
  apiClient,
  extractErrorMessage,
  createApiError,
  type ApiError,
  setStoredRefreshToken,
} from "./axios-instance";

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
  created_at?: string;
  updated_at?: string;
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
  service_image: string | null;
  service_slug: string | null;
  service_type: string | null;
  service_icon: string | null;
  service_config: Record<string, unknown> | null;
}

/**
 * Get service display name based on user's preferred language (i18n).
 * Uses personal language override, not workspace language.
 */
export function getLocalizedServiceName(
  service: Pick<WorkspaceService, "service_name" | "service_name_en" | "service_name_de">,
  lang: string
): string {
  const isDe = lang?.startsWith("de");
  if (isDe) {
    return service.service_name_de ?? service.service_name_en ?? service.service_name;
  }
  return service.service_name_en ?? service.service_name_de ?? service.service_name;
}

/**
 * Workspace with services and member role
 */
export interface WorkspaceProduct {
  id: string;
  stripe_product_id: string;
  stripe_product_name: string;
  stripe_price_id: string;
  status: string;
  stripe_subscription_id?: string | null;
  hosted_invoice_url?: string | null;
}

export interface WorkspaceContext {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  status?: "active" | "pending" | "past_due" | "canceled";
  stripe_customer_id?: string | null;
  unpaid_invoice_due_date?: string | null;
  unpaid_invoice_url?: string | null;
  products?: WorkspaceProduct[];
  services: WorkspaceService[];
  member_role: "admin" | "editor" | "viewer";
}

/**
 * Register for self-service (sends magic link)
 */
export const register = async (email: string): Promise<{ status: string }> => {
  try {
    const response = await apiClient.post<{ status: string }>("/auth/register", {
      email,
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
 * User context response (user + workspaces)
 */
export interface UserContextResponse {
  user: User;
  workspaces: WorkspaceContext[];
}

/**
 * Request a magic link to be sent to the given email
 */
export const requestMagicLink = async (email: string): Promise<void> => {
  try {
    await apiClient.post("/users/magic-link", { email });
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
  locale: "en" | "de"
): Promise<void> => {
  await apiClient.patch("/users/me/locale", { locale });
};

/**
 * Logout (client-side only)
 */
export const logout = async (): Promise<void> => {
  return Promise.resolve();
};
