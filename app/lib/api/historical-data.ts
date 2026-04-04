import { apiClient } from "./axios-instance";

export interface HistoricalDataRecord {
  id: string;
  workspace_id: string;
  status: string;
  error_reason: string | null;
  metadata: {
    leads: boolean;
    campaigns: boolean;
    users: string[];
  };
  created_at: string;
  created_by: string | null;
  finished_at: string | null;
  updated_at: string;
  user_click_notified: boolean;
}

export interface CampaignPreview {
  campaign_id: string;
  campaign_name: string | null;
  campaign_status: string | null;
  account_id: string;
  account_name: string | null;
  platform: string;
  budget_daily: string | null;
  advertising_channel_type: string | null;
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

export async function getHistoricalData(): Promise<HistoricalDataRecord | null> {
  const res = await apiClient.get<HistoricalDataRecord | null>(
    "/users/me/workspace/historical-data",
  );
  return res.data;
}

export async function createHistoricalData(
  status: "not_ready" | "ignored",
): Promise<HistoricalDataRecord> {
  const res = await apiClient.post<HistoricalDataRecord>(
    "/users/me/workspace/historical-data",
    { status },
  );
  return res.data;
}

export async function updateHistoricalData(data: {
  metadata: {
    leads: boolean;
    campaigns: boolean;
    users: string[];
    notify_users?: boolean;
  };
}): Promise<HistoricalDataRecord> {
  const res = await apiClient.patch<HistoricalDataRecord>(
    "/users/me/workspace/historical-data",
    data,
  );
  return res.data;
}

export async function getHistoricalCampaigns(): Promise<CampaignPreview[]> {
  const res = await apiClient.get<CampaignPreview[]>(
    "/users/me/workspace/historical-data/campaigns",
  );
  return res.data;
}

export async function getHistoricalLeadsPreview(): Promise<{
  leads: LeadPreview[];
  total: number;
}> {
  const res = await apiClient.get<{ leads: LeadPreview[]; total: number }>(
    "/users/me/workspace/historical-data/leads-preview",
  );
  return res.data;
}

export async function getHistoricalUsers(): Promise<DoorboostUser[]> {
  const res = await apiClient.get<DoorboostUser[]>(
    "/users/me/workspace/historical-data/users",
  );
  return res.data;
}

export async function markHistoricalDataNotified(): Promise<HistoricalDataRecord> {
  const res = await apiClient.post<HistoricalDataRecord>(
    "/users/me/workspace/historical-data/mark-notified",
  );
  return res.data;
}
