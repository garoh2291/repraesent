import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FileStack,
  Globe,
  PauseCircle,
  ScanLine,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import type { ReTranslateSettings } from "~/lib/wordpress/plugin-settings-types";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  useRunTranslateIndex,
  useSetTranslateSourceLanguage,
} from "~/lib/hooks/useWorkspaceReTranslate";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { Progress } from "~/components/ui/progress";
import { Spinner } from "~/components/ui/spinner";
import {
  CardHeader,
  FieldHint,
  InfoNote,
  SectionCard,
  ToggleField,
} from "~/components/wordpress/fields";
import {
  flash,
  LANGUAGE_CATALOG,
  languageName,
  normalizeLanguageCode,
  translatedPostTypeLabel,
  type PatchSettings,
} from "./constants";
import { cn } from "~/lib/utils";

/**
 * Settings tab: editable source language, index scan controls, kill switch,
 * content types, and uninstall behaviour. The source language select calls a
 * mutation (not patchSettings) because it re-keys the string index server-side.
 */
export function GeneralPanel({
  settings,
  patchSettings,
  pluginUuid,
  onCountersChanged,
}: {
  settings: ReTranslateSettings;
  patchSettings: PatchSettings;
  pluginUuid: string;
  /** Scan finished — re-read the server's translation counters. */
  onCountersChanged?: () => void;
}) {
  const { t } = useTranslation();

  const source = settings.source_language;
  const [optimisticSource, setOptimisticSource] = useState<string | null>(null);
  const displaySource = optimisticSource ?? normalizeLanguageCode(source);

  useEffect(() => {
    if (
      optimisticSource &&
      normalizeLanguageCode(source) === optimisticSource
    ) {
      setOptimisticSource(null);
    }
  }, [source, optimisticSource]);

  const index = settings.index;
  const scanning = index.status === "running";
  const scanned =
    index.total > 0 ? Math.round((index.processed / index.total) * 100) : 0;

  const sourceLanguageMutation = useSetTranslateSourceLanguage(pluginUuid);
  const indexMutation = useRunTranslateIndex(pluginUuid);

  /*
   * A failed batch halts the loop. Without this the panel retries a broken
   * scan forever — silently, since the batch call has no UI of its own.
   */
  const [scanError, setScanError] = useState<string | null>(null);

  // The mutation object is a new identity every render; the loop below needs a
  // stable reference or its timer would be torn down and re-armed constantly.
  const runBatch = useRef(indexMutation.mutateAsync);
  runBatch.current = indexMutation.mutateAsync;
  const onCountersRef = useRef(onCountersChanged);
  onCountersRef.current = onCountersChanged;

  /*
   * A finished scan changes the string totals every counter on the page is
   * derived from, so read them back once the loop settles. `sawScanning` keeps
   * a cold load of an already-complete scan from firing a pointless fetch.
   */
  const sawScanning = useRef(false);
  useEffect(() => {
    if (scanning) {
      sawScanning.current = true;
      return;
    }
    if (!sawScanning.current) return;
    sawScanning.current = false;
    onCountersRef.current?.();
  }, [scanning]);

  /*
   * The scan is driven from here rather than from WP-Cron, which on a quiet
   * site may not fire for minutes. One batch is in flight at a time: the next
   * is scheduled only once the previous has returned and moved the index on
   * (`updated_at` changes on every state write). A fixed interval would stack
   * overlapping batches whenever the site is slower than the tick.
   */
  useEffect(() => {
    if (!scanning || scanError) {
      return undefined;
    }

    let cancelled = false;

    const timer = setTimeout(() => {
      runBatch.current("batch").catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        const message = extractErrorMessage(err);
        setScanError(message);
        flash(message, "error");
      });
    }, 600);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanning, scanError, index.processed, index.updated_at]);

  function handleStartScan() {
    setScanError(null);
    indexMutation.mutate("start", {
      onError: (err) => {
        const message = extractErrorMessage(err);
        setScanError(message);
        flash(message, "error");
      },
    });
  }

  function handleCancelScan() {
    indexMutation.mutate("cancel", {
      onSuccess: () => {
        setScanError(null);
        flash(t("wordpress.reTranslate.scanCancelled", "Scan cancelled."));
      },
      onError: (err) => flash(extractErrorMessage(err), "error"),
    });
  }

  function handleChangeSource(code: string) {
    const normalized = normalizeLanguageCode(code);
    setOptimisticSource(normalized);

    const isTarget = settings.languages.some(
      (l) => normalizeLanguageCode(l.code) === normalized,
    );
    if (isTarget) {
      const ok = window.confirm(
        t(
          "wordpress.reTranslate.sourceIsTarget",
          "{{lang}} is currently a target language. Replace it as source?",
          { lang: languageName(code) },
        ),
      );
      if (!ok) {
        setOptimisticSource(null);
        return;
      }
      sourceLanguageMutation.mutate(
        { code: normalized, replaceTarget: true },
        {
          onSuccess: () =>
            flash(
              t("wordpress.reTranslate.sourceChanged", "Source language changed."),
            ),
          onError: (err) => {
            setOptimisticSource(null);
            flash(extractErrorMessage(err), "error");
          },
        },
      );
    } else {
      sourceLanguageMutation.mutate(
        { code: normalized },
        {
          onSuccess: () =>
            flash(
              t("wordpress.reTranslate.sourceChanged", "Source language changed."),
            ),
          onError: (err) => {
            setOptimisticSource(null);
            flash(extractErrorMessage(err), "error");
          },
        },
      );
    }
  }

  function togglePostType(name: string) {
    patchSettings((prev) => ({
      ...prev,
      post_types: prev.post_types.includes(name)
        ? prev.post_types.filter((v) => v !== name)
        : [...prev.post_types, name],
    }));
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<Globe className="size-3.5" />}
          title={t("wordpress.reTranslate.sourceTitle", "Website language")}
          subtitle={t(
            "wordpress.reTranslate.sourceSubtitle",
            "The language your content is written in \u2014 translations are made from this",
          )}
        />
        <div className="space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <NativeSelect
                value={displaySource}
                onChange={(e) => handleChangeSource(e.target.value)}
                disabled={sourceLanguageMutation.isPending}
                className="w-full"
              >
                {LANGUAGE_CATALOG.map((entry) => (
                  <NativeSelectOption key={entry.code} value={entry.code}>
                    {entry.flag} {entry.label}
                    {entry.region ? ` — ${entry.region}` : ""} ({entry.code})
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            {sourceLanguageMutation.isPending ? (
              <Spinner className="size-4" />
            ) : null}
          </div>
          <InfoNote>
            {t(
              "wordpress.reTranslate.sourceNoteEditable",
              "Changing the website language re-keys every indexed string. Existing translations are preserved when possible.",
            )}
          </InfoNote>
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<ScanLine className="size-3.5" />}
          title={t("wordpress.reTranslate.indexTitle", "Content index")}
          subtitle={t(
            "wordpress.reTranslate.indexSubtitle",
            "The text on your site that can be translated",
          )}
          action={
            <Badge
              variant="outline"
              className={cn(
                index.status === "complete"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : undefined,
              )}
            >
              {scanning
                ? t("wordpress.reTranslate.indexRunning", "Scanning")
                : index.status === "complete"
                  ? t("wordpress.reTranslate.indexComplete", "Up to date")
                  : t("wordpress.reTranslate.indexIdle", "Never run")}
            </Badge>
          }
        />
        <div className="space-y-4 p-5 sm:p-6">
          {scanning ? (
            <div className="space-y-2">
              <Progress value={scanned} />
              <p className="text-xs tabular-nums text-muted-foreground">
                {index.processed.toLocaleString()} /{" "}
                {index.total.toLocaleString()}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {index.status === "complete"
                ? t(
                    "wordpress.reTranslate.indexDone",
                    "New and edited content is picked up automatically.",
                  )
                : t(
                    "wordpress.reTranslate.indexNever",
                    "No scan has run yet, so there is nothing to translate.",
                  )}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <IndexStat
              label={t("wordpress.reTranslate.indexItems", "Items indexed")}
              value={index.processed.toLocaleString()}
            />
            <IndexStat
              label={t("wordpress.reTranslate.indexStrings", "Strings found")}
              value={(
                settings.stats.source_strings || index.strings
              ).toLocaleString()}
            />
            <IndexStat
              label={t("wordpress.reTranslate.indexUpdated", "Last run")}
              value={index.updated_at || "\u2014"}
            />
          </dl>
          {scanError && (
            <div
              role="alert"
              className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-xs leading-relaxed text-amber-800 dark:text-amber-300"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {t(
                  "wordpress.reTranslate.scanFailed",
                  "The scan stopped: {{error}} Starting a new scan restarts it from the beginning.",
                  { error: scanError },
                )}
              </span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {scanning && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleCancelScan}
              >
                {t("wordpress.reTranslate.stopScan", "Stop scan")}
              </Button>
            )}
            {/*
             * Offered alongside Stop while a scan is stalled: cancelling is
             * itself a server call, so a site that cannot cancel would other-
             * wise leave this panel with no way back to a runnable state.
             */}
            {(!scanning || scanError) && (
              <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                disabled={indexMutation.isPending}
                onClick={handleStartScan}
              >
                {indexMutation.isPending ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <ScanLine className="size-3.5" />
                )}
                {scanning
                  ? t("wordpress.reTranslate.restartScan", "Restart scan")
                  : t("wordpress.reTranslate.startScan", "Start scan")}
              </Button>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<PauseCircle className="size-3.5" />}
          title={t("wordpress.reTranslate.killSwitchTitle", "Kill switch")}
          subtitle={t(
            "wordpress.reTranslate.killSwitchSubtitle",
            "Serve the source language everywhere, immediately",
          )}
          action={
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5",
                settings.kill_switch
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : undefined,
              )}
            >
              {settings.kill_switch
                ? t("wordpress.reTranslate.paused", "Paused")
                : t("wordpress.reTranslate.live", "Live")}
            </Badge>
          }
        />
        <div className="space-y-3 p-5 sm:p-6">
          <ToggleField
            id="re-translate-kill-switch"
            checked={settings.kill_switch}
            onChange={(checked) =>
              patchSettings((prev) => ({ ...prev, kill_switch: checked }))
            }
            label={t(
              "wordpress.reTranslate.killSwitchToggle",
              "Pause all translations",
            )}
          />
          <FieldHint>
            {t(
              "wordpress.reTranslate.killSwitchHint",
              "Nothing is deleted and no translation work is lost \u2014 the overlay simply stops being applied until you switch it back.",
            )}
          </FieldHint>
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<FileStack className="size-3.5" />}
          title={t("wordpress.reTranslate.postTypesTitle", "Content types")}
          subtitle={t(
            "wordpress.reTranslate.postTypesSubtitle",
            "Which content types are indexed for translation",
          )}
        />
        <div className="space-y-4 p-5 sm:p-6">
          {settings.available_post_types.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t(
                "wordpress.reTranslate.postTypesEmpty",
                "No content types found on this site yet.",
              )}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {settings.available_post_types.map((type) => {
                const id = `re-translate-pt-${type.name}`;
                const checked = settings.post_types.includes(type.name);
                return (
                  <label
                    key={type.name}
                    htmlFor={id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors",
                      checked
                        ? "border-primary/40 bg-primary/5"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <Checkbox
                      id={id}
                      checked={checked}
                      onCheckedChange={() => togglePostType(type.name)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {translatedPostTypeLabel(type.name, t)}
                      </span>
                      <span className="block font-mono text-[11px] text-muted-foreground">
                        {type.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {type.count.toLocaleString()}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
          <FieldHint>
            {t(
              "wordpress.reTranslate.postTypesHint",
              "Newly enabled types are picked up on the next scan. The count is how many items of that type the site has.",
            )}
          </FieldHint>
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<Trash2 className="size-3.5" />}
          title={t("wordpress.reTranslate.uninstallTitle", "Uninstall")}
          subtitle={t(
            "wordpress.reTranslate.uninstallSubtitle",
            "What happens to your translations if the plugin is deleted",
          )}
        />
        <div className="space-y-3 p-5 sm:p-6">
          <ToggleField
            id="re-translate-delete-on-uninstall"
            checked={settings.delete_on_uninstall}
            onChange={(checked) =>
              patchSettings((prev) => ({
                ...prev,
                delete_on_uninstall: checked,
              }))
            }
            label={t(
              "wordpress.reTranslate.uninstallToggle",
              "Delete all translation data when the plugin is deleted",
            )}
          />
          <FieldHint>
            {t(
              "wordpress.reTranslate.uninstallHint",
              "Off by default. While it is off, deleting the plugin leaves every translation in place, so reinstalling restores your work.",
            )}
          </FieldHint>
          {settings.delete_on_uninstall ? (
            <div
              role="alert"
              className="flex gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3.5 py-3 text-xs leading-relaxed text-destructive"
            >
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                {t(
                  "wordpress.reTranslate.uninstallWarning",
                  "Deleting the plugin will permanently delete every translation. Export them first if you might want them back.",
                )}
              </span>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

function IndexStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-muted/30 px-3.5 py-3">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums">
        {value}
      </dd>
    </div>
  );
}
