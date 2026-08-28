import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, X } from "lucide-react";
import type {
  ReIndexSettings,
  ReTranslateBulkState,
} from "~/lib/wordpress/plugin-settings-types";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  pageSeoKey,
  useRunSeoOptimize,
  useSeoOptimizeStatus,
} from "~/lib/hooks/useWorkspaceReIndexSettings";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import { Progress } from "~/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import { Spinner } from "~/components/ui/spinner";
import { flash } from "./constants";

/** How long the finished-run summary stays on screen before clearing itself. */
const COMPLETE_NOTICE_MS = 8_000;

const IDLE_BULK: ReTranslateBulkState = {
  status: "idle",
  kind: "seo_optimize",
  blocked_by: "",
  params: {},
  total: 0,
  processed: 0,
  failed: 0,
  written: 0,
  current: null,
  recent: [],
  last_error: "",
  started_at: "",
  updated_at: "",
};

/**
 * Start and watch a site-wide SEO optimize run.
 *
 * Deliberately the same component as `BulkTranslateBar`, down to the button
 * size and the shape of the progress panel: they are the same feature pointed
 * at different work, they share one queue in the API, and only one of them can
 * be live on a site at a time. Two different-looking bars for that was a way
 * to make one product feel like two.
 *
 * The run belongs to the API — queued in the shared `wp_ai_jobs` table with
 * `kind=seo_optimize` and drained by the scheduler. This bar only starts it,
 * cancels it, and polls for progress, so closing the tab does not stop it.
 */
