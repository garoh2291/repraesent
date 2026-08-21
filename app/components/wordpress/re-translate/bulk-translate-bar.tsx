import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Sparkles, X } from "lucide-react";
import type {
  ReTranslateBulkState,
  ReTranslateMode,
  ReTranslateSettings,
} from "~/lib/wordpress/plugin-settings-types";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  refetchTranslateContentLists,
  useRunTranslateBulk,
} from "~/lib/hooks/useWorkspaceReTranslate";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
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
import {
  flash,
  languageDisplayName,
  languageFlag,
} from "./constants";

/**
 * Consecutive failures of one batch before the run gives up. The API banks
 * every finished chunk, so retrying costs a few seconds, never the run.
 */
const MAX_BATCH_RETRIES = 4;

/** How long the finished-run summary stays on screen before clearing itself. */
const COMPLETE_NOTICE_MS = 8_000;

const IDLE_BULK: ReTranslateBulkState = {
  status: "idle",
  languages: [],
  total: 0,
  processed: 0,
  failed: 0,
  current: null,
  recent: [],
  last_error: "",
  started_at: "",
  updated_at: "",
};

export function BulkTranslateBar({
  settings,
  pluginUuid,
  onCountersChanged,
}: {
  settings: ReTranslateSettings;
  pluginUuid: string;
  /** Run finished — re-read the server's translation counters. */
  onCountersChanged?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const bulk = settings.bulk ?? IDLE_BULK;
  const running = bulk.status === "running";
  const progress =
    bulk.total > 0 ? Math.round((bulk.processed / bulk.total) * 100) : 0;

  const bulkMutation = useRunTranslateBulk(pluginUuid);
  const runBatch = useRef(bulkMutation.mutateAsync);
  runBatch.current = bulkMutation.mutateAsync;
  // Held in a ref so a caller's inline closure cannot re-fire the effect below.
  const onCountersRef = useRef(onCountersChanged);
  onCountersRef.current = onCountersChanged;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<ReTranslateMode>("empty_only");
  const [bulkError, setBulkError] = useState<string | null>(null);
  /** Consecutive failures of the current batch; reset by the next success. */
  const [retries, setRetries] = useState(0);
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

  const canStart =
    Boolean(settings.has_machine_translate) &&
    !settings.kill_switch &&
    settings.languages.length > 0 &&
    !running;

  useEffect(() => {
    if (running) sawRunning.current = true;
  }, [running]);

  /*
   * One batch is in flight at a time, scheduled only once the previous has
   * returned. A run spans hundreds of batches on a large site, so a single
   * hiccup — a slow page, a blip from the translation service — is retried with
   * a backoff rather than ending the whole thing. Progress is saved per batch,
   * so a retry resumes where the failed one stopped.
   */
  useEffect(() => {
    if (!running || bulkError) return undefined;

    let cancelled = false;
    const delay =
      retries > 0 ? Math.min(2000 * 2 ** (retries - 1), 15_000) : 600;

    const timer = window.setTimeout(() => {
      runBatch
        .current({ action: "batch" })
        .then(() => {
          if (!cancelled) setRetries(0);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          const message = extractErrorMessage(err);
          if (retries + 1 >= MAX_BATCH_RETRIES) {
            setBulkError(message);
            flash(message, "error");
            return;
          }
          setRetries(retries + 1);
        });
    }, delay);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [running, bulkError, bulk.processed, bulk.updated_at, retries]);

  useEffect(() => {
    if (bulk.status === "idle") {
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
    flash(
      t(
        "wordpress.reTranslate.bulkComplete",
        "Site translation finished. {{done}} items done{{failed}}.",
        {
          done: bulk.processed,
          failed:
            bulk.failed > 0
              ? t(
                  "wordpress.reTranslate.bulkFailedSuffix",
                  ", {{count}} failed",
                  { count: bulk.failed },
                )
              : "",
        },
      ),
    );
    void refetchTranslateContentLists(queryClient, pluginUuid);
    onCountersRef.current?.();
  }, [
    bulk.status,
    bulk.processed,
    bulk.failed,
    bulk.updated_at,
    bulk.started_at,
    pluginUuid,
    queryClient,
    t,
  ]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  function openDialog() {
    setSelected(settings.languages.map((l) => l.code));
    setMode("empty_only");
    setDialogOpen(true);
  }

  function toggleLanguage(code: string, checked: boolean) {
    setSelected((prev) =>
      checked ? [...new Set([...prev, code])] : prev.filter((c) => c !== code),
    );
  }

  function handleStart() {
    if (selected.length === 0) return;
    setBulkError(null);
    setRetries(0);
    setShowComplete(false);
    setDialogOpen(false);
    // Arm before mutate so an immediate empty-queue `complete` still toasts.
    sawRunning.current = true;
    bulkMutation.mutate(
      { action: "start", languages: selected, mode },
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
          setRetries(0);
          flash(
            t("wordpress.reTranslate.bulkCancelled", "Bulk translation cancelled."),
          );
          // Whatever the run managed before the cancel still counts.
          onCountersRef.current?.();
        },
        onError: (err) => flash(extractErrorMessage(err), "error"),
      },
    );
  }

  if (!settings.has_machine_translate) return null;

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
          {t("wordpress.reTranslate.bulkTranslateSite", "Translate site")}
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
            {t("wordpress.reTranslate.bulkCancel", "Cancel")}
          </Button>
        ) : null}
      </div>

      {running || (bulk.status === "complete" && showComplete) ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {running
                ? t(
                    "wordpress.reTranslate.bulkInProgress",
                    "Translating the site…",
                  )
                : t(
                    "wordpress.reTranslate.bulkFinished",
                    "Bulk translation complete",
                  )}
            </p>
            <span className="text-xs tabular-nums text-muted-foreground">
              {bulk.processed.toLocaleString()} / {bulk.total.toLocaleString()}
              {bulk.failed > 0
                ? ` · ${t("wordpress.reTranslate.bulkFailed", "{{count}} failed", { count: bulk.failed })}`
                : ""}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
          {running && bulk.current ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "wordpress.reTranslate.bulkCurrent",
                "Translating: {{title}} · {{lang}}",
                {
                  title: bulk.current.title || `#${bulk.current.id}`,
                  lang: bulk.current.language.toUpperCase(),
                },
              )}
            </p>
          ) : null}
          {bulk.languages.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {bulk.languages.map((code) => (
                <Badge key={code} variant="secondary" className="font-normal">
                  {code.toUpperCase()}
                </Badge>
              ))}
            </div>
          ) : null}
          {retries > 0 && !bulkError ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "wordpress.reTranslate.bulkRetrying",
                "Hit a snag — retrying (attempt {{attempt}} of {{max}}). Finished strings are already saved.",
                { attempt: retries, max: MAX_BATCH_RETRIES },
              )}
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
              <Languages className="size-4" />
              {t(
                "wordpress.reTranslate.bulkPickLanguages",
                "Choose languages to translate",
              )}
            </DialogTitle>
            <DialogDescription>
              {t(
                "wordpress.reTranslate.bulkPickLanguagesHelp",
                "Machine-translate content into the selected languages. This can take a while on large sites.",
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium">
              {t(
                "wordpress.reTranslate.translateMode",
                "What should we translate?",
              )}
            </p>
            <RadioGroup
              value={mode}
              onValueChange={(value) => setMode(value as ReTranslateMode)}
              className="gap-2"
            >
              <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 hover:bg-muted/40">
                <RadioGroupItem
                  value="empty_only"
                  id="bulk-mode-empty"
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <Label
                    htmlFor="bulk-mode-empty"
                    className="cursor-pointer font-medium"
                  >
                    {t(
                      "wordpress.reTranslate.modeEmptyOnly",
                      "Only empty fields",
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "wordpress.reTranslate.modeEmptyOnlyHelp",
                      "Fill fields that were left blank. Existing translations stay as they are.",
                    )}
                  </p>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 hover:bg-muted/40">
                <RadioGroupItem
                  value="overwrite"
                  id="bulk-mode-overwrite"
                  className="mt-0.5"
                />
                <span className="min-w-0 flex-1">
                  <Label
                    htmlFor="bulk-mode-overwrite"
                    className="cursor-pointer font-medium"
                  >
                    {t(
                      "wordpress.reTranslate.modeOverwrite",
                      "Re-translate everything",
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "wordpress.reTranslate.modeOverwriteHelp",
                      "Overwrite existing translations too, not only empty fields.",
                    )}
                  </p>
                </span>
              </label>
            </RadioGroup>
          </div>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelected(settings.languages.map((l) => l.code))
              }
            >
              {t("wordpress.reTranslate.selectAll", "Select all")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelected([])}
            >
              {t("wordpress.reTranslate.clear", "Clear")}
            </Button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {settings.languages.map((lang) => {
              const checked = selected.includes(lang.code);
              return (
                <label
                  key={lang.code}
                  className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-muted/40"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleLanguage(lang.code, value === true)
                    }
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    {languageFlag(lang.code)}{" "}
                    {languageDisplayName(lang.code, lang.label)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {lang.code.toUpperCase()}
                  </span>
                </label>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              {t("wordpress.reTranslate.cancel", "Cancel")}
            </Button>
            <Button
              type="button"
              disabled={selected.length === 0 || bulkMutation.isPending}
              onClick={handleStart}
            >
              {bulkMutation.isPending ? (
                <Spinner className="size-3.5" />
              ) : null}
              {t(
                "wordpress.reTranslate.bulkStart",
                "Translate {{count}} language(s)",
                { count: selected.length },
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
