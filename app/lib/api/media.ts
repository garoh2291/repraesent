import { apiClient } from "./axios-instance";

/**
 * Workspace media library — images hosted on object storage, embedded in
 * emails by public URL. Upload is presign -> direct browser PUT -> confirm;
 * the PUTs go straight to the bucket with plain fetch (the axios instance
 * would inject Authorization/X-Workspace-Id and break the S3 signature).
 */

export interface MediaAsset {
  id: string;
  workspace_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  width: number | null;
  height: number | null;
  is_favorite: boolean;
  public_url: string;
  thumb_url: string;
  uploaded_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface PaginatedMediaAssets {
  data: MediaAsset[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PresignMediaUploadInput {
  filename: string;
  mime_type: string;
  size_bytes: number;
  thumb_size_bytes: number;
  width?: number;
  height?: number;
}

export interface PresignMediaUploadResponse {
  asset_id: string;
  upload_url: string;
  thumb_upload_url: string;
}

export const MEDIA_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;

export async function listMediaAssets(params: {
  page?: number;
  limit?: number;
  search?: string;
  favorites?: boolean;
}): Promise<PaginatedMediaAssets> {
  const { data } = await apiClient.get<PaginatedMediaAssets>("/media-library", {
    params,
  });
  return data;
}

export async function updateMediaAsset(
  assetId: string,
  input: { original_filename?: string; is_favorite?: boolean },
): Promise<MediaAsset> {
  const { data } = await apiClient.patch<MediaAsset>(
    `/media-library/${assetId}`,
    input,
  );
  return data;
}

export async function listMediaBin(params: {
  page?: number;
  limit?: number;
  search?: string;
}): Promise<PaginatedMediaAssets> {
  const { data } = await apiClient.get<PaginatedMediaAssets>(
    "/media-library/bin",
    { params },
  );
  return data;
}

export async function presignMediaUpload(
  input: PresignMediaUploadInput,
): Promise<PresignMediaUploadResponse> {
  const { data } = await apiClient.post<PresignMediaUploadResponse>(
    "/media-library/presign",
    input,
  );
  return data;
}

export async function confirmMediaUpload(assetId: string): Promise<MediaAsset> {
  const { data } = await apiClient.post<MediaAsset>(
    `/media-library/${assetId}/confirm`,
  );
  return data;
}

export async function deleteMediaAsset(assetId: string): Promise<void> {
  await apiClient.delete(`/media-library/${assetId}`);
}

export async function restoreMediaAsset(assetId: string): Promise<MediaAsset> {
  const { data } = await apiClient.post<MediaAsset>(
    `/media-library/${assetId}/restore`,
  );
  return data;
}

export async function hardDeleteMediaAsset(assetId: string): Promise<void> {
  await apiClient.delete(`/media-library/${assetId}/hard`);
}

export async function emptyMediaBin(): Promise<{ deleted: number }> {
  const { data } = await apiClient.post<{ deleted: number }>(
    "/media-library/bin/empty",
  );
  return data;
}

/** Direct-to-bucket PUT. Headers must match what the presign signed. */
export async function putToBucket(
  uploadUrl: string,
  body: Blob,
  mimeType: string,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
      "x-amz-acl": "public-read",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`Upload to storage failed (HTTP ${res.status})`);
  }
}
