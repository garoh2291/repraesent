import { apiClient } from "./axios-instance";

/**
 * Addresses and domains this workspace always accepts.
 *
 * The spam filter answers for strangers. Three automatic layers decide, a
 * fourth checks whether the workspace already knows the sender, and this is
 * what a human writes down when all four still get it wrong.
 */
export interface LeadAllowlistEntry {
  id: string;
  /** `ada@example.com` or `@example.com`. Stored lower-case. */
  pattern: string;
  note: string | null;
  created_at: string;
}

export async function listLeadAllowlist(): Promise<LeadAllowlistEntry[]> {
  const res = await apiClient.get<LeadAllowlistEntry[]>("/lead-allowlist");
  return res.data;
}

export async function createLeadAllowlistEntry(body: {
  pattern: string;
  note?: string;
}): Promise<LeadAllowlistEntry> {
  const res = await apiClient.post<LeadAllowlistEntry>("/lead-allowlist", body);
  return res.data;
}

export async function deleteLeadAllowlistEntry(id: string): Promise<void> {
  await apiClient.delete(`/lead-allowlist/${encodeURIComponent(id)}`);
}
