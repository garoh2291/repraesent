import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, Sparkles, X } from "lucide-react";
import type {
  ReTranslateBulkState,
  ReTranslateMode,
  ReTranslateSettings,
} from "~/lib/wordpress/plugin-settings-types";
import {
  bulkItemLanguage,
  bulkLanguages,
} from "~/lib/wordpress/plugin-settings-types";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  useRunTranslateBulk,
  useTranslateBulkStatus,
} from "~/lib/hooks/useWorkspaceReTranslate";
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
import { flash, languageDisplayName, languageFlag } from "./constants";
import { cn } from "~/lib/utils";

/** How one language's job ended, at a glance. */
function languageBadgeClass(status: string): string {
  switch (status) {
    case "failed":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "complete":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "cancelled":
      return "text-muted-foreground";
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-800 dark:text-sky-300";
  }
}

/** How long the finished-run summary stays on screen before clearing itself. */
const COMPLETE_NOTICE_MS = 8_000;

const IDLE_BULK: ReTranslateBulkState = {
  status: "idle",
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
 * Start and watch a site-wide machine translation.
 *
 * This used to run the translation: an effect fired one batch, waited for it,
 * and fired the next, so the run existed only as long as the tab did. Closing
 * it, refreshing, or navigating away stopped the work halfway and left the job
 * marked running with nobody to finish it.
 *
 * The run now belongs to the API — it is queued in Postgres and drained by the
 * scheduler — and this component only starts it, cancels it, and polls for
 * progress. Come back an hour later on another machine and the bar shows the
 * same run, still moving.
 */
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
  const bulkQuery = useTranslateBulkStatus(pluginUuid, settings.bulk);
  const bulk = bulkQuery.data ?? settings.bulk ?? IDLE_BULK;
  /** Accepted, but the API is still working out what needs translating. */
  const preparing = bulk.status === "queued";
  /*
   * A run is accepted as `queued` and the API's scheduler moves it to
   * `running` on its next tick, five seconds later. Still queued minutes on is
   * therefore not a slow start — it is nobody picking it up, because no
   * scheduler is running against this database.
   *
   * The server cannot report that: the watchdog that would notice lives inside
   * the scheduler, so when the scheduler is the thing that is missing, so is
   * the warning. Only the client can see time passing here.
   */
  const queuedSince = preparing ? Date.parse(bulk.updated_at || "") : NaN;
  const unclaimed =
    Number.isFinite(queuedSince) && Date.now() - queuedSince > 3 * 60 * 1000;
  const running = preparing || bulk.status === "running";
  /*
   * A finished run that saved nothing is not a finished run, whatever the
   * progress bar says. It is the shape a site-wide failure takes once every
   * page has been visited and every page has failed, and calling it "complete"
   * is what sent someone looking at their site wondering why it was still in
   * one language.
   */
  const wroteNothing =
    !running && bulk.total > 0 && (bulk.written ?? 0) === 0;
  const progress =
    bulk.total > 0 ? Math.round((bulk.processed / bulk.total) * 100) : 0;

  const bulkMutation = useRunTranslateBulk(pluginUuid);
  // Held in a ref so a caller's inline closure cannot re-fire the effect below.
  const onCountersRef = useRef(onCountersChanged);
  onCountersRef.current = onCountersChanged;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<ReTranslateMode>("empty_or_stale");
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

  const blockedBySeo = bulk.blocked_by === "seo_optimize";
  const canStart =
    Boolean(settings.has_machine_translate) &&
    !settings.kill_switch &&
    settings.languages.length > 0 &&
    !running &&
    !blockedBySeo;

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
    if (
      (bulk.status !== "complete" && bulk.status !== "failed") ||
      !sawRunning.current
    ) {
      return;
    }
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
    // List badges and language % are refreshed by `useWatchTranslateBulkCompletion`
    // on the settings page, which stays mounted across tabs.
  }, [bulk.status, bulk.updated_at, bulk.started_at]);

  useEffect(() => () => window.clearTimeout(hideTimer.current), []);

  // A run records why it stopped; surface that rather than making someone go
  // looking for it. This is the only place a site-wide failure is ever shown.
  useEffect(() => {
    if (bulk.last_error) setBulkError(bulk.last_error);
  }, [bulk.last_error]);

  function openDialog() {
    setSelected(settings.languages.map((l) => l.code));
    setMode("empty_or_stale");
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
          flash(
            t(
              "wordpress.reTranslate.bulkCancelled",
              "Bulk translation cancelled.",
            ),
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

      {blockedBySeo && !running ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "wordpress.reTranslate.blockedBySeo",
            "A site-wide SEO optimization is already running. Wait for it to finish, or cancel it from SEO Optimization.",
          )}
        </p>
      ) : null}

      {running ||
      ((bulk.status === "complete" || bulk.status === "failed") &&
        showComplete) ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              {preparing
                ? unclaimed
                  ? t(
                      "wordpress.reTranslate.bulkUnclaimed",
                      "Waiting — nothing has picked this run up yet. The translation worker may not be running.",
                    )
                  : t(
                      "wordpress.reTranslate.bulkPreparing",
                      "Working out what needs translating…",
                    )
                : running
                  ? t(
                      "wordpress.reTranslate.bulkInProgress",
                      "Translating the site…",
                    )
                  : /*
                     * Order matters. A failed run also has `total === 0` when
                     * it could not build a queue at all, and reading that as
                     * "everything is already filled" is exactly the sentence
                     * that was shown over an untranslated site.
                     */
                    bulk.status === "failed"
                    ? t(
                        "wordpress.reTranslate.bulkFailed",
                        "The translation run could not finish.",
                      )
                    : bulk.total === 0
                      ? t(
                          "wordpress.reTranslate.bulkNothingToTranslate",
                          "Nothing needs translating — all selected fields are already filled.",
                        )
                      : wroteNothing
                        ? t(
                            "wordpress.reTranslate.bulkWroteNothing",
                            "Finished without translating anything — see the error below.",
                          )
                        : t(
                            "wordpress.reTranslate.bulkFinishedCount",
                            "Bulk translation complete — {{written}} fields translated",
                            { written: bulk.written ?? 0 },
                          )}
            </p>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t(
                "wordpress.reTranslate.bulkProgressPages",
                "{{done}} / {{total}} pages",
                { done: bulk.processed, total: bulk.total },
              )}
            </span>
          </div>
          <Progress value={progress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">
            {t(
              "wordpress.reTranslate.bulkRunsOnServer",
              "This runs on our servers — you can close this page and come back to it.",
            )}
          </p>
          {running && bulk.current ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "wordpress.reTranslate.bulkCurrent",
                "Translating: {{title}} · {{lang}}",
                {
                  title: bulk.current.title || `#${bulk.current.id}`,
                  lang: bulkItemLanguage(bulk.current).toUpperCase(),
                },
              )}
            </p>
          ) : null}
          {/*
            * Each language is its own job, so each has its own outcome. A row
            * of plain codes hid the case the split exists for: German
            * finishing while French failed, summed into totals that look like
            * a run that worked.
            */}
          {bulk.languages && bulk.languages.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {bulk.languages.map((row) => (
                <Badge
                  key={row.language || row.status}
                  variant="outline"
                  className={cn("font-normal", languageBadgeClass(row.status))}
                  title={
                    row.last_error ||
                    `${row.processed}/${row.total}${row.failed ? ` · ${row.failed} failed` : ""}`
                  }
                >
                  {(row.language || bulk.kind || "").toUpperCase()}
                  {row.total > 0 ? ` ${row.processed}/${row.total}` : ""}
                </Badge>
              ))}
            </div>
          ) : bulkLanguages(bulk).length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {bulkLanguages(bulk).map((code) => (
                <Badge key={code} variant="secondary" className="font-normal">
                  {code.toUpperCase()}
                </Badge>
              ))}
            </div>
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
                  value="empty_or_stale"
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
                      "Empty and outdated fields",
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "wordpress.reTranslate.modeEmptyOnlyHelp",
                      "Fill fields that were left blank, and refresh translations whose source text has changed since. Up-to-date translations stay as they are.",
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
              onClick={() => setSelected(settings.languages.map((l) => l.code))}
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
              {bulkMutation.isPending ? <Spinner className="size-3.5" /> : null}
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
