import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, ImageIcon, Loader2, Search, Star, Upload } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { MediaAsset } from "~/lib/api/media";
import { uploadMediaFile, MediaUploadError } from "~/lib/media/upload";
import { useMediaAssetsInfinite } from "~/lib/hooks/useMediaAssets";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { toast } from "sonner";

/**
 * Pick an image from the workspace media library — the shape email editors
 * embed: click an image, get its public URL. Mirrors the WordPress
 * MediaLibraryPicker, plus in-place upload so nobody has to leave the flow.
 * Scrolling near the bottom loads more pages.
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: MediaAsset) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [picked, setPicked] = useState<MediaAsset | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setDraftSearch("");
    setPicked(null);
  }, [open]);

  const mediaQuery = useMediaAssetsInfinite(open, { search });

  const assets = useMemo(
    () => mediaQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [mediaQuery.data],
  );
  const loadError = mediaQuery.isError
    ? extractErrorMessage(mediaQuery.error)
    : null;

  // Load the next page when the sentinel enters the scroll viewport.
  useEffect(() => {
    if (!open) return;
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (
          hit &&
          mediaQuery.hasNextPage &&
          !mediaQuery.isFetchingNextPage &&
          !mediaQuery.isLoading
        ) {
          void mediaQuery.fetchNextPage();
        }
      },
      { root, rootMargin: "120px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    open,
    mediaQuery.hasNextPage,
    mediaQuery.isFetchingNextPage,
    mediaQuery.isLoading,
    mediaQuery.fetchNextPage,
    assets.length,
  ]);

  function applySearch() {
    setSearch(draftSearch.trim());
  }

  function confirm() {
    if (!picked) return;
    onSelect(picked);
    onOpenChange(false);
  }

  function startUploads(files: FileList) {
    Array.from(files).forEach((file) => {
      setUploadingCount((c) => c + 1);
      void uploadMediaFile(file)
        .then((asset) => {
          void queryClient.invalidateQueries({ queryKey: ["media-assets"] });
          // Auto-pick the fresh upload — that is almost always the intent.
          setPicked(asset);
        })
        .catch((error) => {
          toast.error(
            t("media.uploadFailed", { defaultValue: "Upload failed" }),
            {
              description:
                error instanceof MediaUploadError
                  ? error.message
                  : extractErrorMessage(error),
            },
          );
        })
        .finally(() => setUploadingCount((c) => c - 1));
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 sm:px-6">
          <DialogTitle>
            {t("media.pickerTitle", { defaultValue: "Media library" })}
          </DialogTitle>
          <DialogDescription>
            {t("media.pickerDesc", {
              defaultValue:
                "Choose an image from your library, or upload a new one. The image is embedded by its hosted link.",
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-5 py-3 sm:px-6">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applySearch();
                }
              }}
              placeholder={t("media.pickerSearch", {
                defaultValue: "Search images…",
              })}
              className="pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applySearch}
          >
            {t("media.pickerSearchBtn", { defaultValue: "Search" })}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingCount > 0}
          >
            {uploadingCount > 0 ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {t("media.pickerUpload", { defaultValue: "Upload" })}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) startUploads(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"
        >
          {mediaQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("media.pickerLoading", { defaultValue: "Loading images…" })}
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {loadError}
            </div>
          ) : assets.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {t("media.pickerEmpty", { defaultValue: "No images yet" })}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {t("media.pickerEmptyHint", {
                  defaultValue:
                    "Upload your first image with the button above — it lands in your library and can be used in any email.",
                })}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                {assets.map((asset) => {
                  const isPicked = picked?.id === asset.id;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => setPicked(asset)}
                      className={cn(
                        "group relative aspect-[1.2] cursor-pointer overflow-hidden rounded-xl border bg-muted text-left outline-none transition",
                        isPicked
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/40",
                      )}
                      title={asset.original_filename}
                    >
                      <img
                        src={asset.thumb_url}
                        alt={asset.original_filename}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {asset.is_favorite && !isPicked && (
                        <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-card/90 text-primary">
                          <Star
                            className="h-3 w-3"
                            fill="currentColor"
                            strokeWidth={0}
                          />
                        </span>
                      )}
                      {isPicked && (
                        <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                        {asset.original_filename}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div
                ref={sentinelRef}
                className="flex h-10 items-center justify-center"
                aria-hidden
              >
                {mediaQuery.isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 border-t px-5 py-3 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {t("common.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button type="button" disabled={!picked} onClick={confirm}>
            {t("media.pickerUse", { defaultValue: "Use image" })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
