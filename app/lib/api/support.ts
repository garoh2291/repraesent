import { apiClient } from "./axios-instance";
import type { SalesHost } from "./root-onboarding";

/** Root Settings → Support: who sees "Contact re:praesent", and who answers. */
export interface SupportHost extends Partial<SalesHost> {
  userId: string;
}

export interface SupportWorkspaceRow {
  id: string;
  name: string;
  status: string;
  owner_email: string | null;
  created_at: string;
  support: { enabled: boolean; host: SupportHost | null };
}

export async function listSupportWorkspaces(params: { search?: string; filter?: "all" | "on" | "off"; page?: number; limit?: number }) {
  return (await apiClient.get<{ data: SupportWorkspaceRow[]; total: number }>("/root-onboarding/support", { params })).data;
}

export async function setSupportContact(workspaceId: string, body: { enabled: boolean; host: SupportHost | null }) {
  return (await apiClient.put<{ enabled: boolean; host: SupportHost | null }>(`/root-onboarding/support/${workspaceId}`, body)).data;
}
