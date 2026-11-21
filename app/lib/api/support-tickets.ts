import { apiClient } from "./axios-instance";
import { generateThumbnail } from "~/lib/utils/image-resize";

/**
 * Help & changes (SUPPORT_TICKETS_PLAN.md). Two sides of one thread:
 *  - `/help/*`          a customer workspace's own reports
 *  - `/root-support/*`  the root workspace's queue across every customer
 *  - `/agency-support/*` an agency's queue for its businesses (AGENCY_MODE_PLAN.md §7)
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
  | { type: "email"; outbound_email_id: string }
  /** The agency passed this report on to re:praesent (the agency's team only). */
  | { type: "passed_on"; ticket_id: string; number: number; client_visible: boolean }
  /** The report moved queues (agency detached or suspended): re:praesent answers from now on. */
  | { type: "queue"; from: string | null; to: string | null }
  /** The report passed on to re:praesent was finished / opened again, and this one followed. */
  | { type: "linked_done"; ticket_id: string; number: number }
  | { type: "linked_reopened"; ticket_id: string; number: number }
  /** Set-up report: every set-up item is done (the website went live, or re:praesent closed them). */
  | { type: "setup_done" }
  /** Set-up report, re:praesent only: the deal moved because the report did. */
  | { type: "deal_moved"; deal_id: string; to: "won" | "open" };

export type TicketKind = "report" | "setup";

/** One thing an agency asked re:praesent to set up for a new business. */
export interface SetupReportItem {
  id: string;
  kind: "website" | "email" | "domain" | "other";
  label: string | null;
  note: string | null;
  status: "requested" | "in_progress" | "done" | "cancelled";
  closed_at: string | null;
}

export interface SetupReport {
  business: { workspace_id: string; name: string };
  items: SetupReportItem[];
  /** An open website item and no site linked yet. */
  website_unlinked: boolean;
  /** re:praesent only: its deal for this business. */
  deal?: { id: string; title: string; status: "new" | "won" | "lost" } | null;
}

/** A report passed on from this one. */
export interface LinkedTicket {
  id: string;
  number: number;
  status: TicketStatus;
  client_visible: boolean;
}

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
  /** The workspace a client-side author wrote for, when it isn't the viewer's (an agency on a shared report). */
  party?: string | null;
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
  /** Who answers: the agency's name; null/absent = re:praesent. */
  team_name?: string | null;
  /** The agency that opened this report about your business and shared it with you. */
  shared_by?: string | null;
  /** The newest report passed on from this one to re:praesent. */
  passed_on?: LinkedTicket | null;
  /** "setup" = an agency's set-up request for a new business. */
  kind?: TicketKind;
}

export interface TeamTicketSummary extends TicketSummary {
  client: { workspace_id: string; name: string };
  /** An agency's report: the business it is about. */
  about?: { workspace_id: string; name: string } | null;
  assigned_to: { id: string; name: string | null } | null;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  page_url: string | null;
  reopen_count: number;
  resolved_at: string | null;
  created_by: { id: string | null; name: string | null };
  messages: TicketMessage[];
  /** false on a report your agency shared with you: read and reply only. */
  may_change_status?: boolean;
  /** Reports passed on from this one (client: `client_visible` = you may open it). */
  linked?: LinkedTicket[];
  /** Client: your own report this one was passed on from. */
  source?: { id: string; number: number } | null;
  kind?: TicketKind;
  /** Set-up reports: what was asked and where it stands. */
  setup?: SetupReport | null;
}

export interface TeamTicketDetail extends TicketDetail {
  client: { workspace_id: string; name: string; owner_email: string | null };
  reporter: { id: string | null; name: string | null; email: string | null };
  assigned_to: { id: string; name: string | null } | null;
  about?: { workspace_id: string; name: string } | null;
  client_visible?: boolean;
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
  /** An agency's own report: the business it is about, and whether that business may read + reply. */
  about_workspace_id?: string | null;
  client_visible?: boolean;
}) {
  const fd = await form(
    {
      url_id: input.url_id,
      severity: input.severity,
      description: input.description,
      page_url: input.page_url,
      about_workspace_id: input.about_workspace_id,
      client_visible: input.about_workspace_id && input.client_visible ? "true" : null,
    },
    input.files,
  );
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

// ── support queue (root or agency) ──────────────────────────────────────────

/** Which queue: re:praesent's own (root workspace) or an agency's. */
export type QueueBase = "root-support" | "agency-support";

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
  all: (b: QueueBase) => [b] as const,
  counts: (b: QueueBase) => [b, "counts"] as const,
  filters: (b: QueueBase) => [b, "filters"] as const,
  lists: (b: QueueBase) => [b, "list"] as const,
  list: (b: QueueBase, f: QueueFilters) => [b, "list", f] as const,
  ticket: (b: QueueBase, id: string) => [b, "ticket", id] as const,
};

