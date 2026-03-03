import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { AxiosResponse } from "axios";

// API Configuration
const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// Token storage keys
const AUTH_TOKEN_KEY = "auth_token";
const REFRESH_TOKEN_KEY = "refresh_token";
const WORKSPACE_ID_KEY = "workspace_id";

/**
 * Get stored access token from localStorage
 */
export const getStoredToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

/**
 * Store access token in localStorage
 */
export const setStoredToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

/**
 * Get stored refresh token from localStorage
 */
export const getStoredRefreshToken = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

/**
 * Store refresh token in localStorage
 */
export const setStoredRefreshToken = (token: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
};

/**
 * Clear stored tokens
 */
export const clearStoredToken = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

/**
 * Get stored workspace ID from localStorage
 */
export const getStoredWorkspaceId = (): string | null => {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WORKSPACE_ID_KEY);
};

/**
 * Store workspace ID in localStorage
 */
export const setStoredWorkspaceId = (workspaceId: string): void => {
  if (typeof window === "undefined") return;
  localStorage.setItem(WORKSPACE_ID_KEY, workspaceId);
};

/**
 * Clear stored workspace ID
 */
export const clearStoredWorkspaceId = (): void => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(WORKSPACE_ID_KEY);
};

/**
 * Create axios instance with default configuration
 */
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 30000, // 30 seconds
});

/**
 * Request interceptor - Add auth token to requests
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getStoredToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const workspaceId = getStoredWorkspaceId();
    if (workspaceId && config.headers) {
      config.headers["X-Workspace-Id"] = workspaceId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });

  failedQueue = [];
};

/**
 * Response interceptor - Handle token refresh and errors
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 Unauthorized - Token expired or invalid
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If already refreshing, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers && token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return apiClient(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = getStoredRefreshToken();

      if (!refreshToken) {
        // No refresh token, clear everything and redirect to login
        clearStoredToken();
        clearStoredWorkspaceId();
        processQueue(new Error("No refresh token available"), null);
        isRefreshing = false;

        if (
          typeof window !== "undefined" &&
          !window.location.pathname.includes("/login") &&
          !window.location.pathname.includes("/auth/callback")
        ) {
          window.location.href = "/login";
        }

        return Promise.reject(error);
      }

      try {
        // Try to refresh the token
        const response = await axios.post<{ access_token: string }>(
          `${API_BASE_URL}/users/refresh-token`,
          { refresh_token: refreshToken }
        );

        const accessToken = response.data.access_token;

        // Store new access token
        setStoredToken(accessToken);

        // Update the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }

        // Process queued requests
        processQueue(null, accessToken);
        isRefreshing = false;

        // Retry the original request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        clearStoredToken();
        clearStoredWorkspaceId();
        processQueue(refreshError as Error, null);
        isRefreshing = false;

        if (
          typeof window !== "undefined" &&
          !window.location.pathname.includes("/login") &&
          !window.location.pathname.includes("/auth/callback")
        ) {
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      }
    }

    // Handle 403 Forbidden - Access denied (clear tokens and redirect to login)
    if (error.response?.status === 403) {
      clearStoredToken();
      clearStoredWorkspaceId();

      // Redirect to login if not already on login page
      if (
        typeof window !== "undefined" &&
        !window.location.pathname.includes("/login") &&
        !window.location.pathname.includes("/auth/callback")
      ) {
        window.location.href = "/login";
      }

      return Promise.reject(error);
    }

    // Handle network errors
    if (!error.response) {
      return Promise.reject(
        new Error("Network error. Please check your connection.")
      );
    }

    return Promise.reject(error);
  }
);

/**
 * API Error types
 */
export interface ApiError {
  message: string;
  status?: number;
  statusText?: string;
  data?: unknown;
}

/**
 * Extract error message from axios error
 */
export const extractErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string;
      error?: string;
    }>;

    // Try to get error message from response
    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      if (typeof data === "object" && data !== null) {
        if ("message" in data) {
          const msg = data.message;
          if (typeof msg === "string") return msg;
          if (
            Array.isArray(msg) &&
            (msg as string[]).length > 0 &&
            typeof msg[0] === "string"
          ) {
            return (msg as string[])[0];
          }
        }
        if ("error" in data && typeof data.error === "string") {
          return data.error;
        }
      }
    }

    // Fallback to status text or default message
    if (axiosError.response?.statusText) {
      return axiosError.response.statusText;
    }

    if (axiosError.message) {
      return axiosError.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "An unexpected error occurred";
};

/**
 * Create API error object
 */
export const createApiError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;
    return {
      message: extractErrorMessage(error),
      status: axiosError.response?.status,
      statusText: axiosError.response?.statusText,
      data: axiosError.response?.data,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: "An unexpected error occurred",
  };
};
