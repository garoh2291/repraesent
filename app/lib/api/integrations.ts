import { apiClient } from "./axios-instance";

/** One card on Settings → Integrations. */
export interface WorkspaceIntegration {
  app_id: string;
  key: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  /** False when the app has no OAuth client id yet — Connect is unavailable. */
  configured: boolean;
  connected: boolean;
  integration_id: string | null;
  /** Provider account id, e.g. acct_1AB… */
  external_account_id: string | null;
  account_name: string | null;
  account_email: string | null;
  livemode: boolean | null;
  status: "connected" | "revoked" | "error" | null;
  connected_at: string | null;
  auth_failed_at: string | null;
  connected_by_user_id: string | null;
  connected_by_name: string | null;
}

export async function listIntegrations(): Promise<WorkspaceIntegration[]> {
  const res = await apiClient.get<WorkspaceIntegration[]>("/integrations");
  return res.data;
}

/**
 * Ask the API for a provider consent URL, then navigate to it.
 *
 * The API returns the URL instead of redirecting because a top-level browser
 * navigation carries no bearer token, so the server could not tell who is
 * connecting.
 */
export async function getIntegrationAuthorizeUrl(
  key: string,
): Promise<string> {
  const res = await apiClient.get<{ url: string }>(
    `/integrations/${encodeURIComponent(key)}/authorize-url`,
  );
  return res.data.url;
}

export async function disconnectIntegration(key: string): Promise<void> {
  await apiClient.delete(`/integrations/${encodeURIComponent(key)}`);
}