export async function getQueueCounts(b: QueueBase) {
  return (await apiClient.get<QueueCounts>(`/${b}/tickets/counts`)).data;
}
export async function getQueueFilters(b: QueueBase) {
  return (
    await apiClient.get<{
      clients: Array<{ workspace_id: string; name: string; count: number }>;
      websites: Array<{ id: string; host: string; workspace_id: string; count: number }>;
      team: Array<{ id: string; name: string | null }>;
    }>(`/${b}/filters`)
  ).data;
}
export async function listQueue(b: QueueBase, f: QueueFilters) {
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== undefined && v !== ""));
  return (await apiClient.get<{ data: TeamTicketSummary[]; total: number }>(`/${b}/tickets`, { params })).data;
}
export async function getQueueTicket(b: QueueBase, id: string) {
  return (await apiClient.get<TeamTicketDetail>(`/${b}/tickets/${id}`)).data;
}
export async function sendQueueMessage(
  b: QueueBase,
  id: string,
  input: { body: string; kind: "message" | "note"; then: "wait" | "resolve" | "keep"; files: File[]; close_website?: boolean },
) {
  return (
    await apiClient.post<TeamTicketDetail>(
      `/${b}/tickets/${id}/messages`,
      await form({ body: input.body, kind: input.kind, then: input.then, close_website: input.close_website ? "true" : null }, input.files),
      MULTIPART,
    )
  ).data;
}
export async function updateQueueTicket(
  b: QueueBase,
  id: string,
  patch: { status?: TicketStatus; severity?: Severity; assigned_to?: string | null; close_website?: boolean },
) {
  return (await apiClient.patch<TeamTicketDetail>(`/${b}/tickets/${id}`, patch)).data;
}
/** Agency: pass a business's report on to re:praesent as a new, linked report. */
export async function escalateQueueTicket(
  id: string,
  input: { description: string; severity: Severity; client_visible: boolean; attachment_ids: string[] },
) {
  return (await apiClient.post<{ id: string; number: number }>(`/agency-support/tickets/${id}/escalate`, input)).data;
}
/** Root only: the reports that belong to a re:praesent deal (set-up reports), for the deal page. */
export interface DealTicket {
  id: string;
  number: number;
  status: TicketStatus;
  kind: TicketKind;
  title: string;
  business: string | null;
}
export async function listDealTickets(dealId: string) {
  return (await apiClient.get<{ data: DealTicket[] }>(`/root-support/deals/${dealId}/tickets`)).data.data;
}
/** Resolving a set-up report whose website isn't linked yet asks first (409 with this code). */
export const SETUP_WEBSITE_OPEN = "SETUP_WEBSITE_OPEN";

/** Root only: find or create the reporter as a root contact, for the composer. */
export async function ensureTicketContact(id: string) {
  return (await apiClient.post<{ contactId: string; email: string; name: string | null }>(`/root-support/tickets/${id}/email-contact`)).data;
}
/** Root only: show a just-sent email in the ticket thread. */
export async function attachTicketEmail(id: string, outboundEmailId: string) {
  return (await apiClient.post<TeamTicketDetail>(`/root-support/tickets/${id}/emails`, { outbound_email_id: outboundEmailId })).data;
}
export async function markQueueTicketRead(b: QueueBase, id: string) {
  await apiClient.post(`/${b}/tickets/${id}/read`);
}

/** Screenshots are private: fetched with the session, shown from a blob URL. */
export type ShotSize = "thumb" | "full";
export async function fetchAttachmentBlob(side: Side, id: string, size: ShotSize = "full", base: QueueBase = "root-support"): Promise<Blob> {
  const path = side === "team" ? `/${base}/attachments/${id}` : `/help/attachments/${id}`;
  return (await apiClient.get<Blob>(path, { responseType: "blob", params: size === "thumb" ? { size } : undefined })).data;
}
