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
  /**
   * Non-null once the grant is revoked or expired: the account needs
   * reconnecting. On an alias this is inherited from its parent mailbox — an
   * alias sends with the parent's grant, so a dead parent breaks it too.
   */
  auth_failed_at: string | null;
  /**
   * Null on a real mailbox. On a Gmail send-as alias, the id of the mailbox it
   * sends through — the alias supplies only the From address.
   */
  parent_account_id: string | null;
  /**
   * Whether this address has a signature of its own — not whether it will send
   * one, since an alias falls back to its parent mailbox. The markup itself is
   * fetched per account, so a base64 logo never rides along with the list.
   */
  has_signature: boolean;
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

export interface AddEmailAliasPayload {
  email: string;
  /** Defaults to the parent mailbox's name when omitted. */
  name?: string;
}

/**
 * Add a Gmail "Send mail as" alias to a connected Google mailbox.
 *
 * The address is typed by the user rather than imported from Google: listing an
 * account's send-as addresses needs a restricted OAuth scope, which would drag
 * the whole app into an annual paid security audit. Sending from one needs
 * nothing beyond the `gmail.send` grant we already hold.
 *
 * The server sends a real test message before storing anything, so a rejected
 * promise means nothing was saved and the message is safe to show verbatim.
 */
export async function addEmailAlias(
  parentId: string,
  payload: AddEmailAliasPayload,
): Promise<EmailAccount> {
  const { data } = await apiClient.post<EmailAccount>(
    `/email-accounts/${parentId}/aliases`,
    payload,
  );
  return data;
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

/**
 * Reorder a flat account list so each Gmail send-as alias follows the mailbox
 * it sends through.
 *
 * The API orders default-first then oldest-first, which scatters an alias away
 * from its parent — in a dropdown that reads as an unrelated address the user
 * has to work out the provenance of. Rows are otherwise left in server order.
 *
 * Structurally typed rather than tied to `EmailAccount`, because the four
 * sender pickers read the narrower `WorkspaceEmailAccountSummary`.
 */
export function sortAccountsWithAliases<
  T extends { id: string; parent_account_id: string | null },
>(accounts: T[]): T[] {
  const byParent = new Map<string, T[]>();
  for (const account of accounts) {
    if (!account.parent_account_id) continue;
    const siblings = byParent.get(account.parent_account_id) ?? [];
    siblings.push(account);
    byParent.set(account.parent_account_id, siblings);
  }

  const ordered: T[] = [];
  for (const account of accounts) {
    if (account.parent_account_id) continue;
    ordered.push(account, ...(byParent.get(account.id) ?? []));
  }

  // An alias whose parent is filtered out of this particular list (a picker
  // that shows only user-connected accounts, say) would otherwise vanish.
  for (const account of accounts) {
    if (account.parent_account_id && !ordered.includes(account)) {
      ordered.push(account);
    }
  }

  return ordered;
}

/** Sensible default port for each mode, so the form pre-fills something real. */
export const DEFAULT_PORT: Record<SmtpConnectionSecurity, number> = {
  SSL_TLS: 465,
  STARTTLS: 587,
  NONE: 25,
};

export interface EmailAccountSignature {
  signature_html: string | null;
  /** Set when this alias is showing its parent mailbox's signature. */
  inherited_from: string | null;
}

export async function getEmailAccountSignature(
  id: string,
): Promise<EmailAccountSignature> {
  const res = await apiClient.get<EmailAccountSignature>(
    `/email-accounts/${id}/signature`,
  );
  return res.data;
}

/** Pass an empty string to clear it and fall back to the parent mailbox. */
export async function setEmailAccountSignature(
  id: string,
  signatureHtml: string,
): Promise<{ signature_html: string | null }> {
  const res = await apiClient.put<{ signature_html: string | null }>(
    `/email-accounts/${id}/signature`,
    { signature_html: signatureHtml },
  );
  return res.data;
}
