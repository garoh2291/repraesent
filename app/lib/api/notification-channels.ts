import { apiClient } from "./axios-instance";

export const NOTIFICATION_EVENTS = [
  "new_lead",
  "deal_stage_changed",
  "form_submission",
  "appointment_booked",
] as const;

export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];
export type NotificationProvider = "slack" | "teams";

/** One card on Settings → Notifications. */
export interface NotificationChannel {
  id: string;
  provider: NotificationProvider;
  name: string;
  /** scheme + host + last 4 chars; the API never returns the real URL. */
  webhook_url_masked: string;
  events: NotificationEvent[];
  is_active: boolean;
  last_error: string | null;
  failure_count: number;
  last_success_at: string | null;
  created_at: string;
}

export interface CreateNotificationChannelBody {
  provider: NotificationProvider;
  name: string;
  webhook_url: string;
  events: NotificationEvent[];
  is_active?: boolean;
}

export interface UpdateNotificationChannelBody {
  name?: string;
  webhook_url?: string;
  events?: NotificationEvent[];
  is_active?: boolean;
}

export async function listNotificationChannels(): Promise<
  NotificationChannel[]
> {
  const res = await apiClient.get<NotificationChannel[]>(
    "/notification-channels",
  );
  return res.data;
}

export async function createNotificationChannel(
  body: CreateNotificationChannelBody,
): Promise<NotificationChannel> {
  const res = await apiClient.post<NotificationChannel>(
    "/notification-channels",
    body,
  );
  return res.data;
}

export async function updateNotificationChannel(
  id: string,
  body: UpdateNotificationChannelBody,
): Promise<NotificationChannel> {
  const res = await apiClient.patch<NotificationChannel>(
    `/notification-channels/${encodeURIComponent(id)}`,
    body,
  );
  return res.data;
}

export async function deleteNotificationChannel(id: string): Promise<void> {
  await apiClient.delete(`/notification-channels/${encodeURIComponent(id)}`);
}

export async function testNotificationChannel(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await apiClient.post<{ ok: boolean; error?: string }>(
    `/notification-channels/${encodeURIComponent(id)}/test`,
  );
  return res.data;
}
