import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ImageIcon, Loader2, Search } from "lucide-react";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import type { WpMediaItem } from "~/lib/api/wordpress-hub";
import { useWorkspaceWpMediaInfinite } from "~/lib/hooks/useWorkspaceWpMedia";
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

/**
 * Pick an existing image from the workspace WordPress media library.
 * Upload still happens in wp-admin; this mirrors the library select half of
 * the plugin's wp.media frame. Scrolling near the bottom loads more pages.
 */
export function MediaLibraryPicker({
  open,
  onOpenChange,
  selectedId,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedId: number;
  onSelect: (item: WpMediaItem) => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [draftSearch, setDraftSearch] = useState("");
  const [picked, setPicked] = useState<WpMediaItem | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setDraftSearch("");
    setPicked(null);
  }, [open]);

  const mediaQuery = useWorkspaceWpMediaInfinite(open, { search });

  const items = useMemo(
    () => mediaQuery.data?.pages.flatMap((p) => p.items) ?? [],
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
    items.length,
  ]);

  function applySearch() {
    setSearch(draftSearch.trim());
  }

  function confirm() {
    if (!picked) return;
    onSelect(picked);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 sm:px-6">
          <DialogTitle>
            {t("wordpress.reIndex.mediaTitle", "Media library")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "wordpress.reIndex.mediaDesc",
              "Choose an image already uploaded to this WordPress site. Recommended size: 1200 × 630 px.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 border-b px-5 py-3 sm:px-6">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={draftSearch}
              onChange={(e) => setDraftSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") applySearch();
              }}
              placeholder={t(
                "wordpress.reIndex.mediaSearch",
                "Search images…",
              )}
              className="pl-8"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={applySearch}
          >
            {t("wordpress.reIndex.mediaSearchBtn", "Search")}
          </Button>
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6"
        >
          {mediaQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("wordpress.reIndex.mediaLoading", "Loading media…")}
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {loadError}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-medium">
                {t("wordpress.reIndex.mediaEmpty", "No images found")}
              </p>
              <p className="max-w-sm text-xs text-muted-foreground">
                {t(
                  "wordpress.reIndex.mediaEmptyHint",
                  "Upload images in WordPress Media Library, then pick them here.",
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                {items.map((item) => {
                  const isPicked = picked?.id === item.id;
                  const isCurrent =
                    picked == null && item.id === selectedId && selectedId > 0;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPicked(item)}
                      className={cn(
                        "group relative aspect-[1.2] overflow-hidden rounded-lg border bg-muted text-left outline-none transition",
                        isPicked || isCurrent
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-foreground/30",
                      )}
                      title={item.title}
                    >
                      <img
                        src={item.thumb_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {(isPicked || isCurrent) && (
                        <span className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-1 text-[10px] text-white opacity-0 transition group-hover:opacity-100">
                        {item.title}
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
            {t("wordpress.reIndex.mediaCancel", "Cancel")}
          </Button>
          <Button type="button" disabled={!picked} onClick={confirm}>
            {t("wordpress.reIndex.mediaUse", "Use image")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
