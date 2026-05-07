import { apiClient } from "./axios-instance";

const BASE = "/onboarding/doorboost";

export interface DoorboostEligibility {
  eligible: boolean;
  retailer?: { id: string; name: string };
  doorboost_user_id?: string;
  hint?: { firstName?: string | null; lastName?: string | null };
}

export interface CampaignPreview {
  campaign_id: string;
  campaign_name: string | null;
  campaign_status: string | null;
  account_id: string;
  account_name: string | null;
  platform: string;
  budget_daily: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface LeadPreview {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  platform: string;
  status: string;
  platform_campaign_id: string;
}

export interface DoorboostUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export interface RetailerCounts {
  campaigns: number;
  leads: number;
  users: number;
}

export type FallbackNoteUser =
  | { type: "existing"; user_id: string }
  | { type: "new"; first_name: string; last_name: string; email: string };

export interface RestoreSubmitPayload {
  workspace_name: string;
  retailer_id: string;
  campaigns: boolean;
  leads: boolean;
  users: string[];
  notify_users?: boolean;
  fallback_note_user?: FallbackNoteUser;
}

export async function getDoorboostEligibility(): Promise<DoorboostEligibility> {
  const r = await apiClient.get<DoorboostEligibility>(`${BASE}/eligibility`);
  return r.data;
}

export async function dismissDoorboostEligibility(): Promise<void> {
  await apiClient.post(`${BASE}/eligibility/dismiss`);
}

export async function previewCounts(
  retailerId: string,
): Promise<RetailerCounts> {
  const r = await apiClient.get<RetailerCounts>(`${BASE}/preview/counts`, {
    params: { retailer_id: retailerId },
  });
  return r.data;
}

export async function previewCampaigns(
  retailerId: string,
): Promise<CampaignPreview[]> {
  const r = await apiClient.get<CampaignPreview[]>(`${BASE}/preview/campaigns`, {
    params: { retailer_id: retailerId },
  });
  return r.data;
}

export async function previewLeads(
  retailerId: string,
): Promise<{ leads: LeadPreview[]; total: number }> {
  const r = await apiClient.get<{ leads: LeadPreview[]; total: number }>(
    `${BASE}/preview/leads`,
    { params: { retailer_id: retailerId } },
  );
  return r.data;
}

export async function previewUsers(
  retailerId: string,
  excludeEmail?: string,
): Promise<DoorboostUser[]> {
  const r = await apiClient.get<DoorboostUser[]>(`${BASE}/preview/users`, {
    params: {
      retailer_id: retailerId,
      ...(excludeEmail ? { exclude_email: excludeEmail } : {}),
    },
  });
  return r.data;
}

export async function submitDoorboostRestore(
  payload: RestoreSubmitPayload,
): Promise<{ workspace_id: string }> {
  const r = await apiClient.post<{ workspace_id: string }>(
    `${BASE}/submit`,
    payload,
  );
  return r.data;
}
