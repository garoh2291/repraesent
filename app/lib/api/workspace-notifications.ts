import { apiClient } from "./axios-instance";

/** Digest emails (Settings → Email notifications). Keys never change. */
export const DIGEST_KEYS = [
  "weekly_leads_digest",
  "daily_tasks_digest",
  "weekly_pipeline_summary",
  "stale_leads_reminder",
  "monthly_performance_report",
] as const;

export type DigestKey = (typeof DIGEST_KEYS)[number];
export type DigestAudience = "all_members" | "selected";

export interface DigestSetting {
  key: DigestKey;
  enabled: boolean;
  audience: DigestAudience;
  recipient_user_ids: string[];
  muted_by_me: boolean;
  schedule: { cadence: "daily" | "weekly" | "monthly"; weekdays: number[]; hour: number; minute: number };
}

export interface DigestMember {
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  /** Has signed in at least once — people who never did get no digests. */
  active: boolean;
}

export interface DigestSettings {
  can_edit: boolean;
  timezone: string | null;
  items: DigestSetting[];
  members: DigestMember[];
}

export interface DigestSettingInput {
  key: DigestKey;
  enabled: boolean;
  audience: DigestAudience;
  recipient_user_ids: string[];
}

export function digestSettingsKey(workspaceId: string | null | undefined) {
  return ["workspace-notifications", workspaceId ?? null] as const;
}

export async function getDigestSettings(): Promise<DigestSettings> {
  const { data } = await apiClient.get<DigestSettings>("/workspace-notifications");
  return data;
}

export async function updateDigestSettings(items: DigestSettingInput[], timezone?: string): Promise<DigestSettings> {
  const { data } = await apiClient.put<DigestSettings>("/workspace-notifications", { items, timezone });
  return data;
}

export async function muteDigest(key: DigestKey, muted: boolean): Promise<DigestSettings> {
  const { data } = await apiClient.put<DigestSettings>("/workspace-notifications/me", { key, muted });
  return data;
}

export async function sendDigestTest(key: DigestKey): Promise<{ sent: boolean; reason?: "empty" }> {
  const { data } = await apiClient.post<{ sent: boolean; reason?: "empty" }>(`/workspace-notifications/${key}/test`);
  return data;
}
