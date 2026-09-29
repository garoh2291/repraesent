import { apiClient } from "./axios-instance";

/** Team-only photos on a deal or contact (MOBILE_PACKAGE_PLAN.md C3). */
export type PhotoEntity = "deals" | "contacts";

export interface Photo {
  id: string;
  media_asset_id: string;
  url: string;
  thumb_url: string | null;
  caption: string | null;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
}

export interface PhotoList {
  /** False until the database has the photos table: the strip stays hidden. */
  ready: boolean;
  items: Photo[];
}

export async function listPhotos(entity: PhotoEntity, id: string): Promise<PhotoList> {
  const { data } = await apiClient.get<PhotoList>(`/${entity}/${id}/photos`);
  return data;
}

export async function addPhoto(
  entity: PhotoEntity,
  id: string,
  body: { media_asset_id: string; caption?: string },
): Promise<Photo> {
  const { data } = await apiClient.post<Photo>(`/${entity}/${id}/photos`, body);
  return data;
}

export async function updatePhotoCaption(photoId: string, caption: string | null): Promise<Photo> {
  const { data } = await apiClient.patch<Photo>(`/entity-photos/${photoId}`, { caption });
  return data;
}

export async function deletePhoto(photoId: string): Promise<void> {
  await apiClient.delete(`/entity-photos/${photoId}`);
}

export async function restorePhoto(photoId: string): Promise<Photo> {
  const { data } = await apiClient.post<Photo>(`/entity-photos/${photoId}/restore`);
  return data;
}
