/**
 * Downscale an image in the browser and return it as a base64 data URI.
 *
 * The first image handling in this app — there is no FileReader or canvas code
 * anywhere else — so it lives here rather than inside the signature editor.
 *
 * The point of the presets is that they resize the actual PIXELS. Setting a
 * `width` attribute on a 3000px logo makes it *look* right while still shipping
 * three megabytes of base64 in every email; drawing it to a 240px canvas first
 * is what keeps the payload honest.
 */

export type ImageSizePreset = "xsmall" | "small" | "medium" | "large";

/**
 * Rendered width in a signature.
 *
 * `xsmall` is for the things a logo preset makes too big — a social icon, a
 * small badge, a certification mark sitting inline with the text.
 */
export const IMAGE_PRESET_WIDTH: Record<ImageSizePreset, number> = {
  xsmall: 64,
  small: 120,
  medium: 240,
  large: 480,
};

export const ACCEPTED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

/** Matches the backend's MAX_SIGNATURE_IMAGE_BYTES. */
export const MAX_IMAGE_BYTES = 512_000;

export interface ResizedImage {
  dataUrl: string;
  width: number;
  height: number;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file is not a readable image."));
    img.src = src;
  });
}

/** Rough byte count of a data URI's payload, without decoding it. */
export function dataUrlBytes(dataUrl: string): number {
  const payload = dataUrl.slice(dataUrl.indexOf(",") + 1);
  return Math.ceil((payload.length * 3) / 4);
}

export async function resizeImageFile(
  file: File,
  preset: ImageSizePreset,
): Promise<ResizedImage> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Use a PNG, JPEG, GIF or WebP image.");
  }

  const original = await readAsDataUrl(file);

  // A canvas keeps only the frame it drew, so running an animated GIF through
  // it silently turns it into a still. Better to pass it through and let the
  // size cap decide than to quietly break the thing someone chose.
  if (file.type === "image/gif") {
    if (dataUrlBytes(original) > MAX_IMAGE_BYTES) {
      throw new Error(
        "That GIF is too large. Animated images cannot be resized automatically — use a smaller one.",
      );
    }
    const img = await loadImage(original);
    const width = Math.min(IMAGE_PRESET_WIDTH[preset], img.naturalWidth);
    return {
      dataUrl: original,
      width,
      height: Math.round((img.naturalHeight / img.naturalWidth) * width),
    };
  }

  const img = await loadImage(original);
  const targetWidth = Math.min(IMAGE_PRESET_WIDTH[preset], img.naturalWidth);
  const targetHeight = Math.round(
    (img.naturalHeight / img.naturalWidth) * targetWidth,
  );

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process that image.");
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // PNG keeps transparency, which most logos need; JPEG for photographs, where
  // lossless would be several times larger for no visible gain.
  const isPhoto = file.type === "image/jpeg";
  const dataUrl = canvas.toDataURL(
    isPhoto ? "image/jpeg" : "image/png",
    isPhoto ? 0.85 : undefined,
  );

  if (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES) {
    throw new Error(
      "That image is still too large after resizing. Try the Small size, or a simpler image.",
    );
  }

  return { dataUrl, width: targetWidth, height: targetHeight };
}
