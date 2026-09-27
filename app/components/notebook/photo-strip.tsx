import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog as DialogPrimitive } from "radix-ui";
import { animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import { Camera, ChevronLeft, ChevronRight, ImagePlus, Trash2, XIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { getStoredWorkspaceId, extractErrorMessage } from "~/lib/api/axios-instance";
import {
  addPhoto,
  deletePhoto,
  listPhotos,
  restorePhoto,
  updatePhotoCaption,
  type Photo,
  type PhotoEntity,
  type PhotoList,
} from "~/lib/api/entity-photos";
import { enqueueMediaUpload, type QueuedUploadStage } from "~/lib/media/upload-queue";
import { MediaUploadError } from "~/lib/media/upload";
import { useIsCoarsePointer } from "~/lib/hooks/use-is-phone";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const STAGE_PROGRESS: Record<QueuedUploadStage, number> = {
  queued: 0.06,
  validating: 0.15,
  processing: 0.3,
  uploading: 0.65,
  confirming: 0.9,
};

interface PendingPhoto {
  key: string;
  preview: string;
  progress: number;
}

export function photosKey(entity: PhotoEntity, entityId: string) {
  return ["entity-photos", getStoredWorkspaceId(), entity, entityId] as const;
}

/**
 * Photos on a deal or contact, for the team only (MOBILE_PACKAGE_PLAN.md C3):
 * take one on site or pick from the gallery, see them in a strip, open one
 * full screen. Never on the public tracking page. Renders nothing until the
 * server has the feature (`ready`).
 */
export function PhotoStrip({
  entity,
  entityId,
  canEdit,
  className,
}: {
  entity: PhotoEntity;
  entityId: string;
  canEdit: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const coarse = useIsCoarsePointer();
  const key = photosKey(entity, entityId);
  const q = useQuery({
    queryKey: key,
    queryFn: () => listPhotos(entity, entityId),
    enabled: !!entityId,
    staleTime: 60_000,
    retry: 1,
  });
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const [viewer, setViewer] = useState<number | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  // Object URLs of the instant previews are freed when the strip goes away.
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(() => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.preview)), []);

  const uploadErrorText = useCallback(
    (err: unknown) => {
      if (err instanceof MediaUploadError) {
        return err.message.includes("MB")
          ? t("photos.errors.tooBig", "That photo is over 10 MB. Pick a smaller one.")
          : t("photos.errors.type", "That file isn't a photo we can use (JPEG, PNG, GIF or WebP).");
      }
      // The direct upload to storage failed at the network level ("Failed to
      // fetch" / "Load failed"): usually storage doesn't accept this address.
      if (err instanceof TypeError) {
        return t(
          "photos.errors.network",
          "The photo couldn't be uploaded from this address. Try again, or use the app at its normal address.",
        );
      }
      return extractErrorMessage(err) || t("photos.errors.upload", "The photo didn't upload. Try again.");
    },
    [t],
  );

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      const pkey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const preview = URL.createObjectURL(file);
      setPending((p) => [...p, { key: pkey, preview, progress: 0.04 }]);
      const drop = () => {
        URL.revokeObjectURL(preview);
        setPending((p) => p.filter((x) => x.key !== pkey));
      };
      enqueueMediaUpload({
        file,
        onStage: (stage) =>
          setPending((p) => p.map((x) => (x.key === pkey ? { ...x, progress: STAGE_PROGRESS[stage] } : x))),
        onDone: (asset) => {
          addPhoto(entity, entityId, { media_asset_id: asset.id })
            .then((photo) => {
              qc.setQueryData<PhotoList>(key, (old) =>
                old ? { ...old, items: [...old.items, photo] } : old,
              );
            })
            .catch((err) => toast.error(uploadErrorText(err)))
            .finally(drop);
        },
        onError: (err) => {
          drop();
          toast.error(uploadErrorText(err));
        },
      });
    }
  };

  if (!q.data?.ready) return null;
  const items = q.data.items;
  const count = items.length;

  const inputs = canEdit ? (
    <>
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  ) : null;

  const actionClass =
    "press inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:border-foreground/30 hover:bg-accent pointer-coarse:h-11";

  return (
    <section className={cn("space-y-2.5", className)} aria-label={t("photos.title", "Photos")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-foreground">
          {t("photos.title", "Photos")}
          {count > 0 ? <span className="num ml-1.5 font-normal text-muted-foreground">{count}</span> : null}
        </h3>
        {canEdit ? (
          <div className="flex items-center gap-1.5">
            {coarse ? (
              <button type="button" className={actionClass} onClick={() => cameraRef.current?.click()}>
                <Camera className="size-4" aria-hidden />
                {t("photos.take", "Take photo")}
              </button>
            ) : null}
            <button type="button" className={actionClass} onClick={() => galleryRef.current?.click()}>
              <ImagePlus className="size-4" aria-hidden />
              {coarse ? t("photos.gallery", "From gallery") : t("photos.add", "Add photos")}
            </button>
          </div>
        ) : null}
      </div>
      {inputs}

      {count === 0 && pending.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">
          {canEdit
            ? t("photos.empty", "No photos yet. Add one from the site or your gallery — only your team sees them.")
            : t("photos.emptyViewer", "No photos yet.")}
        </p>
      ) : (
        <ul className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          {items.map((p, i) => (
            <li key={p.id} className="snap-start">
              <button
                type="button"
                onClick={() => setViewer(i)}
                className="press block size-[72px] overflow-hidden rounded-lg border border-border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                aria-label={p.caption || t("photos.open", "Open photo {{n}}", { n: i + 1 })}
              >
                <img
                  src={p.thumb_url || p.url}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                  draggable={false}
                />
              </button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="snap-start">
              <div
                className="relative size-[72px] overflow-hidden rounded-lg border border-border bg-muted"
                role="status"
                aria-label={t("photos.uploading", "Uploading…")}
              >
                <img src={p.preview} alt="" className="size-full object-cover opacity-60" draggable={false} />
                <ProgressRing value={p.progress} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <PhotoViewer
        items={items}
        index={viewer}
        onIndexChange={setViewer}
        canEdit={canEdit}
        queryKey={key}
      />
    </section>
  );
}

function ProgressRing({ value }: { value: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 36 36" className="absolute left-1/2 top-1/2 size-9 -translate-x-1/2 -translate-y-1/2" aria-hidden>
      <circle cx="18" cy="18" r={r} fill="rgba(20,21,22,0.45)" stroke="rgba(245,244,241,0.35)" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r={r}
        fill="none"
        stroke="#f5f4f1"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - value)}
        transform="rotate(-90 18 18)"
        style={{ transition: "stroke-dashoffset 300ms cubic-bezier(0.23,1,0.32,1)" }}
      />
    </svg>
  );
}

// ─── Full-screen viewer ────────────────────────────────────────────────────

function PhotoViewer({
  items,
  index,
  onIndexChange,
  canEdit,
  queryKey,
}: {
  items: Photo[];
  index: number | null;
  onIndexChange: (i: number | null) => void;
  canEdit: boolean;
  queryKey: readonly unknown[];
}) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const reduced = useReducedMotion();
  const open = index !== null && items.length > 0;
  const i = Math.min(index ?? 0, Math.max(0, items.length - 1));
  const photo = open ? items[i] : null;

  const trackRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const width = () => trackRef.current?.clientWidth || window.innerWidth;
  const drag = useRef<{ id: number; x0: number; y0: number; active: boolean; base: number } | null>(null);

  // Keep the track on the current photo (snap on open, spring when paging).
  const settle = useCallback(
    (to: number, velocity = 0) => {
      const target = -to * width();
      if (reduced) x.set(target);
      else animate(x, target, { type: "spring", stiffness: 420, damping: 42, velocity });
    },
    [reduced, x],
  );
  useEffect(() => {
    if (open) x.set(-i * width());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Rotating the phone changes the width: stay on the same photo.
  useEffect(() => {
    if (!open) return;
    const onResize = () => x.set(-i * width());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, i]);

  const go = (to: number, velocity = 0) => {
    const next = Math.max(0, Math.min(items.length - 1, to));
    onIndexChange(next);
    settle(next, velocity);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") go(i + 1);
      if (e.key === "ArrowLeft") go(i - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Swipe: 10 px before it counts (so taps stay taps), 1:1 tracking,
  // rubber-band past the ends, flick or 20 % of the width pages.
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" || items.length < 2) return;
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, active: false, base: -i * width() };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x0;
    const dy = e.clientY - d.y0;
    if (!d.active) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        drag.current = null;
        return;
      }
      if (Math.abs(dx) < 10) return;
      d.active = true;
      d.x0 += dx > 0 ? 10 : -10;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    let off = e.clientX - d.x0;
    const atStart = i === 0 && off > 0;
    const atEnd = i === items.length - 1 && off < 0;
    if (atStart || atEnd) off *= 0.3;
    x.set(d.base + off);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !d.active || d.id !== e.pointerId) return;
    const off = x.get() - d.base;
    const v = x.getVelocity();
    const w = width();
    if ((off < -w * 0.2 || v < -500) && i < items.length - 1) go(i + 1, v);
    else if ((off > w * 0.2 || v > 500) && i > 0) go(i - 1, v);
    else settle(i, v);
  };

  const [caption, setCaption] = useState("");
  useEffect(() => setCaption(photo?.caption ?? ""), [photo?.id, photo?.caption]);

  const saveCaption = async () => {
    if (!photo) return;
    const next = caption.trim();
    if (next === (photo.caption ?? "")) return;
    try {
      const saved = await updatePhotoCaption(photo.id, next || null);
      qc.setQueryData<PhotoList>(queryKey, (old) =>
        old ? { ...old, items: old.items.map((p) => (p.id === saved.id ? saved : p)) } : old,
      );
      toast.success(t("photos.captionSaved", "Caption saved"));
    } catch (err) {
      toast.error(extractErrorMessage(err) || t("photos.errors.caption", "The caption didn't save. Try again."));
    }
  };

  const remove = async () => {
    if (!photo) return;
    const gone = photo;
    const before = qc.getQueryData<PhotoList>(queryKey);
    qc.setQueryData<PhotoList>(queryKey, (old) =>
      old ? { ...old, items: old.items.filter((p) => p.id !== gone.id) } : old,
    );
    if (items.length <= 1) onIndexChange(null);
    else {
      const next = Math.min(i, items.length - 2);
      onIndexChange(next);
      x.set(-next * width());
    }
    try {
      await deletePhoto(gone.id);
      toast.success(t("photos.deleted", "Photo deleted"), {
        duration: 8000, // Undo needs time on a phone (5–8 s guidance).
        action: {
          label: t("common.undo", "Undo"),
          onClick: () => {
            restorePhoto(gone.id)
              .then(() => void qc.invalidateQueries({ queryKey }))
              .catch((err) => toast.error(extractErrorMessage(err) || t("common.error", "Something went wrong")));
          },
        },
      });
    } catch (err) {
      if (before) qc.setQueryData(queryKey, before);
      toast.error(extractErrorMessage(err) || t("photos.errors.delete", "The photo wasn't deleted. Try again."));
    }
  };

  const when = photo
    ? new Intl.DateTimeFormat(i18n.language, { day: "numeric", month: "short" }).format(new Date(photo.created_at))
    : "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#141516]/95 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-0 z-50 flex flex-col text-[#f5f4f1] outline-none",
            "sm:inset-6 sm:rounded-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] duration-200 motion-reduce:animate-none",
          )}
        >
          <DialogPrimitive.Title className="sr-only">{t("photos.title", "Photos")}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            {t("photos.viewerHint", "Swipe or use the arrow keys to see the other photos.")}
          </DialogPrimitive.Description>

          <div className="flex items-center justify-between gap-2 px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <DialogPrimitive.Close
              className="press flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              aria-label={t("common.close", "Close")}
            >
              <XIcon className="size-5" />
            </DialogPrimitive.Close>
            <span className="num text-[13px] text-white/70">
              {t("photos.position", "{{n}} of {{total}}", { n: i + 1, total: items.length })}
            </span>
            {canEdit ? (
              <button
                type="button"
                onClick={() => void remove()}
                className="press flex size-11 items-center justify-center rounded-full hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                aria-label={t("photos.delete", "Delete photo")}
              >
                <Trash2 className="size-5" />
              </button>
            ) : (
              <span className="size-11" aria-hidden />
            )}
          </div>

          <div
            ref={trackRef}
            className="relative min-h-0 flex-1 touch-pan-y overflow-hidden select-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <motion.div className="flex h-full" style={{ x }}>
              {items.map((p, n) => (
                <div key={p.id} className="flex h-full w-full shrink-0 items-center justify-center px-2">
                  {Math.abs(n - i) <= 1 ? (
                    <img
                      src={p.url}
                      alt={p.caption || ""}
                      draggable={false}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : null}
                </div>
              ))}
            </motion.div>
            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => go(i - 1)}
                  disabled={i === 0}
                  className="absolute left-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 sm:flex"
                  aria-label={t("photos.prev", "Previous photo")}
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => go(i + 1)}
                  disabled={i === items.length - 1}
                  className="absolute right-3 top-1/2 hidden size-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 disabled:opacity-30 sm:flex"
                  aria-label={t("photos.next", "Next photo")}
                >
                  <ChevronRight className="size-5" />
                </button>
              </>
            ) : null}
          </div>

          <motion.div
            key={photo?.id}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="space-y-1.5 px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
          >
            {canEdit ? (
              <input
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onBlur={() => void saveCaption()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                maxLength={500}
                placeholder={t("photos.captionPlaceholder", "Add a caption")}
                className="h-11 w-full rounded-lg border border-white/15 bg-white/5 px-3 text-base text-[#f5f4f1] placeholder:text-white/40 focus:border-white/40 focus:outline-none sm:text-sm"
              />
            ) : photo?.caption ? (
              <p className="text-[14px]">{photo.caption}</p>
            ) : null}
            <p className="text-[12px] text-white/55">
              {photo?.created_by_name
                ? t("photos.addedBy", "{{name}} · {{when}}", { name: photo.created_by_name, when })
                : when}
            </p>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
