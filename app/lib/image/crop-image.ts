/**
 * Canvas-side of the crop modal: turn a source image + crop rectangle into
 * an encoded File of fixed output geometry.
 */

export type CropOutputType = "image/jpeg" | "image/png";

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be loaded"));
    img.src = src;
  });
}

/**
 * Draw `pixels` (source coordinates; may extend past the image bounds when
 * the crop UI allows shrinking) into an outputWidth×outputHeight canvas and
 * encode it as a File.
 *
 * Format: `forceType` wins when given (replace-in-place flows); otherwise
 * PNG when the crop reaches outside the source (the margins must stay
 * transparent), else JPEG at 0.9.
 */
export async function cropToFile(
  imageUrl: string,
  pixels: CropArea,
  outputWidth: number,
  outputHeight: number,
  sourceFilename: string,
  forceType?: CropOutputType,
): Promise<File> {
  const img = await loadImage(imageUrl);

  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    img,
    pixels.x,
    pixels.y,
    pixels.width,
    pixels.height,
    0,
    0,
    outputWidth,
    outputHeight,
  );

  const cropsOutsideSource =
    pixels.x < 0 ||
    pixels.y < 0 ||
    pixels.x + pixels.width > img.naturalWidth ||
    pixels.y + pixels.height > img.naturalHeight;

  const type: CropOutputType =
    forceType ?? (cropsOutsideSource ? "image/png" : "image/jpeg");

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, type === "image/jpeg" ? 0.9 : undefined),
  );
  if (!blob) throw new Error("Image could not be encoded");

  const base = sourceFilename.replace(/\.[^.]+$/, "") || "image";
  const ext = type === "image/png" ? "png" : "jpg";
  return new File([blob], `${base}.${ext}`, { type });
}
