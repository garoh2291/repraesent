import { apiClient } from "./axios-instance";

/**
 * How an account authenticates and sends.
 *
 * `google` accounts have no SMTP host and no password — the `gmail.send` scope
 * cannot authenticate to smtp.gmail.com, so they send over the Gmail REST API.
 */
export type EmailAccountProvider = "smtp" | "google";

/** `admin` = provisioned by Repraesent; `user` = connected here in Settings. */
export type EmailAccountSource = "admin" | "user";

export interface EmailAccount {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  provider: EmailAccountProvider;
  source: EmailAccountSource;
  smtp_server: string | null;
  smtp_port_ssl: number | null;
  smtp_port_starttls: number | null;
  smtp_auth_required: boolean;
  smtp_username: string | null;
  imap_server: string | null;
  imap_port_ssl: number | null;
  imap_port_starttls: number | null;
  imap_username: string | null;
  is_default: boolean;
  /** Non-null once the grant is revoked or expired: the account needs reconnecting. */
  auth_failed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type SmtpConnectionSecurity = "SSL_TLS" | "STARTTLS" | "NONE";

export interface ConnectSmtpPayload {
  name: string;
  email: string;
  smtp_server: string;
  smtp_port: number;
  connection_security: SmtpConnectionSecurity;
  smtp_username?: string;
  password: string;
  is_default?: boolean;
}

export async function listEmailAccountsForWorkspace(): Promise<EmailAccount[]> {
  const { data } = await apiClient.get<EmailAccount[]>("/email-accounts");
  return data;
}

/**
 * Connect a mailbox over SMTP.
 *
 * The server verifies against the real mail server before storing anything, so
 * a rejected promise means nothing was saved and the message is safe to show
 * directly on the form.
 */
export async function connectSmtpAccount(
  payload: ConnectSmtpPayload,
): Promise<EmailAccount> {
  const { data } = await apiClient.post<EmailAccount>(
    "/email-accounts/smtp",
    payload,
  );
  return data;
}

/**
 * Ask the API for a Google consent URL, then navigate to it.
 *
 * The API returns the URL instead of redirecting because a top-level browser
 * navigation carries no bearer token, so the server could not tell who is
 * connecting. Same handoff the WordPress SSO button uses.
 */
export async function getGoogleAuthorizeUrl(): Promise<string> {
  const { data } = await apiClient.get<{ url: string }>(
    "/email-accounts/google/authorize-url",
  );
  return data.url;
}

export async function setDefaultEmailAccount(id: string): Promise<EmailAccount> {
  const { data } = await apiClient.patch<EmailAccount>(
    `/email-accounts/${id}/default`,
  );
  return data;
}

export async function disconnectEmailAccount(id: string): Promise<void> {
  await apiClient.delete(`/email-accounts/${id}`);
}

/** Sensible default port for each mode, so the form pre-fills something real. */
export const DEFAULT_PORT: Record<SmtpConnectionSecurity, number> = {
  SSL_TLS: 465,
  STARTTLS: 587,
  NONE: 25,
};
