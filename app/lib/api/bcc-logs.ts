import { apiClient } from "./axios-instance";

export interface BccAddress {
  token: string;
  address: string;
  domain: string;
  disabledAt: string | null;
}

export interface BccMessageParticipant {
  id: string;
  bcc_log_message_id: string;
  kind: "from" | "to" | "cc" | "bcc";
  email: string | null;
  display_name: string | null;
}

export interface BccMessage {
  id: string;
  bcc_log_address_id: string;
  workspace_id: string;
  contact_id: string | null;
  match_ambiguous: boolean;
  message_id_header: string | null;
  subject: string | null;
  from_address: string | null;
  from_name: string | null;
  sent_at: string | null;
  text_body: string | null;
  html_body: string | null;
  ingested_at: string;
  participants: BccMessageParticipant[];
}

export interface PaginatedBccMessages {
  data: BccMessage[];
  page: number;
  pageSize: number;
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
  unlinked?: boolean;
  page?: number;
}

export async function getBccMessages(
  params: GetBccMessagesParams = {},
): Promise<PaginatedBccMessages> {
  const searchParams = new URLSearchParams();
  if (params.contactId) searchParams.set("contactId", params.contactId);
  if (params.unlinked) searchParams.set("unlinked", "true");
  if (params.page) searchParams.set("page", String(params.page));
  const query = searchParams.toString();
  const res = await apiClient.get<PaginatedBccMessages>(
    `/bcc-mail/messages${query ? `?${query}` : ""}`,
  );
  return res.data;
}

export async function linkBccMessage(
  messageId: string,
  contactId: string | null,
): Promise<BccMessage> {
  const res = await apiClient.patch<BccMessage>(
    `/bcc-mail/messages/${messageId}/link`,
    { contactId },
  );
  return res.data;
}
