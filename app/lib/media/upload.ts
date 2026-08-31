import {
  MEDIA_ALLOWED_TYPES,
  MEDIA_MAX_BYTES,
  confirmMediaUpload,
  presignMediaUpload,
  putToBucket,
  type MediaAsset,
} from "~/lib/api/media";
import { generateThumbnail } from "~/lib/utils/image-resize";

/**
 * Media-library upload pipeline, one file at a time:
 * validate (type, size, magic bytes) → thumbnail in the browser → presign →
 * two direct-to-bucket PUTs → confirm (the server re-verifies everything).
 */

export type MediaUploadStage =
  | "validating"
  | "processing"
  | "uploading"
  | "confirming";

export class MediaUploadError extends Error {}

/** First-bytes signatures, mirroring the server's confirm-time check. */
function magicBytesMatch(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case "image/jpeg":
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/png":
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );
    case "image/gif":
      return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    case "image/webp":
      return (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

export async function uploadMediaFile(
  file: File,
  onStage?: (stage: MediaUploadStage) => void,
): Promise<MediaAsset> {
  onStage?.("validating");

  if (!MEDIA_ALLOWED_TYPES.includes(file.type)) {
    throw new MediaUploadError(
      "Only JPEG, PNG, GIF and WebP images can be uploaded.",
    );
  }
  if (file.size > MEDIA_MAX_BYTES) {
    throw new MediaUploadError("Images can be at most 10 MB.");
  }

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (head.length < 12 || !magicBytesMatch(head, file.type)) {
    throw new MediaUploadError(
      "That file's content does not match its image type.",
    );
  }

  onStage?.("processing");
  const thumb = await generateThumbnail(file);

  const presigned = await presignMediaUpload({
    filename: file.name,
    mime_type: file.type,
    size_bytes: file.size,
    thumb_size_bytes: thumb.blob.size,
    width: thumb.originalWidth,
    height: thumb.originalHeight,
  });

  onStage?.("uploading");
  await Promise.all([
    putToBucket(presigned.upload_url, file, file.type),
    putToBucket(presigned.thumb_upload_url, thumb.blob, thumb.mimeType),
  ]);

  onStage?.("confirming");
  return confirmMediaUpload(presigned.asset_id);
}
