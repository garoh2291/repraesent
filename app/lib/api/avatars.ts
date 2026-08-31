import { apiClient } from "./axios-instance";

/**
 * Profile pictures for the current user and the current workspace.
 * Multipart through the API (client-cropped ≤2MB image) — deliberately not
 * the media-library presign flow: avatars are not library assets and must
 * never appear there. The backend hard-deletes the replaced object.
 */

export async function uploadMyAvatar(
  file: File,
  thumb?: File | Blob,
): Promise<{ avatar_url: string; avatar_thumb_url?: string }> {
  const form = new FormData();
  form.append("file", file);
  if (thumb) form.append("thumb", thumb, "thumb.webp");
  const { data } = await apiClient.post<{ avatar_url: string }>(
    "/users/me/avatar",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function deleteMyAvatar(): Promise<void> {
  await apiClient.delete("/users/me/avatar");
}

export async function uploadWorkspaceAvatar(
  file: File,
  thumb?: File | Blob,
): Promise<{ avatar_url: string; avatar_thumb_url?: string }> {
  const form = new FormData();
  form.append("file", file);
  if (thumb) form.append("thumb", thumb, "thumb.webp");
  const { data } = await apiClient.post<{ avatar_url: string }>(
    "/users/me/workspace/avatar",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function deleteWorkspaceAvatar(): Promise<void> {
  await apiClient.delete("/users/me/workspace/avatar");
}

export async function uploadContactAvatar(
  contactId: string,
  file: File,
  thumb?: File | Blob,
): Promise<{ avatar_url: string; avatar_thumb_url?: string }> {
  const form = new FormData();
  form.append("file", file);
  if (thumb) form.append("thumb", thumb, "thumb.webp");
  const { data } = await apiClient.post<{ avatar_url: string }>(
    `/contacts/${contactId}/avatar`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function deleteContactAvatar(contactId: string): Promise<void> {
  await apiClient.delete(`/contacts/${contactId}/avatar`);
}
