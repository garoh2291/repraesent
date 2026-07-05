import { apiClient } from "./axios-instance";

export interface BccAddress {
  token: string;
  address: string;
  domain: string;
  disabledAt: string | null;
}

/** An existing contact that owns a participant's email. */
export interface BccContactMatch {
  id: string;
  full_name: string | null;
}

export interface BccMessageParticipant {
  id: string;
  bcc_log_message_id: string;
  kind: "from" | "to" | "cc" | "bcc";
  email: string | null;
  display_name: string | null;
  /** Existing contact owning this participant's email (enriched by the list endpoint). */
  contact_match?: BccContactMatch | null;
  /** Whether that contact is already linked to this message. */
  linked?: boolean;
}

/** A contact linked to a message via the M2M join. */
export interface BccLinkedContact {
  id: string;
  full_name: string | null;
  primary_email: string | null;
}

export interface BccMessage {
  id: string;
  bcc_log_address_id: string;
  workspace_id: string;
  message_id_header: string | null;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  sent_at: string | null;
  text_body: string | null;
  html_body: string | null;
  ingested_at: string;
  participants: BccMessageParticipant[];
  /** Customer email the matcher keys on (to → cc → from). */
  counterpart_email?: string | null;
  /** All contacts linked to this message (M2M), primary first. */
  contacts?: BccLinkedContact[];
  /** Deal context only: whether this email is hidden from the deal. */
  hidden?: boolean;
  /** Why it's hidden: a manual override or a segment rule. */
  hidden_reason?: "manual" | "rule" | null;
}

export interface PaginatedBccMessages {
  data: BccMessage[];
  page: number;
  pageSize: number;
  total?: number;
}

export async function getBccAddress(): Promise<BccAddress> {
  const res = await apiClient.get<BccAddress>("/bcc-mail/address");
  return res.data;
}

export async function regenerateBccAddress(): Promise<BccAddress> {
  const res = await apiClient.post<BccAddress>("/bcc-mail/address/regenerate");
  return res.data;
}

export interface GetBccMessagesParams {
  contactId?: string;
  dealId?: string;
  unlinked?: boolean;
  linked?: boolean;
  page?: number;
  pageSize?: number;
}

export async function getBccMessages(
  params: GetBccMessagesParams = {},
): Promise<PaginatedBccMessages> {
  const searchParams = new URLSearchParams();
  if (params.contactId) searchParams.set("contactId", params.contactId);
  if (params.dealId) searchParams.set("dealId", params.dealId);
  if (params.unlinked) searchParams.set("unlinked", "true");
  if (params.linked) searchParams.set("linked", "true");
  if (params.page) searchParams.set("page", String(params.page));
  if (params.pageSize) searchParams.set("pageSize", String(params.pageSize));
  const query = searchParams.toString();
  const res = await apiClient.get<PaginatedBccMessages>(
    `/bcc-mail/messages${query ? `?${query}` : ""}`,
  );
  return res.data;
}

/**
 * Link a contact to a message. When `email` is passed and the contact doesn't
 * own it, it's added to the contact (primary if it has none, else secondary).
 * 409 if the email already belongs to another contact.
 */
export async function attachMessageContact(
  messageId: string,
  body: { contactId: string; email?: string | null },
): Promise<{ ok: true }> {
  const res = await apiClient.post<{ ok: true }>(
    `/bcc-mail/messages/${messageId}/contacts`,
    body,
  );
  return res.data;
}

export async function detachMessageContact(
  messageId: string,
  contactId: string,
): Promise<{ ok: boolean }> {
  const res = await apiClient.delete<{ ok: boolean }>(
    `/bcc-mail/messages/${messageId}/contacts/${contactId}`,
  );
  return res.data;
}

export async function createMessageContactsBulk(
  messageId: string,
  items: { email: string; firstName?: string | null }[],
): Promise<{ created: number; contactIds: string[] }> {
  const res = await apiClient.post<{ created: number; contactIds: string[] }>(
    `/bcc-mail/messages/${messageId}/contacts/bulk`,
    { items },
  );
  return res.data;
}

// --- Deal-scoped email hiding + segment rules ------------------------------

export interface SegmentCondition {
  field: "subject" | "body";
  value: string;
}

export interface DealEmailSegment {
  match_mode: "all" | "any";
  conditions: SegmentCondition[];
}

export async function getDealEmailSegment(
  dealId: string,
): Promise<DealEmailSegment> {
  const res = await apiClient.get<DealEmailSegment>(
    `/deals/${dealId}/email-segment`,
  );
  return res.data;
}

export async function putDealEmailSegment(
  dealId: string,
  segment: DealEmailSegment,
): Promise<DealEmailSegment> {
  const res = await apiClient.put<DealEmailSegment>(
    `/deals/${dealId}/email-segment`,
    segment,
  );
  return res.data;
}

/** Hide (true) or show (false) a specific email for this deal. */
export async function setDealEmailVisibility(
  dealId: string,
  messageId: string,
  hidden: boolean,
): Promise<{ ok: boolean }> {
  const res = await apiClient.put<{ ok: boolean }>(
    `/deals/${dealId}/emails/${messageId}/visibility`,
    { hidden },
  );
  return res.data;
}

/** Clear the manual override so the email reverts to rule/default visibility. */
export async function resetDealEmailVisibility(
  dealId: string,
  messageId: string,
): Promise<{ ok: boolean }> {
  const res = await apiClient.delete<{ ok: boolean }>(
    `/deals/${dealId}/emails/${messageId}/visibility`,
  );
  return res.data;
}
