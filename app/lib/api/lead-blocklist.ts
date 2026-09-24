import { apiClient } from "./axios-instance";

/** Senders marked as spam: their leads go straight to Hidden. */
export interface LeadBlocklistEntry {
  id: string;
  kind: "email" | "phone" | "domain";
  /** email lower-cased · phone digits with country code · domain without @ */
  value: string;
  source_lead_id: string | null;
  reason: string | null;
  hits: number;
  last_hit_at: string | null;
  created_at: string;
}

export async function listLeadBlocklist(): Promise<LeadBlocklistEntry[]> {
  return (await apiClient.get<LeadBlocklistEntry[]>("/lead-blocklist")).data;
}

export async function addLeadBlocklistEntry(pattern: string): Promise<LeadBlocklistEntry[]> {
  return (await apiClient.post<LeadBlocklistEntry[]>("/lead-blocklist", { pattern })).data;
}

export async function deleteLeadBlocklistEntry(id: string): Promise<LeadBlocklistEntry[]> {
  return (await apiClient.delete<LeadBlocklistEntry[]>(`/lead-blocklist/${encodeURIComponent(id)}`)).data;
}
