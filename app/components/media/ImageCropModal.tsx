import { useEffect, useRef, useState } from "react";
import Cropper, { type Area, type MediaSize } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";
import { Check, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Slider } from "~/components/ui/slider";
import { cropToFile, type CropOutputType } from "~/lib/image/crop-image";

export interface ImageCropModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The file the user picked. This component never uploads it. */
  file: File | null;
  /** Receives the cropped file. The PARENT performs the upload. */
  onCropped: (file: File) => void | Promise<void>;
  /** Parent's upload is in flight. */
  busy?: boolean;
  aspect?: number;
  /** Crop frame shape. Round for headshots, rect for content images. */
  cropShape?: "rect" | "round";
  showGrid?: boolean;
  /** Output geometry. Defaults reproduce the headshot flow (512²). */
  outputWidth?: number;
  outputHeight?: number;
  /**
   * Never upscale: shrink the output box (keeping its aspect) to the cropped
   * source area when that is smaller.
   */
  capOutputToSource?: boolean;
  /** Smallest accepted crop, in source pixels (both dimensions). */
  minCropPx?: number;
  /**
   * Allow zooming OUT below 100%, so the image can sit smaller than the crop
   * frame; the uncovered margins are saved as transparency (the encoder
   * switches to PNG). Also unlocks free positioning.
   */
  allowShrink?: boolean;
  /** Pin the encoded format (replace-in-place flows). */
  forceType?: CropOutputType;
}

/**
 * Crop + zoom before upload.
 *
 * Deliberately does not upload: keeping that in the parent makes this a pure
 * "give me a cropped File" component, and means a failed upload leaves the
 * crop on screen to retry instead of throwing away the user's framing.
 * (Ported from the Garnik-personal staff-headshot flow.)
 */
