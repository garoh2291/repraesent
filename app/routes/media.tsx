import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Check,
  Copy,
  Download,
  Eye,
  ImageIcon,
  Loader2,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  deleteMediaAsset,
  emptyMediaBin,
  hardDeleteMediaAsset,
  listMediaAssets,
  listMediaBin,
  restoreMediaAsset,
  updateMediaAsset,
  type MediaAsset,
} from "~/lib/api/media";
import { MediaUploadError } from "~/lib/media/upload";
import {
  enqueueMediaUpload,
  uploadQueueBusyCount,
} from "~/lib/media/upload-queue";
import {
  useMediaAssetsInfinite,
  type MediaView,
} from "~/lib/hooks/useMediaAssets";
import { useSearchShortcut } from "~/lib/hooks/useSearchShortcut";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { downloadFromUrl } from "~/lib/utils/download";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "~/components/ui/context-menu";
import { ConfirmDeleteDialog } from "~/components/molecule/confirm-delete-dialog";
import { PromptDialog } from "~/components/molecule/prompt-dialog";

export function meta() {
  return [{ title: "Media Library" }];
}

interface UploadingItem {
  key: string;
  name: string;
  stage: string;
  error: string | null;
}

/** One menu entry; rendered identically by the kebab and the context menu. */
interface AssetAction {
  key: string;
  label: string;
  icon: React.ReactNode;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "banner.png" -> ["banner", ".png"] — rename edits the base, keeps the ext. */
function splitExtension(filename: string): [string, string] {
  const dot = filename.lastIndexOf(".");
  if (dot <= 0) return [filename, ""];
  return [filename.slice(0, dot), filename.slice(dot)];
}

const VALID_VIEWS: MediaView[] = ["library", "favorites", "bin"];

export default function MediaLibraryPage() {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { ref: searchInputRef, withHint } = useSearchShortcut();

  const view: MediaView = VALID_VIEWS.includes(params.view as MediaView)
    ? (params.view as MediaView)
    : "library";

  const [searchDraft, setSearchDraft] = useState("");
  const search = useDebounce(searchDraft, 300);

  const [uploading, setUploading] = useState<UploadingItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<MediaAsset | null>(null);
  const [renameTarget, setRenameTarget] = useState<MediaAsset | null>(null);
  const [binTarget, setBinTarget] = useState<MediaAsset | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<MediaAsset | null>(
    null,
  );
  const [confirmEmptyBin, setConfirmEmptyBin] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollSentinelRef = useRef<HTMLDivElement>(null);

  const assetsQuery = useMediaAssetsInfinite(true, { view, search });
  const assets = useMemo(
    () => assetsQuery.data?.pages.flatMap((p) => p.data) ?? [],
    [assetsQuery.data],
  );

  // Lightweight totals for the view menu badges.
  const libraryCount = useQuery({
    queryKey: ["media-count", "library"],
    queryFn: () => listMediaAssets({ page: 1, limit: 1 }),
    staleTime: 30_000,
    select: (d) => d.total,
  });
  const favoritesCount = useQuery({
    queryKey: ["media-count", "favorites"],
    queryFn: () => listMediaAssets({ page: 1, limit: 1, favorites: true }),
    staleTime: 30_000,
    select: (d) => d.total,
  });
  const binCount = useQuery({
    queryKey: ["media-count", "bin"],
    queryFn: () => listMediaBin({ page: 1, limit: 1 }),
    staleTime: 30_000,
    select: (d) => d.total,
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["media-assets"] });
    void queryClient.invalidateQueries({ queryKey: ["media-count"] });
  }, [queryClient]);

  // Bulk uploads: 100 completions must not trigger 100 grid refetches — a
  // trailing debounce batches them, and the drain flush catches the tail.
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleInvalidate = useCallback(() => {
    if (invalidateTimer.current) clearTimeout(invalidateTimer.current);
    invalidateTimer.current = setTimeout(() => {
      invalidateTimer.current = null;
      invalidate();
    }, 1500);
  }, [invalidate]);
  const flushInvalidate = useCallback(() => {
    if (invalidateTimer.current) {
      clearTimeout(invalidateTimer.current);
      invalidateTimer.current = null;
    }
    invalidate();
  }, [invalidate]);

  /** Batch progress for the header chip ("Uploading 12 / 100"). */
  const [batch, setBatch] = useState({ done: 0, total: 0 });

  // Load the next page when the sentinel scrolls into view.
  useEffect(() => {
    const sentinel = scrollSentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (
          entries.some((e) => e.isIntersecting) &&
          assetsQuery.hasNextPage &&
          !assetsQuery.isFetchingNextPage &&
          !assetsQuery.isLoading
        ) {
          void assetsQuery.fetchNextPage();
        }
      },
      { rootMargin: "300px", threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [
    assetsQuery.hasNextPage,
    assetsQuery.isFetchingNextPage,
    assetsQuery.isLoading,
    assetsQuery.fetchNextPage,
    assets.length,
    view,
  ]);

  const startUploads = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      if (list.length === 0) return;
      if (view === "bin") navigate("/media");

      setBatch((b) =>
        b.total === b.done
          ? { done: 0, total: list.length }
          : { ...b, total: b.total + list.length },
      );

      list.forEach((file) => {
        const key = `${file.name}-${Date.now()}-${Math.random()}`;
        setUploading((prev) => [
          ...prev,
          { key, name: file.name, stage: "queued", error: null },
        ]);

        enqueueMediaUpload({
          file,
          onStage: (stage) => {
            setUploading((prev) =>
              prev.map((u) => (u.key === key ? { ...u, stage } : u)),
            );
          },
          onDone: () => {
            setUploading((prev) => prev.filter((u) => u.key !== key));
            setBatch((b) => ({ ...b, done: b.done + 1 }));
            if (uploadQueueBusyCount() === 0) {
              flushInvalidate();
              toast.success(
                t("media.uploadDone", { defaultValue: "Image uploaded" }),
              );
            } else {
              scheduleInvalidate();
            }
          },
          onError: (error) => {
            setBatch((b) => ({ ...b, done: b.done + 1 }));
            const message =
              error instanceof MediaUploadError
                ? error.message
                : extractErrorMessage(error);
            setUploading((prev) =>
              prev.map((u) => (u.key === key ? { ...u, error: message } : u)),
            );
          },
        });
      });
    },
    [flushInvalidate, navigate, scheduleInvalidate, t, view],
  );

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: { original_filename?: string; is_favorite?: boolean };
    }) => updateMediaAsset(id, input),
    onSuccess: (updated) => {
      invalidate();
      setPreview((p) => (p && p.id === updated.id ? updated : p));
    },
    onError: (error) =>
      toast.error(
        t("media.updateFailed", { defaultValue: "Could not update image" }),
        { description: extractErrorMessage(error) },
      ),
  });

  const softDeleteMutation = useMutation({
    mutationFn: deleteMediaAsset,
    onSuccess: (_d, id) => {
      invalidate();
      setBinTarget(null);
      setPreview((p) => (p && p.id === id ? null : p));
      toast.success(
        t("media.movedToBin", { defaultValue: "Moved to recycle bin" }),
      );
    },
    onError: (error) =>
      toast.error(
        t("media.deleteFailed", { defaultValue: "Could not delete image" }),
        { description: extractErrorMessage(error) },
      ),
  });

  const restoreMutation = useMutation({
    mutationFn: restoreMediaAsset,
    onSuccess: (_d, id) => {
      invalidate();
      setPreview((p) => (p && p.id === id ? null : p));
      toast.success(t("media.restored", { defaultValue: "Image restored" }));
    },
    onError: (error) =>
      toast.error(
        t("media.restoreFailed", { defaultValue: "Could not restore image" }),
        { description: extractErrorMessage(error) },
      ),
  });

  const hardDeleteMutation = useMutation({
    mutationFn: hardDeleteMediaAsset,
    onSuccess: (_d, id) => {
      invalidate();
      setHardDeleteTarget(null);
      setPreview((p) => (p && p.id === id ? null : p));
      toast.success(
        t("media.hardDeleted", { defaultValue: "Image deleted forever" }),
      );
    },
    onError: (error) =>
      toast.error(
        t("media.deleteFailed", { defaultValue: "Could not delete image" }),
        { description: extractErrorMessage(error) },
      ),
  });

  const emptyBinMutation = useMutation({
    mutationFn: emptyMediaBin,
    onSuccess: (res) => {
      invalidate();
      setConfirmEmptyBin(false);
      toast.success(
        t("media.binEmptied", {
          defaultValue: "Recycle bin emptied ({{count}} images)",
          count: res.deleted,
        }),
      );
    },
    onError: (error) =>
      toast.error(
        t("media.emptyBinFailed", { defaultValue: "Could not empty the bin" }),
        { description: extractErrorMessage(error) },
      ),
  });

  const copyUrl = useCallback(
    (asset: MediaAsset) => {
      navigator.clipboard
        .writeText(asset.public_url)
        .then(() => {
          setCopiedId(asset.id);
          setTimeout(
            () => setCopiedId((c) => (c === asset.id ? null : c)),
            2000,
          );
          toast.success(
            t("media.linkCopied", { defaultValue: "Image link copied" }),
          );
        })
        .catch(() =>
          toast.error(
            t("media.copyFailed", {
              defaultValue: "Could not copy to clipboard",
            }),
          ),
        );
    },
    [t],
  );

  const downloadAsset = useCallback(
    (asset: MediaAsset) => {
      downloadFromUrl(asset.public_url, asset.original_filename).catch(() =>
        toast.error(
          t("media.downloadFailed", { defaultValue: "Download failed" }),
        ),
      );
    },
    [t],
  );

  const toggleFavorite = useCallback(
    (asset: MediaAsset) => {
      updateMutation.mutate({
        id: asset.id,
        input: { is_favorite: !asset.is_favorite },
      });
    },
    [updateMutation],
  );

  /** Single source of truth for asset actions — kebab, right-click, preview. */
  const buildAssetActions = useCallback(
    (asset: MediaAsset): AssetAction[] => {
      if (view === "bin") {
        return [
          {
            key: "restore",
            label: t("media.restore", { defaultValue: "Restore" }),
            icon: <RotateCcw className="h-4 w-4" />,
            onSelect: () => restoreMutation.mutate(asset.id),
          },
          {
            key: "hard-delete",
            label: t("media.deleteForever", { defaultValue: "Delete forever" }),
            icon: <Trash2 className="h-4 w-4" />,
            destructive: true,
            separatorBefore: true,
            onSelect: () => setHardDeleteTarget(asset),
          },
        ];
      }
      return [
        {
          key: "preview",
          label: t("media.previewAction", { defaultValue: "Preview" }),
          icon: <Eye className="h-4 w-4" />,
          onSelect: () => setPreview(asset),
        },
        {
          key: "copy",
          label: t("media.copyUrl", { defaultValue: "Copy image link" }),
          icon: <Copy className="h-4 w-4" />,
          onSelect: () => copyUrl(asset),
        },
        {
          key: "download",
          label: t("media.download", { defaultValue: "Download" }),
          icon: <Download className="h-4 w-4" />,
          onSelect: () => downloadAsset(asset),
        },
        {
          key: "favorite",
          label: asset.is_favorite
            ? t("media.unfavorite", { defaultValue: "Remove from favourites" })
            : t("media.favorite", { defaultValue: "Add to favourites" }),
          icon: asset.is_favorite ? (
            <Star className="h-4 w-4" fill="currentColor" strokeWidth={0} />
          ) : (
            <Star className="h-4 w-4" />
          ),
          onSelect: () => toggleFavorite(asset),
        },
        {
          key: "rename",
          label: t("media.rename", { defaultValue: "Rename" }),
          icon: <Pencil className="h-4 w-4" />,
          onSelect: () => setRenameTarget(asset),
        },
        {
          key: "bin",
          label: t("media.moveToBin", { defaultValue: "Move to recycle bin" }),
          icon: <Trash2 className="h-4 w-4" />,
          destructive: true,
          separatorBefore: true,
          onSelect: () => setBinTarget(asset),
        },
      ];
    },
    [copyUrl, downloadAsset, restoreMutation, t, toggleFavorite, view],
  );

  const viewItems: {
    key: MediaView;
    to: string;
    label: string;
    icon: React.ReactNode;
    count: number | undefined;
  }[] = [
    {
      key: "library",
      to: "/media",
      label: t("media.tabLibrary", { defaultValue: "Library" }),
      icon: <ImageIcon className="h-4 w-4 shrink-0" />,
      count: libraryCount.data,
    },
    {
      key: "favorites",
      to: "/media/favorites",
      label: t("media.tabFavorites", { defaultValue: "Favourites" }),
      icon: <Star className="h-4 w-4 shrink-0" />,
      count: favoritesCount.data,
    },
    {
      key: "bin",
      to: "/media/bin",
      label: t("media.tabBin", { defaultValue: "Recycle bin" }),
      icon: <Trash2 className="h-4 w-4 shrink-0" />,
      count: binCount.data,
    },
  ];

  const loadError = assetsQuery.isError
    ? extractErrorMessage(assetsQuery.error)
    : null;

  const emptyCopy =
    view === "bin"
      ? {
          title: t("media.binEmpty", { defaultValue: "Recycle bin is empty" }),
          hint: t("media.binEmptyHint", {
            defaultValue: "Deleted images land here and can be restored.",
          }),
        }
      : view === "favorites"
        ? {
            title: t("media.favoritesEmpty", {
              defaultValue: "No favourites yet",
            }),
            hint: t("media.favoritesEmptyHint", {
              defaultValue:
                "Star an image in the library and it shows up here.",
            }),
          }
        : {
            title: t("media.empty", { defaultValue: "No images yet" }),
            hint: t("media.emptyHint", {
              defaultValue:
                "Upload images here or drag & drop them anywhere on this page.",
            }),
          };

  return (
    <div
      className="app-fade-in mx-auto w-full max-w-[1280px] space-y-6 p-4 py-10! sm:p-6"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) startUploads(e.dataTransfer.files);
      }}
    >
      {/* Header */}
      <div className="app-fade-up flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
            {t("media.title", { defaultValue: "Media Library" })}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("media.subtitle", {
              defaultValue:
                "Images hosted for your emails — upload once, use the link anywhere.",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {batch.total > 0 && batch.done < batch.total && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[12px] font-medium tabular-nums text-primary">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("media.uploadingProgress", {
                defaultValue: "Uploading {{done}} / {{total}}…",
                done: batch.done,
                total: batch.total,
              })}
            </span>
          )}
          {view === "bin" && assets.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setConfirmEmptyBin(true)}
              disabled={emptyBinMutation.isPending}
            >
              <Trash2 className="mr-1.5 h-4 w-4" />
              {t("media.emptyBin", { defaultValue: "Empty bin" })}
            </Button>
          )}
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" />
            {t("media.upload", { defaultValue: "Upload images" })}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) startUploads(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="app-fade-up app-fade-up-d1 grid gap-6 lg:grid-cols-[190px_minmax(0,1fr)]">
        {/* View menu — vertical on desktop, pill row on mobile */}
        <nav className="flex gap-1.5 overflow-x-auto scrollbar-hide lg:flex-col lg:gap-1">
          {viewItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                "flex shrink-0 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                view === item.key
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              {typeof item.count === "number" && (
                <span
                  className={cn(
                    "ml-auto text-[11px] tabular-nums",
                    view === item.key
                      ? "text-primary/70"
                      : "text-muted-foreground/60",
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Grid column */}
        <div className="min-w-0 space-y-4">
          <Input
            ref={searchInputRef}
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder={withHint(
              t("media.searchPlaceholder", { defaultValue: "Search images" }),
            )}
            className="max-w-sm"
          />

          {loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {loadError}
            </div>
          ) : assetsQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="aspect-[4/3] animate-pulse bg-muted/60" />
                  <div className="space-y-1.5 p-3">
                    <div className="h-3 w-3/4 animate-pulse rounded bg-muted/60" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted/50" />
                  </div>
                </div>
              ))}
            </div>
          ) : assets.length === 0 && uploading.length === 0 ? (
            <div className="app-fade-up flex flex-col items-center gap-3 rounded-2xl border border-dashed px-4 py-16 text-center">
              {view === "favorites" ? (
                <Star className="h-8 w-8 text-muted-foreground/50" />
              ) : view === "bin" ? (
                <Trash2 className="h-8 w-8 text-muted-foreground/50" />
              ) : (
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              )}
              <div>
                <p className="font-medium">{emptyCopy.title}</p>
                <p className="mx-auto max-w-sm text-sm text-muted-foreground">
                  {emptyCopy.hint}
                </p>
              </div>
              {view === "library" && (
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="mr-1.5 h-4 w-4" />
                  {t("media.upload", { defaultValue: "Upload images" })}
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {uploading.map((u) => (
                  <div
                    key={u.key}
                    className={cn(
                      "overflow-hidden rounded-2xl border",
                      u.error
                        ? "border-destructive/40 bg-destructive/5"
                        : "border-dashed border-border bg-card",
                    )}
                  >
                    <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-3 text-center">
                      {u.error ? (
                        <>
                          <p className="line-clamp-3 text-xs text-destructive">
                            {u.error}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setUploading((prev) =>
                                prev.filter((x) => x.key !== u.key),
                              )
                            }
                          >
                            <X className="mr-1 h-3.5 w-3.5" />
                            {t("common.dismiss", { defaultValue: "Dismiss" })}
                          </Button>
                        </>
                      ) : u.stage === "queued" ? (
                        <p className="text-xs text-muted-foreground/70">
                          {t("media.queued", { defaultValue: "Waiting…" })}
                        </p>
                      ) : (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <div className="border-t border-border/60 p-3">
                      <p className="truncate text-[11px] font-medium text-muted-foreground">
                        {u.name}
                      </p>
                    </div>
                  </div>
                ))}

                {assets.map((asset, index) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    index={index}
                    dimmed={view === "bin"}
                    actions={buildAssetActions(asset)}
                    copied={copiedId === asset.id}
                    onOpen={() => setPreview(asset)}
                  />
                ))}
              </div>

              <div
                ref={scrollSentinelRef}
                className="flex h-10 items-center justify-center"
                aria-hidden
              >
                {assetsQuery.isFetchingNextPage ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>

      {dragOver && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80">
          <div className="rounded-2xl border-2 border-dashed border-primary bg-card px-10 py-8 text-center">
            <Upload className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p className="text-sm font-medium">
              {t("media.dropHere", { defaultValue: "Drop images to upload" })}
            </p>
          </div>
        </div>
      )}

      <AssetPreviewDialog
        asset={preview}
        view={view}
        copied={preview ? copiedId === preview.id : false}
        busy={updateMutation.isPending}
        onClose={() => setPreview(null)}
        onCopy={copyUrl}
        onDownload={downloadAsset}
        onToggleFavorite={toggleFavorite}
        onRename={(asset, name) =>
          updateMutation.mutate(
            { id: asset.id, input: { original_filename: name } },
            {
              onSuccess: () =>
                toast.success(
                  t("media.renamed", { defaultValue: "Image renamed" }),
                ),
            },
          )
        }
        onMoveToBin={(asset) => setBinTarget(asset)}
        onRestore={(asset) => restoreMutation.mutate(asset.id)}
        onHardDelete={(asset) => setHardDeleteTarget(asset)}
      />

      <PromptDialog
        open={renameTarget != null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title={t("media.renameTitle", { defaultValue: "Rename image" })}
        label={t("media.renameLabel", { defaultValue: "Name" })}
        defaultValue={
          renameTarget ? splitExtension(renameTarget.original_filename)[0] : ""
        }
        submitLabel={t("media.renameSubmit", { defaultValue: "Rename" })}
        busy={updateMutation.isPending}
        onSubmit={(value) => {
          if (!renameTarget) return;
          const ext = splitExtension(renameTarget.original_filename)[1];
          updateMutation.mutate(
            {
              id: renameTarget.id,
              input: { original_filename: `${value}${ext}` },
            },
            {
              onSuccess: () => {
                setRenameTarget(null);
                toast.success(
                  t("media.renamed", { defaultValue: "Image renamed" }),
                );
              },
            },
          );
        }}
      />

      <ConfirmDeleteDialog
        open={binTarget != null}
        onOpenChange={(open) => {
          if (!open) setBinTarget(null);
        }}
        name={null}
        title={t("media.moveToBinTitle", {
          defaultValue: 'Move "{{name}}" to the recycle bin?',
          name: binTarget?.original_filename ?? "",
        })}
        description={t("media.moveToBinWarning", {
          defaultValue:
            "The image leaves your library but stays restorable from the Recycle bin. Emails already sent keep working.",
        })}
        confirmLabel={t("media.moveToBinConfirm", {
          defaultValue: "Move to bin",
        })}
        onConfirm={() => {
          if (binTarget) softDeleteMutation.mutate(binTarget.id);
        }}
        busy={softDeleteMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={hardDeleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setHardDeleteTarget(null);
        }}
        name={hardDeleteTarget?.original_filename ?? null}
        description={t("media.hardDeleteWarning", {
          defaultValue:
            "The image file is removed from storage. Emails that were already sent with this image will stop showing it.",
        })}
        confirmLabel={t("media.deleteForever", {
          defaultValue: "Delete forever",
        })}
        onConfirm={() => {
          if (hardDeleteTarget) hardDeleteMutation.mutate(hardDeleteTarget.id);
        }}
        busy={hardDeleteMutation.isPending}
      />

      <ConfirmDeleteDialog
        open={confirmEmptyBin}
        onOpenChange={setConfirmEmptyBin}
        name={null}
        title={t("media.emptyBinTitle", { defaultValue: "Empty recycle bin?" })}
        description={t("media.emptyBinWarning", {
          defaultValue:
            "All images in the bin are removed from storage permanently. Emails already sent with these images will stop showing them.",
        })}
        confirmLabel={t("media.emptyBin", { defaultValue: "Empty bin" })}
        onConfirm={() => emptyBinMutation.mutate()}
        busy={emptyBinMutation.isPending}
      />
    </div>
  );
}

/**
 * One asset tile: image, footer with name+size, star badge, kebab menu —
 * and the same actions on right-click via ContextMenu.
 */
function AssetCard({
  asset,
  index,
  dimmed,
  actions,
  copied,
  onOpen,
}: {
  asset: MediaAsset;
  index: number;
  dimmed: boolean;
  actions: AssetAction[];
  copied: boolean;
  onOpen: () => void;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            `app-fade-up app-fade-up-d${Math.min(index + 1, 4)}`,
            "group relative overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40",
            dimmed && "opacity-70 transition-opacity hover:opacity-100",
          )}
        >
          <button
            type="button"
            onClick={onOpen}
            className="block w-full cursor-pointer"
            title={asset.original_filename}
          >
            <div className="relative aspect-[4/3] bg-muted">
              <img
                src={asset.thumb_url}
                alt={asset.original_filename}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-300",
                  loaded ? "opacity-100" : "opacity-0",
                )}
              />
            </div>
          </button>

          {asset.is_favorite && (
            <span className="absolute top-2 left-2 flex h-6 w-6 items-center justify-center rounded-full bg-card/90 text-primary">
              <Star className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
            </span>
          )}

          <div className="flex items-center gap-2 border-t border-border/60 p-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium">
                {asset.original_filename}
              </p>
              <p className="text-[10px] tabular-nums text-muted-foreground">
                {formatBytes(asset.size_bytes)}
                {asset.width && asset.height
                  ? ` · ${asset.width}×${asset.height}`
                  : ""}
              </p>
            </div>
            {copied && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={asset.original_filename}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                onClick={(e) => e.stopPropagation()}
              >
                {actions.map((action) => (
                  <div key={action.key}>
                    {action.separatorBefore && <DropdownMenuSeparator />}
                    <DropdownMenuItem
                      variant={action.destructive ? "destructive" : "default"}
                      onSelect={action.onSelect}
                    >
                      {action.icon}
                      {action.label}
                    </DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-52">
        {actions.map((action) => (
          <div key={action.key}>
            {action.separatorBefore && <ContextMenuSeparator />}
            <ContextMenuItem
              variant={action.destructive ? "destructive" : "default"}
              onSelect={action.onSelect}
            >
              {action.icon}
              {action.label}
            </ContextMenuItem>
          </div>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

/**
 * Preview lightbox: inline-renamable title, star toggle, blur-up image
 * (both layers absolutely positioned — the V1 mobile "two images" bug came
 * from an un-inset absolute thumb in a flex container), and a full action
 * footer.
 */
function AssetPreviewDialog({
  asset,
  view,
  copied,
  busy,
  onClose,
  onCopy,
  onDownload,
  onToggleFavorite,
  onRename,
  onMoveToBin,
  onRestore,
  onHardDelete,
}: {
  asset: MediaAsset | null;
  view: MediaView;
  copied: boolean;
  busy: boolean;
  onClose: () => void;
  onCopy: (asset: MediaAsset) => void;
  onDownload: (asset: MediaAsset) => void;
  onToggleFavorite: (asset: MediaAsset) => void;
  onRename: (asset: MediaAsset, name: string) => void;
  onMoveToBin: (asset: MediaAsset) => void;
  onRestore: (asset: MediaAsset) => void;
  onHardDelete: (asset: MediaAsset) => void;
}) {
  const { t } = useTranslation();
  const [fullLoaded, setFullLoaded] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  useEffect(() => {
    setFullLoaded(false);
    setRenaming(false);
  }, [asset?.id]);

  if (!asset) return null;

  const [baseName, ext] = splitExtension(asset.original_filename);

  const commitRename = () => {
    setRenaming(false);
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === baseName) return;
    onRename(asset, `${trimmed}${ext}`);
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-4xl gap-0 overflow-hidden p-0"
        aria-describedby={undefined}
      >
        <DialogHeader className="border-b px-5 py-3 pr-12 text-left">
          <div className="flex items-center gap-2">
            {renaming ? (
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    (e.target as HTMLInputElement).blur();
                  if (e.key === "Escape") {
                    setDraftName(baseName);
                    setRenaming(false);
                  }
                }}
                maxLength={200}
                autoFocus
                className="h-8 max-w-sm text-base font-semibold"
              />
            ) : (
              <>
                <DialogTitle className="min-w-0 truncate text-base">
                  {asset.original_filename}
                </DialogTitle>
                {view !== "bin" && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setDraftName(baseName);
                        setRenaming(true);
                      }}
                      aria-label={t("media.rename", {
                        defaultValue: "Rename",
                      })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={busy}
                      className={cn(
                        "h-7 w-7 shrink-0",
                        asset.is_favorite
                          ? "text-primary hover:text-primary"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => onToggleFavorite(asset)}
                      aria-label={t("media.favorite", {
                        defaultValue: "Add to favourites",
                      })}
                      aria-pressed={asset.is_favorite}
                    >
                      {asset.is_favorite ? (
                        <Star
                          className="h-4 w-4"
                          fill="currentColor"
                          strokeWidth={0}
                        />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
          <DialogDescription className="tabular-nums">
            {[
              asset.width && asset.height
                ? `${asset.width} × ${asset.height} px`
                : null,
              formatBytes(asset.size_bytes),
              new Date(asset.created_at).toLocaleDateString(),
            ]
              .filter(Boolean)
              .join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="relative h-[min(60vh,520px)] w-full bg-muted/40">
          <img
            src={asset.thumb_url}
            alt=""
            aria-hidden
            className={cn(
              "absolute inset-0 h-full w-full scale-[1.02] object-contain blur-sm transition-opacity duration-300",
              fullLoaded ? "opacity-0" : "opacity-100",
            )}
          />
          <img
            src={asset.public_url}
            alt={asset.original_filename}
            onLoad={() => setFullLoaded(true)}
            className={cn(
              "absolute inset-0 h-full w-full object-contain transition-opacity duration-300",
              fullLoaded ? "opacity-100" : "opacity-0",
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-5 py-3">
          {view === "bin" ? (
            <>
              <Button variant="outline" onClick={() => onRestore(asset)}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                {t("media.restore", { defaultValue: "Restore" })}
              </Button>
              <Button
                variant="ghost"
                className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onHardDelete(asset)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {t("media.deleteForever", { defaultValue: "Delete forever" })}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onDownload(asset)}>
                <Download className="mr-1.5 h-4 w-4" />
                {t("media.download", { defaultValue: "Download" })}
              </Button>
              <Button variant="outline" onClick={() => onCopy(asset)}>
                {copied ? (
                  <Check className="mr-1.5 h-4 w-4 text-primary" />
                ) : (
                  <Copy className="mr-1.5 h-4 w-4" />
                )}
                {t("media.copyUrl", { defaultValue: "Copy image link" })}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => onToggleFavorite(asset)}
              >
                {asset.is_favorite ? (
                  <Star
                    className="mr-1.5 h-4 w-4 text-primary"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                ) : (
                  <Star className="mr-1.5 h-4 w-4" />
                )}
                {asset.is_favorite
                  ? t("media.unfavorite", {
                      defaultValue: "Remove from favourites",
                    })
                  : t("media.favorite", { defaultValue: "Add to favourites" })}
              </Button>
              <Button
                variant="ghost"
                className="ml-auto text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => onMoveToBin(asset)}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                {t("media.moveToBinConfirm", { defaultValue: "Move to bin" })}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
