import { apiClient } from "./axios-instance";

/**
 * Phone alerts (Web Push) — PWA_PUSH_PLAN.md "API contract".
 *
 * Everything here is per *user*, not per workspace: one person's phone gets
 * alerts from every workspace they belong to. Query keys still carry the user
 * id so a sign-in as someone else never paints the previous person's phones.
 */

export type PushPlatform = "ios" | "android" | "desktop" | "other";

export interface PhoneAlertsConfig {
  /** False when the server has no VAPID keys or the feature is switched off. */
  enabled: boolean;
  public_key: string | null;
}

export interface PhoneAlertPreferences {
  new_inquiry: boolean;
  morning_summary: boolean;
  task_due: boolean;
  show_names: boolean;
  /** ISO weekdays, 1 = Monday … 7 = Sunday. */
  active_days: number[];
  /** "HH:MM" */
  active_start: string;
  /** "HH:MM" */
  active_end: string;
  timezone: string | null;
}

export interface PhoneAlertDevice {
  id: string;
  platform: PushPlatform;
  /** Short name worked out from the user agent, e.g. "iPhone · Safari". */
  label: string | null;
  endpoint: string;
  created_at: string;
  last_seen_at: string | null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  platform: PushPlatform;
  timezone?: string;
  /**
   * The owner turned alerts on here on purpose. Without it, a phone removed
   * under "Your phones" is not brought back by the silent re-sync on app
   * open — the server answers 410 DEVICE_REMOVED instead.
   */
  reenable?: boolean;
}

export const phoneAlertsKeys = {
  all: ["phone-alerts"] as const,
  config: () => ["phone-alerts", "config"] as const,
  preferences: (userId: string | null | undefined) =>
    ["phone-alerts", "preferences", userId ?? null] as const,
  devices: (userId: string | null | undefined) =>
    ["phone-alerts", "devices", userId ?? null] as const,
};

export async function getPhoneAlertsConfig(): Promise<PhoneAlertsConfig> {
  const { data } = await apiClient.get<PhoneAlertsConfig>("/phone-alerts/config");
  return data;
}

export async function savePushSubscription(input: PushSubscriptionInput): Promise<{ id: string }> {
  const { data } = await apiClient.post<{ id: string }>("/phone-alerts/subscriptions", input);
  return data;
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await apiClient.delete("/phone-alerts/subscriptions", { data: { endpoint } });
}

export async function getPhoneAlertPreferences(): Promise<PhoneAlertPreferences> {
  const { data } = await apiClient.get<PhoneAlertPreferences>("/phone-alerts/preferences");
  return data;
}

export async function updatePhoneAlertPreferences(
  patch: Partial<PhoneAlertPreferences>,
): Promise<PhoneAlertPreferences> {
  const { data } = await apiClient.put<PhoneAlertPreferences>("/phone-alerts/preferences", patch);
  return data;
}

export async function getPhoneAlertDevices(): Promise<PhoneAlertDevice[]> {
  const { data } = await apiClient.get<PhoneAlertDevice[]>("/phone-alerts/devices");
  return Array.isArray(data) ? data : [];
}

export async function deletePhoneAlertDevice(id: string): Promise<void> {
  await apiClient.delete(`/phone-alerts/devices/${encodeURIComponent(id)}`);
}

/** Sends "This is how alerts look" to one device (by endpoint) or to all. */
export async function sendPhoneAlertTest(endpoint?: string): Promise<{ sent: number }> {
  const { data } = await apiClient.post<{ sent: number }>("/phone-alerts/test", endpoint ? { endpoint } : {});
  return data;
}
