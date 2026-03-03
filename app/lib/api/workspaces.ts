import { apiClient } from "./axios-instance";
import { createApiError } from "./axios-instance";

export interface WorkspaceProductItem {
  product_id: string;
  product_name: string;
  product_image: string | null;
  product_slug: string | null;
}

export interface WorkspaceMemberItem {
  user_id: string;
  user_email: string;
  user_first_name: string;
  user_last_name: string;
  role: "admin" | "editor" | "viewer";
  lead_notification: boolean;
}

export interface WorkspaceUrlItem {
  id: string;
  url: string;
}

export interface WorkspaceDetail {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  url?: WorkspaceUrlItem | null;
  products?: WorkspaceProductItem[];
  members?: WorkspaceMemberItem[];
}

export async function getWorkspaceDetail(): Promise<WorkspaceDetail> {
  try {
    const res = await apiClient.get<WorkspaceDetail>("/users/me/workspace");
    return res.data;
  } catch (error) {
    const apiError = createApiError(error);
    if (apiError.status === 401 || apiError.status === 403) {
      throw error;
    }
    throw new Error(apiError.message || "Failed to fetch workspace details");
  }
}

export interface UpdateWorkspaceMemberData {
  role?: "admin" | "editor" | "viewer";
  lead_notification?: boolean;
}

export async function updateWorkspaceMember(
  userId: string,
  data: UpdateWorkspaceMemberData
): Promise<void> {
  await apiClient.patch(`/users/me/workspace/members/${userId}`, data);
}

export async function removeWorkspaceMember(userId: string): Promise<void> {
  await apiClient.delete(`/users/me/workspace/members/${userId}`);
}
