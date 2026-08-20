import { apiClient } from "./axios-instance";

export interface SendOutboundEmailPayload {
  /** Omitted falls back to the workspace's default mailbox. */
  emailAccountId?: string;
  to: string[];
  cc?: string[];
  /**
   * Extra BCC addresses only. The sender's own logging address is added by the
   * server on every send and cannot be removed from here.
   */
  bcc?: string[];
  subject: string;
  html: string;
  dealId?: string;
  contactId?: string;
  /** bcc_log_messages.id being replied to, so the recipient's client threads it. */
  replyToMessageId?: string;
}

/**
 * An email we sent that has not come back through BCC ingest yet.
 *
 * Rendered as a placeholder card so a send is visible immediately instead of
 * vanishing for the few minutes ingest takes. The server only returns
 * unreconciled rows, so the placeholder disappears on its own once the real
 * message lands — the client never de-duplicates the two.
 */
export interface PendingOutboundEmail {
  id: string;
  subject: string;
  from_email: string;
  from_name: string | null;
  to_emails: string[];
  cc_emails: string[];
  text_body: string | null;
  html_body: string;
  sent_at: string | null;
  send_error: string | null;
}

export async function sendOutboundEmail(
  payload: SendOutboundEmailPayload,
): Promise<{ id: string; sent_at: string }> {
  const res = await apiClient.post<{ id: string; sent_at: string }>(
    "/outbound-mail/send",
    payload,
  );
  return res.data;
}

export async function getPendingOutboundEmails(params: {
  dealId?: string;
  contactId?: string;
}): Promise<PendingOutboundEmail[]> {
  const searchParams = new URLSearchParams();
  if (params.dealId) searchParams.set("dealId", params.dealId);
  if (params.contactId) searchParams.set("contactId", params.contactId);
  const query = searchParams.toString();
  const res = await apiClient.get<PendingOutboundEmail[]>(
    `/outbound-mail/pending${query ? `?${query}` : ""}`,
  );
  return res.data;
}