export function ImageCropModal({
  open,
  onOpenChange,
  file,
  onCropped,
  busy = false,
  aspect = 1,
  cropShape = "round",
  showGrid = false,
  outputWidth = 512,
  outputHeight = 512,
  capOutputToSource = false,
  minCropPx = 128,
  allowShrink = false,
  forceType,
}: ImageCropModalProps) {
  const minZoom = allowShrink ? 0.2 : 1;
  const { t } = useTranslation();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [ready, setReady] = useState(false);
  const [sourceFits, setSourceFits] = useState(false);
  /** Crop-frame width in stage px; null = the largest fit (rect only). */
  const [frameW, setFrameW] = useState<number | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number } | null>(
    null,
  );
  /** Rendered media box at zoom 1 (react-easy-crop's contain fit). */
  const [mediaBox, setMediaBox] = useState<{ w: number; h: number } | null>(
    null,
  );
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pixelsRef = useRef<Area | null>(null);

  // Reset on open. A reused modal instance must never inherit the previous
  // photo's zoom, offset or crop rectangle. Revoking the object URL on
  // cleanup keeps one pick from leaking a blob URL.
  useEffect(() => {
    if (!open || !file) {
      setImageUrl(null);
      setReady(false);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setFrameW(null);
    setReady(false);
    setSourceFits(false);
    setMediaBox(null);
    pixelsRef.current = null;
    return () => URL.revokeObjectURL(url);
  }, [open, file]);

  // Measure the stage so the crop frame can be sized as a fraction of the
  // largest aspect-true rectangle that fits it. Observed (not read once):
  // the dialog animates open and can resize with the viewport.
  useEffect(() => {
    if (!open) return;
    const el = stageRef.current;
    if (!el) return;
    const measure = () =>
      setStageSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, imageUrl]);

  // Fixed crop-frame size (react-easy-crop `cropSize`), aspect-true. Only the
  // rect flow gets corner resize handles; the round headshot flow keeps the
  // library's auto-fit sizing. The frame is bounded by BOTH the stage and the
  // rendered media at zoom 1 — a frame wider than a portrait image could
  // never be covered and would break restrictPosition.
  const MIN_FRAME_W = 96;
  const maxFrameW =
    cropShape === "rect" && stageSize && mediaBox
      ? Math.floor(
          Math.min(
            stageSize.w,
            stageSize.h * aspect,
            mediaBox.w,
            mediaBox.h * aspect,
          ),
        )
      : null;
  const cropSize = (() => {
    if (maxFrameW == null) return undefined;
    const width = Math.round(
      Math.min(maxFrameW, Math.max(MIN_FRAME_W, frameW ?? maxFrameW)),
    );
    return { width, height: Math.round(width / aspect) };
  })();

  /**
   * Corner-handle resize: dragging any corner scales the frame around its
   * center, ratio locked. The larger of the horizontal/vertical cursor
   * distances wins so the frame follows the pointer along the diagonal.
   */
  const startFrameResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const move = (ev: PointerEvent) => {
      const dx = Math.abs(ev.clientX - cx);
      const dy = Math.abs(ev.clientY - cy);
      setFrameW(Math.max(2 * dx, 2 * dy * aspect));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const apply = async () => {
    const pixels = pixelsRef.current;
    if (!imageUrl || !pixels || !file) return;
    if (pixels.width < minCropPx || pixels.height < minCropPx) {
      toast.error(
        t("media.cropTooSmall", {
          defaultValue: "The selected area is too small.",
        }),
      );
      return;
    }
    try {
      let outW = outputWidth;
      let outH = outputHeight;
      if (capOutputToSource && pixels.width < outW) {
        // Keep the output aspect but never resample beyond the source crop.
        outW = Math.round(pixels.width);
        outH = Math.round((outW * outputHeight) / outputWidth);
      }
      const cropped = await cropToFile(
        imageUrl,
        pixels,
        outW,
        outH,
        file.name,
        forceType,
      );
      await onCropped(cropped);
    } catch {
      toast.error(
        t("media.cropError", {
          defaultValue: "The image could not be processed.",
        }),
      );
    }
  };

  const onMediaLoaded = (media: MediaSize) => {
    setReady(true);
    // Ratio indicator: source already matches the target aspect within 2%.
    const sourceAspect = media.naturalWidth / media.naturalHeight;
    setSourceFits(Math.abs(sourceAspect - aspect) / aspect <= 0.02);
  };

  // Fires on EVERY internal recompute (load, window/container resize) —
  // unlike onMediaLoaded, which is one-shot and can capture a mid-animation
  // or zero-size stage (the dialog animates open). Equality-guarded: setting
  // cropSize triggers a recompute, so an unconditional set would loop.
  const onMediaSizeChange = (media: MediaSize) => {
    setMediaBox((prev) =>
      prev &&
      Math.abs(prev.w - media.width) < 1 &&
      Math.abs(prev.h - media.height) < 1
        ? prev
        : { w: media.width, h: media.height },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Never let an outside click or Escape close the dialog mid-upload.
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        className={cropShape === "rect" ? "sm:max-w-3xl" : "sm:max-w-lg"}
      >
        <DialogHeader>
          <DialogTitle>
            {t("media.cropTitle", { defaultValue: "Crop image" })}
          </DialogTitle>
          <DialogDescription>
            {t("media.cropHint", {
              defaultValue: "Drag to reposition, use the slider to zoom.",
            })}
          </DialogDescription>
        </DialogHeader>

        {/* react-easy-crop renders position:absolute children, so this wrapper
            MUST be position:relative with an explicit height or it collapses
            to zero and the modal looks empty. */}
        <div
          ref={stageRef}
          className={
            cropShape === "rect"
              ? "relative h-[420px] w-full overflow-hidden rounded-md bg-black"
              : "relative h-[360px] w-full overflow-hidden rounded-md bg-black"
          }
        >
          {/* Mount only when open: React Router 7 renders on the server, and
              the cropper touches window/Image on mount. */}
          {open && imageUrl ? (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              cropSize={cropSize}
              showGrid={showGrid}
              minZoom={minZoom}
              maxZoom={4}
              // Free positioning is required for zoom-out: restrictPosition
              // forces the image to keep covering the frame, which fights any
              // zoom level below 1.
              restrictPosition={!allowShrink}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onMediaLoaded={onMediaLoaded}
              setMediaSize={onMediaSizeChange}
              onCropComplete={(_area, areaPixels) => {
                pixelsRef.current = areaPixels;
              }}
            />
          ) : null}
          {/* Corner resize handles — scale the (centered) crop frame around
              its middle, ratio locked. Sibling of the Cropper, so dragging a
              handle never pans the image. */}
          {cropShape === "rect" && ready && cropSize ? (
            <div className="pointer-events-none absolute inset-0 z-10">
              {(
                [
                  { sx: -1, sy: -1, cursor: "cursor-nwse-resize" },
                  { sx: 1, sy: -1, cursor: "cursor-nesw-resize" },
                  { sx: -1, sy: 1, cursor: "cursor-nesw-resize" },
                  { sx: 1, sy: 1, cursor: "cursor-nwse-resize" },
                ] as const
              ).map(({ sx, sy, cursor }) => (
                <div
                  key={`${sx}${sy}`}
                  role="slider"
                  aria-label={t("media.cropFrameSize", {
                    defaultValue: "Frame size",
                  })}
                  aria-valuenow={cropSize.width}
                  className={`pointer-events-auto absolute size-3.5 rounded-[2px] border-2 border-white bg-black/60 shadow ${cursor}`}
                  style={{
                    left: `calc(50% + ${sx * (cropSize.width / 2)}px - 7px)`,
                    top: `calc(50% + ${sy * (cropSize.height / 2)}px - 7px)`,
                    touchAction: "none",
                  }}
                  onPointerDown={startFrameResize}
                />
              ))}
            </div>
          ) : null}
        </div>

        {cropShape === "rect" && ready ? (
          sourceFits ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-600">
              <Check className="size-3.5" aria-hidden />
              {t("media.cropRatioOk", { defaultValue: "Fits the ratio" })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("media.cropRatioHint", {
                defaultValue:
                  "Adjust the visible area — the image will be saved in the target ratio.",
              })}
            </p>
          )
        ) : null}

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {t("media.cropZoom", { defaultValue: "Zoom" })}
          </span>
          <Slider
            value={[zoom]}
            min={minZoom}
            max={4}
            step={0.01}
            disabled={busy || !ready}
            onValueChange={([z]) => setZoom(z)}
            className="flex-1"
            aria-label={t("media.cropZoom", { defaultValue: "Zoom" })}
          />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="button" disabled={busy || !ready} onClick={apply}>
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                {t("media.cropSaving", { defaultValue: "Saving…" })}
              </>
            ) : (
              t("media.cropApply", { defaultValue: "Use image" })
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
