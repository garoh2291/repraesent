import { apiClient } from "./axios-instance";
import type { EnrichmentJob, FieldSource, ProfileData } from "./onboarding-v2";

/** Settings → Business profile. */
export interface WorkspaceProfileView {
  profile: {
    workspace_id: string;
    data: ProfileData;
    field_sources: Record<string, FieldSource>;
    completed_at: string | null;
    updated_at: string | null;
  };
  website: string | null;
  website_job: EnrichmentJob | null;
  can_edit: boolean;
}

export function workspaceProfileKey(workspaceId: string | null | undefined) {
  return ["workspace-profile", workspaceId ?? null] as const;
}

export async function getWorkspaceProfile(): Promise<WorkspaceProfileView> {
  const { data } = await apiClient.get<WorkspaceProfileView>("/workspace-profile");
  return data;
}

export async function saveWorkspaceProfile(profile: ProfileData, confirmPaths: string[]): Promise<WorkspaceProfileView> {
  const { data } = await apiClient.put<WorkspaceProfileView>("/workspace-profile", { profile, confirm_paths: confirmPaths });
  return data;
}

export async function addWorkspaceWebsite(website: string): Promise<WorkspaceProfileView> {
  const { data } = await apiClient.post<WorkspaceProfileView>("/workspace-profile/website", { website });
  return data;
}

export async function rereadWorkspaceWebsite(): Promise<{ job_id: string }> {
  const { data } = await apiClient.post<{ job_id: string }>("/workspace-profile/enrich/website");
  return data;
}

export async function getWorkspaceProfileJob(jobId: string): Promise<{ job: EnrichmentJob; profile: WorkspaceProfileView["profile"] }> {
  const { data } = await apiClient.get<{ job: EnrichmentJob; profile: WorkspaceProfileView["profile"] }>(`/workspace-profile/enrich/${jobId}`);
  return data;
}
