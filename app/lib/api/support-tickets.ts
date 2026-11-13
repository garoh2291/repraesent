import { apiClient } from "./axios-instance";
import { generateThumbnail } from "~/lib/utils/image-resize";

/**
 * Help & changes (SUPPORT_TICKETS_PLAN.md). Two sides of one thread:
 *  - `/help/*`          a customer workspace's own reports
 *  - `/root-support/*`  the root workspace's queue across every customer
 */

export type Severity = "urgent" | "normal" | "low";
export type TicketStatus = "open" | "waiting_on_client" | "resolved";
export type Side = "client" | "team";

export interface TicketWebsite {
  id: string;
  url: string;
  host: string;
}

export interface TicketAttachment {
  id: string;
  mime_type: string;
  size_bytes: number;
  file_name: string | null;
}

export type TicketEvent =
  | { type: "status"; from: TicketStatus; to: TicketStatus }
  | { type: "reopened"; from: TicketStatus; to: "open" }
  | { type: "severity"; from: Severity; to: Severity }
  | { type: "assignee"; from: string | null; to: string | null; to_name?: string | null }
  | { type: "email"; outbound_email_id: string };

/** An email sent from the ticket. Customers only get `to_emails` + `subject`. */
export interface TicketEmail {
  id: string;
  to_emails: string[];
  subject: string;
  cc_emails?: string[];
  from_email?: string | null;
  from_name?: string | null;
  html_body?: string | null;
  text_body?: string | null;
  sent_at?: string | null;
  synced?: boolean;
  error?: string | null;
}

export interface TicketMessage {
  id: string;
  side: Side;
  kind: "message" | "note" | "event";
  body: string;
  event: TicketEvent | null;
  created_at: string;
  author: { id: string | null; name: string | null; is_me: boolean };
  attachments: TicketAttachment[];
  email?: TicketEmail | null;
  /** Client-only: still on its way (optimistic). */
  pending?: boolean;
}

export interface TicketSummary {
  id: string;
  number: number;
  severity: Severity;
  status: TicketStatus;
  title: string;
  website: TicketWebsite | null;
  last_message_at: string;
  last_message_side: Side;
  last_message: { body: string; author_name: string | null; side: Side } | null;
  unread: boolean;
  created_at: string;
}

export interface TeamTicketSummary extends TicketSummary {
  client: { workspace_id: string; name: string };
  assigned_to: { id: string; name: string | null } | null;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  page_url: string | null;
  reopen_count: number;
  resolved_at: string | null;
  created_by: { id: string | null; name: string | null };
  messages: TicketMessage[];
}

export interface TeamTicketDetail extends TicketDetail {
  client: { workspace_id: string; name: string; owner_email: string | null };
  reporter: { id: string | null; name: string | null; email: string | null };
  assigned_to: { id: string; name: string | null } | null;
}

export const SEVERITIES: Severity[] = ["urgent", "normal", "low"];

const MULTIPART = { headers: { "Content-Type": "multipart/form-data" } };

/**
 * Multipart body: the screenshots, plus a small WebP preview of each made in
 * the browser (same as /media), so threads show a few KB instead of 5 MB.
 * `thumbs[i]` belongs to `files[i]`; a GIF or a preview that can't be made
 * gets an empty placeholder and the server serves the original instead.
 */
async function form(fields: Record<string, string | null | undefined>, files: File[]): Promise<FormData> {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v != null && v !== "") fd.append(k, v);
  const thumbs = await Promise.all(
    files.map((f) =>
      f.type === "image/gif"
        ? null
        : generateThumbnail(f, SHOT_THUMB_PX)
            .then((t) => (t.mimeType === "image/webp" ? t.blob : null))
            .catch(() => null),
    ),
  );
  files.forEach((f, i) => {
    fd.append("files", f, f.name || "screenshot.png");
    fd.append("thumbs", thumbs[i] ?? new Blob([], { type: "application/octet-stream" }), "thumb.webp");
  });
  return fd;
}

/** Long edge of a thread preview: crisp on a retina 112 px tile and as the lightbox blur-up. */
const SHOT_THUMB_PX = 480;

// ── customer side ───────────────────────────────────────────────────────────

export const helpKeys = {
  all: (ws: string | null | undefined) => ["help", ws ?? "none"] as const,
  websites: (ws: string | null | undefined) => ["help", ws ?? "none", "websites"] as const,
  list: (ws: string | null | undefined) => ["help", ws ?? "none", "list"] as const,
  ticket: (ws: string | null | undefined, id: string) => ["help", ws ?? "none", "ticket", id] as const,
};

