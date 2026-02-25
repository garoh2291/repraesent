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
 * Workspace product item
 */
export interface WorkspaceProduct {
  product_id: string;
  product_name: string;
  product_image: string | null;
  product_slug: string | null;
}

/**
 * Workspace with products and member role
 */
export interface WorkspaceContext {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  products: WorkspaceProduct[];
  member_role: "admin" | "editor" | "viewer";
}

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
 * Get user dashboard context (user + workspaces with products and role)
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
 * Logout (client-side only)
 */
export const logout = async (): Promise<void> => {
  return Promise.resolve();
};
