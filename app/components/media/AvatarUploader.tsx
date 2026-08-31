import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { ConfirmDeleteDialog } from "~/components/molecule/confirm-delete-dialog";
import { ImageCropModal } from "./ImageCropModal";
import { generateThumbnail } from "~/lib/utils/image-resize";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 15 * 1024 * 1024; // pre-crop source cap

/**
 * Round (or square) picture with Change / Remove controls and the crop
 * modal in between. Pure UI — the parent owns the upload and remove
 * mutations, so this stays reusable for user and workspace pictures.
 */
export function AvatarUploader({
  imageUrl,
  fallbackText,
  onUpload,
  onRemove,
  busy = false,
  disabled = false,
  shape = "round",
  crop = true,
  removeConfirmDescription,
}: {
  imageUrl: string | null | undefined;
  fallbackText: string;
  onUpload: (file: File, thumb?: Blob) => Promise<void>;
  onRemove: () => Promise<void>;
  busy?: boolean;
  /** Controls hidden entirely (e.g. non-admin viewing workspace picture). */
  disabled?: boolean;
  shape?: "round" | "square";
  /**
   * false = no crop modal: the picked image is silently downscaled
   * (≤1024px long edge) and uploaded as-is. Used for the workspace picture.
   */
  crop?: boolean;
  removeConfirmDescription: string;
}) {
  const { t } = useTranslation();
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      toast.error(
        t("settings.avatarWrongType", {
          defaultValue: "Use a JPEG, PNG or WebP image.",
        }),
      );
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      toast.error(
        t("settings.avatarTooLarge", {
          defaultValue: "That image is too large (max 15 MB).",
        }),
      );
      return;
    }
    if (!crop) {
      // No crop flow: downscale in the browser (keeps it under the API's
      // 2MB cap), plus a 128px thumb for chips, and upload straight away.
      void Promise.all([
        generateThumbnail(file, 1024),
        generateThumbnail(file, 128),
      ])
        .then(([resized, thumb]) =>
          onUpload(
            new File(
              [resized.blob],
              file.name.replace(/\.[^.]+$/, "") + ".webp",
              { type: resized.mimeType },
            ),
            thumb.blob,
          ),
        )
        .catch(() =>
          toast.error(
            t("media.cropError", {
              defaultValue: "The image could not be processed.",
            }),
          ),
        );
      return;
    }
    setPickedFile(file);
    setCropOpen(true);
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      {/* Fixed 1:1 box; the image keeps its own ratio inside it
          (object-contain) so any logo/photo shape always looks right. */}
      <div
        className={cn(
          "flex size-16 shrink-0 items-center justify-center overflow-hidden border border-border bg-muted",
          shape === "square" ? "rounded-xl" : "rounded-full",
        )}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className={cn(
              "h-full w-full",
              shape === "square"
                ? "object-contain p-1.5"
                : "object-cover",
            )}
          />
        ) : (
          <span className="text-sm font-bold text-muted-foreground">
            {fallbackText}
          </span>
        )}
      </div>

      {!disabled && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" />
            {imageUrl
              ? t("settings.avatarChange", { defaultValue: "Change" })
              : t("settings.avatarUpload", { defaultValue: "Upload" })}
          </Button>
          {imageUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmRemove(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("settings.avatarRemove", { defaultValue: "Remove" })}
            </Button>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      )}

      <ImageCropModal
        open={cropOpen}
        onOpenChange={(open) => {
          setCropOpen(open);
          if (!open) setPickedFile(null);
        }}
        file={pickedFile}
        busy={busy}
        aspect={1}
        cropShape={shape === "round" ? "round" : "rect"}
        outputWidth={512}
        outputHeight={512}
        minCropPx={128}
        allowShrink
        onCropped={async (cropped) => {
          // 128px thumb for chips/lists, generated from the cropped result.
          const thumb = await generateThumbnail(cropped, 128).catch(() => null);
          await onUpload(cropped, thumb?.blob);
          setCropOpen(false);
          setPickedFile(null);
        }}
      />

      <ConfirmDeleteDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        name={null}
        title={t("settings.avatarRemoveTitle", {
          defaultValue: "Remove picture?",
        })}
        description={removeConfirmDescription}
        confirmLabel={t("settings.avatarRemove", { defaultValue: "Remove" })}
        onConfirm={() => {
          void onRemove().then(() => setConfirmRemove(false));
        }}
        busy={busy}
      />
    </div>
  );
}