export async function getHelpWebsites() {
  return (await apiClient.get<{ ready: boolean; websites: TicketWebsite[]; waiting: number }>("/help/websites")).data;
}
export async function listHelpTickets() {
  return (await apiClient.get<{ data: TicketSummary[] }>("/help/tickets")).data.data;
}
export async function createHelpTicket(input: {
  url_id: string | null;
  severity: Severity;
  description: string;
  page_url: string | null;
  files: File[];
}) {
  const fd = await form({ url_id: input.url_id, severity: input.severity, description: input.description, page_url: input.page_url }, input.files);
  return (await apiClient.post<TicketDetail>("/help/tickets", fd, MULTIPART)).data;
}
export async function getHelpTicket(id: string) {
  return (await apiClient.get<TicketDetail>(`/help/tickets/${id}`)).data;
}
export async function sendHelpMessage(id: string, body: string, files: File[]) {
  return (await apiClient.post<TicketDetail>(`/help/tickets/${id}/messages`, await form({ body }, files), MULTIPART)).data;
}
export async function setHelpTicketStatus(id: string, action: "resolve" | "reopen") {
  return (await apiClient.post<TicketDetail>(`/help/tickets/${id}/${action}`)).data;
}
export async function markHelpTicketRead(id: string) {
  await apiClient.post(`/help/tickets/${id}/read`);
}

// ── root queue ──────────────────────────────────────────────────────────────

export type QueueStatus = "open" | "waiting_on_client" | "resolved" | "all";
export interface QueueFilters {
  status: QueueStatus;
  workspace_id?: string;
  url_id?: string;
  severity?: Severity;
  assignee?: string;
  q?: string;
  sort: "severity" | "activity";
  page?: number;
}
export interface QueueCounts {
  ready: boolean;
  open: number;
  waiting_on_client: number;
  resolved: number;
  all: number;
  unread: number;
  mine_open: number;
}

export const queueKeys = {
  all: ["root-support"] as const,
  counts: ["root-support", "counts"] as const,
  filters: ["root-support", "filters"] as const,
  list: (f: QueueFilters) => ["root-support", "list", f] as const,
  ticket: (id: string) => ["root-support", "ticket", id] as const,
};

export async function getQueueCounts() {
  return (await apiClient.get<QueueCounts>("/root-support/tickets/counts")).data;
}
export async function getQueueFilters() {
  return (
    await apiClient.get<{
      clients: Array<{ workspace_id: string; name: string; count: number }>;
      websites: Array<{ id: string; host: string; workspace_id: string; count: number }>;
      team: Array<{ id: string; name: string | null }>;
    }>("/root-support/filters")
  ).data;
}
export async function listQueue(f: QueueFilters) {
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ""));
  return (await apiClient.get<{ data: TeamTicketSummary[]; total: number }>("/root-support/tickets", { params })).data;
}
export async function getQueueTicket(id: string) {
  return (await apiClient.get<TeamTicketDetail>(`/root-support/tickets/${id}`)).data;
}
export async function sendQueueMessage(id: string, input: { body: string; kind: "message" | "note"; then: "wait" | "resolve" | "keep"; files: File[] }) {
  return (
    await apiClient.post<TeamTicketDetail>(`/root-support/tickets/${id}/messages`, await form({ body: input.body, kind: input.kind, then: input.then }, input.files), MULTIPART)
  ).data;
}
export async function updateQueueTicket(id: string, patch: { status?: TicketStatus; severity?: Severity; assigned_to?: string | null }) {
  return (await apiClient.patch<TeamTicketDetail>(`/root-support/tickets/${id}`, patch)).data;
}
/** Find or create the reporter as a root contact, for the composer. */
export async function ensureTicketContact(id: string) {
  return (await apiClient.post<{ contactId: string; email: string; name: string | null }>(`/root-support/tickets/${id}/email-contact`)).data;
}
/** Show a just-sent email in the ticket thread. */
export async function attachTicketEmail(id: string, outboundEmailId: string) {
  return (await apiClient.post<TeamTicketDetail>(`/root-support/tickets/${id}/emails`, { outbound_email_id: outboundEmailId })).data;
}
export async function markQueueTicketRead(id: string) {
  await apiClient.post(`/root-support/tickets/${id}/read`);
}

/** Screenshots are private: fetched with the session, shown from a blob URL. */
export type ShotSize = "thumb" | "full";
export async function fetchAttachmentBlob(side: Side, id: string, size: ShotSize = "full"): Promise<Blob> {
  const path = side === "team" ? `/root-support/attachments/${id}` : `/help/attachments/${id}`;
  return (await apiClient.get<Blob>(path, { responseType: "blob", params: size === "thumb" ? { size } : undefined })).data;
}
