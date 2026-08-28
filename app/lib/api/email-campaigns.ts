import { apiClient } from "./axios-instance";
import type { SendWindow } from "./workflows";

/**
 * Email campaigns — mirror of nestjs-monolith/src/modules/email-campaigns.
 */

export type CampaignStatus =
  "draft" | "scheduled" | "sending" | "paused" | "sent" | "cancelled";

export type CampaignSendStatus =
  "pending" | "sending" | "sent" | "failed" | "skipped" | "cancelled";

export interface CampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  segment_id: string | null;
  segment_name: string | null;
  template_id: string | null;
  template_name: string | null;
  template_version_id: string | null;
  email_account_id: string | null;
  email_account_email: string | null;
  from_name: string | null;
  reply_to: string | null;
  scheduled_at: string | null;
  timezone: string | null;
  send_window: SendWindow | null;
  max_per_hour: number | null;
  audience_matched_count: number | null;
  audience_sendable_count: number | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  open_count: number;
  unique_open_count: number;
  click_count: number;
  unique_click_count: number;
  unsubscribe_count: number;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignSendRow {
  id: string;
  contact_id: string | null;
  to_email: string;
  locale: string;
  status: CampaignSendStatus;
  attempt_count: number;
  skip_reason: string | null;
  last_error: string | null;
  send_error: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
}

export interface CampaignStats {
  campaign: CampaignSummary;
  series: {
    bucket: string;
    type: "open" | "click" | "unsubscribe";
    count: number;
  }[];
  links: { id: string; url: string; click_count: number }[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export async function listCampaigns(params: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}): Promise<Paginated<CampaignSummary>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  if (params.search) query.set("search", params.search);
  const { data } = await apiClient.get(`/email-campaigns?${query}`);
  return data;
}

export async function getCampaign(id: string): Promise<CampaignSummary> {
  const { data } = await apiClient.get(`/email-campaigns/${id}`);
  return data;
}

export async function createCampaign(payload: {
  name: string;
  segment_id?: string;
  template_id?: string;
  email_account_id?: string;
}): Promise<CampaignSummary> {
  const { data } = await apiClient.post("/email-campaigns", payload);
  return data;
}

export async function updateCampaign(
  id: string,
  payload: {
    name?: string;
    segment_id?: string | null;
    template_id?: string | null;
    email_account_id?: string | null;
    from_name?: string | null;
    reply_to?: string | null;
    timezone?: string;
    send_window?: SendWindow | null;
    max_per_hour?: number | null;
  },
): Promise<CampaignSummary> {
  const { data } = await apiClient.patch(`/email-campaigns/${id}`, payload);
  return data;
}

export async function scheduleCampaign(
  id: string,
  scheduledAt: string | null,
  /**
   * IANA zone the schedule was expressed in. `scheduledAt` is already absolute,
   * so this does not move the send — the send-window hour-of-day maths runs in
   * it, and it is how the campaign is shown back in the zone it was set for.
   */
  timezone?: string,
): Promise<CampaignSummary> {
  const { data } = await apiClient.post(`/email-campaigns/${id}/schedule`, {
    scheduled_at: scheduledAt,
    ...(timezone ? { timezone } : {}),
  });
  return data;
}

export async function cancelCampaign(id: string): Promise<CampaignSummary> {
  const { data } = await apiClient.post(`/email-campaigns/${id}/cancel`);
  return data;
}

export async function resumeCampaign(id: string): Promise<CampaignSummary> {
  const { data } = await apiClient.post(`/email-campaigns/${id}/resume`);
  return data;
}

export async function testSendCampaign(
  id: string,
  payload: { to: string; locale?: string; contact_id?: string },
): Promise<{ sent: true }> {
  const { data } = await apiClient.post(
    `/email-campaigns/${id}/test-send`,
    payload,
  );
  return data;
}

export async function deleteCampaign(id: string): Promise<void> {
  await apiClient.delete(`/email-campaigns/${id}`);
}

export async function listCampaignSends(
  id: string,
  params: { page?: number; limit?: number; status?: string },
): Promise<Paginated<CampaignSendRow>> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.status) query.set("status", params.status);
  const { data } = await apiClient.get(`/email-campaigns/${id}/sends?${query}`);
  return data;
}

export async function getCampaignStats(id: string): Promise<CampaignStats> {
  const { data } = await apiClient.get(`/email-campaigns/${id}/stats`);
  return data;
}