export function BulkSeoBar({
  settings,
  pluginUuid,
  onCountersChanged,
}: {
  settings: ReIndexSettings;
  pluginUuid: string;
  /** Run finished — re-read anything showing per-page SEO counts. */
  onCountersChanged?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const bulkQuery = useSeoOptimizeStatus(pluginUuid, settings.seo_bulk);
  const bulk = bulkQuery.data ?? settings.seo_bulk ?? IDLE_BULK;
  /** Accepted, but the API is still working out which pages need SEO. */
  const preparing = bulk.status === "queued";
  const running = preparing || bulk.status === "running";
  const progress =
    bulk.total > 0 ? Math.round((bulk.processed / bulk.total) * 100) : 0;

  const bulkMutation = useRunSeoOptimize(pluginUuid);
  // Held in a ref so a caller's inline closure cannot re-fire the effect below.
  const onCountersRef = useRef(onCountersChanged);
  onCountersRef.current = onCountersChanged;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<"empty_only" | "overwrite">("empty_only");
  /** A failed start or cancel, or the last error the run itself recorded. */
  const [bulkError, setBulkError] = useState<string | null>(
    bulk.last_error || null,
  );
  /**
   * The finished-run summary is a notice, not a permanent fixture: it appears
   * when a run this session ends and clears itself shortly after. A `complete`
   * status found on a cold load belongs to a run nobody here watched, so it
   * never shows at all.
   */
  const [showComplete, setShowComplete] = useState(false);
  const hideTimer = useRef<number | undefined>(undefined);
  /** Only toast/refetch when this session watched a run finish — not on cold load of a prior `complete`. */
  const sawRunning = useRef(false);
  const completedToastFor = useRef<string | null>(null);

  const blockedByTranslate = bulk.blocked_by === "translate";
  const canStart = !running && !blockedByTranslate;

  useEffect(() => {
    if (running) sawRunning.current = true;
  }, [running]);

  useEffect(() => {
    if (bulk.status === "idle" || bulk.status === "cancelled") {
      sawRunning.current = false;
      completedToastFor.current = null;
      setShowComplete(false);
      return;
    }
    if (bulk.status !== "complete" || !sawRunning.current) return;
    const key = bulk.updated_at || bulk.started_at;
    if (!key || completedToastFor.current === key) return;
    completedToastFor.current = key;
    sawRunning.current = false;
    setShowComplete(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(
      () => setShowComplete(false),
      COMPLETE_NOTICE_MS,
    );
    void queryClient.invalidateQueries({ queryKey: pageSeoKey(pluginUuid) });
    onCountersRef.current?.();
  }, [
    bulk.status,
    bulk.updated_at,
    bulk.started_at,
    pluginUuid,
    queryClient,
  ]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  // A run records why it stopped; surface that rather than making someone go
  // looking for it. This is the only place a site-wide failure is ever shown.
  useEffect(() => {
    if (bulk.last_error) setBulkError(bulk.last_error);
  }, [bulk.last_error]);

  function openDialog() {
    setMode("empty_only");
    setDialogOpen(true);
  }

  function handleStart() {
    setBulkError(null);
    setShowComplete(false);
    setDialogOpen(false);
    // Arm before mutate so an immediate empty-queue `complete` still notices.
    sawRunning.current = true;
    bulkMutation.mutate(
      { action: "start", mode },
      {
        onError: (err) => {
          sawRunning.current = false;
          const message = extractErrorMessage(err);
          setBulkError(message);
          flash(message, "error");
        },
      },
    );
  }

  function handleCancel() {
    bulkMutation.mutate(
      { action: "cancel" },
      {
        onSuccess: () => {
          setBulkError(null);
          flash(
            t(
              "wordpress.reIndex.seoOptimize.cancelled",
              "Optimize SEO cancelled.",
            ),
          );
          // Whatever the run managed before the cancel still counts.
          onCountersRef.current?.();
        },
        onError: (err) => flash(extractErrorMessage(err), "error"),
      },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={!canStart || bulkMutation.isPending}
          onClick={openDialog}
        >
          {bulkMutation.isPending && !running ? (
            <Spinner className="size-3.5" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {t("wordpress.reIndex.seoOptimize.button", "Optimize SEO")}
        </Button>
        {running ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={handleCancel}
          >
            <X className="size-3.5" />
            {t("wordpress.reIndex.seoOptimize.cancel", "Cancel")}
          </Button>
        ) : null}
      </div>

      {blockedByTranslate && !running ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "wordpress.reIndex.seoOptimize.blockedByTranslate",
            "A site-wide translation is already running. Wait for it to finish, or cancel it from Translations.",
          )}
        </p>
      ) : null}

      {running || (bulk.status === "complete" && showComplete) ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {preparing
                ? t(
                    "wordpress.reIndex.seoOptimize.preparing",
                    "Working out which pages need SEO…",
                  )
                : running
                  ? t(
                      "wordpress.reIndex.seoOptimize.inProgress",
                      "Optimizing SEO…",
                    )
                  : bulk.total === 0
                    ? t(
                        "wordpress.reIndex.seoOptimize.nothingToDo",
                        "Nothing to fill — every page already has SEO copy.",
                      )
                    : t(
                        "wordpress.reIndex.seoOptimize.finished",
                        "Optimize SEO complete",
                      )}
            </p>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t(
                "wordpress.reIndex.seoOptimize.progressPages",
                "{{done}} / {{total}} pages",
                { done: bulk.processed, total: bulk.total },
              )}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {t(
              "wordpress.reIndex.seoOptimize.runsOnServer",
              "This runs on our servers — you can close this page and come back to it.",
            )}
          </p>
          {running && bulk.current ? (
            <p className="text-xs text-muted-foreground">
              {t("wordpress.reIndex.seoOptimize.current", "Writing: {{title}}", {
                title: bulk.current.title || `#${bulk.current.id}`,
              })}
            </p>
          ) : null}
          {bulkError ? (
            <p className="text-xs text-destructive">{bulkError}</p>
          ) : null}
        </div>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4" />
              {t("wordpress.reIndex.seoOptimize.dialogTitle", "Optimize SEO")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "wordpress.reIndex.seoOptimize.dialogHelp",
                "Fill SEO titles and descriptions for every page, plus the site tagline, homepage description, and social description. Does not change images, robots flags, or verification codes.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t(
                "wordpress.reIndex.seoOptimize.whatToFill",
                "What should we fill?",
              )}
            </p>
            <RadioGroup
              value={mode}
              onValueChange={(value) =>
                setMode(value === "overwrite" ? "overwrite" : "empty_only")
              }
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 hover:bg-muted/40">
                <RadioGroupItem
                  value="empty_only"
                  id="seo-opt-mode-empty"
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <Label
                    htmlFor="seo-opt-mode-empty"
                    className="cursor-pointer font-medium"
                  >
                    {t(
                      "wordpress.reIndex.seoOptimize.modeEmptyOnly",
                      "Only empty fields",
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "wordpress.reIndex.seoOptimize.modeEmptyOnlyHelp",
                      "Fill fields that were left blank. Existing copy stays as it is.",
                    )}
                  </p>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 hover:bg-muted/40">
                <RadioGroupItem
                  value="overwrite"
                  id="seo-opt-mode-overwrite"
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <Label
                    htmlFor="seo-opt-mode-overwrite"
                    className="cursor-pointer font-medium"
                  >
                    {t(
                      "wordpress.reIndex.seoOptimize.modeOverwrite",
                      "Overwrite everything",
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "wordpress.reIndex.seoOptimize.modeOverwriteHelp",
                      "Replace existing SEO titles and descriptions too, not only empty fields.",
                    )}
                  </p>
                </span>
              </label>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {t("wordpress.reIndex.seoOptimize.dismiss", "Cancel")}
            </Button>
            <Button
              type="button"
              disabled={bulkMutation.isPending}
              onClick={handleStart}
            >
              {bulkMutation.isPending ? <Spinner className="size-3.5" /> : null}
              {t("wordpress.reIndex.seoOptimize.start", "Optimize SEO")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
