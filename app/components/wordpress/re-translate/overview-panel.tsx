import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  BookOpen,
  Languages as LanguagesIcon,
  ListChecks,
  Plus,
  ScanLine,
  Search,
  Trash2,
} from "lucide-react";
import type { ReTranslateSettings } from "~/lib/wordpress/plugin-settings-types";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  useAddTranslateLanguage,
  useRemoveTranslateLanguage,
} from "~/lib/hooks/useWorkspaceReTranslate";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Progress } from "~/components/ui/progress";
import { Spinner } from "~/components/ui/spinner";
import {
  CardHeader,
  InfoNote,
  SectionCard,
} from "~/components/wordpress/fields";
import {
  flash,
  LANGUAGE_CATALOG,
  languageDisplayCode,
  languageFlag,
  languageName,
  languageRegionName,
  normalizeLanguageCode,
  sortLanguagesByPriority,
  type TabId,
} from "./constants";

export function OverviewPanel({
  settings,
  pluginUuid,
  onNavigate,
}: {
  settings: ReTranslateSettings;
  pluginUuid: string;
  onNavigate: (tab: TabId) => void;
}) {
  const { t } = useTranslation();
  const [showPicker, setShowPicker] = useState(false);
  /** Language awaiting remove confirmation, or null when the modal is closed. */
  const [confirmRemove, setConfirmRemove] = useState<{
    code: string;
    label: string;
  } | null>(null);

  const source = settings.source_language;
  const languages = useMemo(
    () => sortLanguagesByPriority(settings.languages),
    [settings.languages],
  );
  // Normalized on both sides: the catalog offers "en-US" while the plugin
  // stores "en-us", and a raw comparison would keep offering a language that
  // is already being translated into.
  const addedCodes = useMemo(
    () =>
      new Set(
        [source, ...languages.map((l) => l.code)].map(normalizeLanguageCode),
      ),
    [source, languages],
  );

  const addMutation = useAddTranslateLanguage(pluginUuid);
  const removeMutation = useRemoveTranslateLanguage(pluginUuid);

  function languageLabel(code: string) {
    const region = languageRegionName(code);
    return region
      ? `${languageName(code)} (${region})`
      : languageName(code);
  }

  function handleAdd(code: string) {
    const normalized = normalizeLanguageCode(code);
    const entry = LANGUAGE_CATALOG.find(
      (c) => normalizeLanguageCode(c.code) === normalized,
    );
    if (!entry) return;

    // `label` is what the front-end switcher renders, so it stays the plain
    // language name; the region rides along in the code and the locale.
    const name = entry.region ? `${entry.label} (${entry.region})` : entry.label;

    addMutation.mutate(
      {
        code: normalized,
        label: entry.label,
        locale: entry.locale,
        flag: entry.flag,
      },
      {
        onSuccess: () => {
          setShowPicker(false);
          flash(
            t("wordpress.reTranslate.languageAdded", "{{lang}} added.", {
              lang: name,
            }),
          );
        },
        onError: (err) => flash(extractErrorMessage(err), "error"),
      },
    );
  }

  function requestRemove(code: string) {
    setConfirmRemove({ code, label: languageLabel(code) });
  }

  function confirmRemoveLanguage(purge: boolean) {
    if (!confirmRemove) return;
    const { code, label } = confirmRemove;
    setConfirmRemove(null);

    removeMutation.mutate(
      { code, purge },
      {
        onSuccess: () =>
          flash(
            purge
              ? t(
                  "wordpress.reTranslate.languageRemovedPurge",
                  "{{lang}} removed and its translations deleted.",
                  { lang: label },
                )
              : t(
                  "wordpress.reTranslate.languageRemovedKeep",
                  "{{lang}} removed. Its translations are kept, so adding it back restores them.",
                  { lang: label },
                ),
          ),
        onError: (err) => flash(extractErrorMessage(err), "error"),
      },
    );
  }

  return (
    <div className="space-y-4">
      <SectionCard>
        <CardHeader
          icon={<BookOpen className="size-3.5" />}
          title={t("wordpress.reTranslate.howToTitle", "How to translate")}
          subtitle={t(
            "wordpress.reTranslate.howToSubtitle",
            "Three steps to a multilingual site",
          )}
        />
        <div className="space-y-4 p-5 sm:p-6">
          <ol className="space-y-3">
            <HowToStep
              step={1}
              done={languages.length > 0}
              title={t(
                "wordpress.reTranslate.step1",
                "Add a target language",
              )}
              detail={t(
                "wordpress.reTranslate.step1Detail",
                "Every indexed string is queued for each language you add.",
              )}
            />
            <HowToStep
              step={2}
              done={settings.index.status === "complete"}
              title={t(
                "wordpress.reTranslate.step2",
                "Run a content scan",
              )}
              detail={t(
                "wordpress.reTranslate.step2Detail",
                "The scan indexes every page, post, and menu on your site.",
              )}
            />
            <HowToStep
              step={3}
              done={
                Object.values(settings.stats.languages).some(
                  (s) => s.translated > 0,
                )
              }
              title={t(
                "wordpress.reTranslate.step3",
                "Translate your content",
              )}
              detail={t(
                "wordpress.reTranslate.step3Detail",
                "Open the translation list and translate string by string.",
              )}
            />
          </ol>

          <Button
            variant="default"
            className="gap-2"
            onClick={() => onNavigate("translate")}
          >
            <ListChecks className="size-4" />
            {t(
              "wordpress.reTranslate.openTranslations",
              "Open translation list",
            )}
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </SectionCard>

      <SectionCard>
        <CardHeader
          icon={<LanguagesIcon className="size-3.5" />}
          title={t("wordpress.reTranslate.languagesTitle", "Translating into")}
          subtitle={t(
            "wordpress.reTranslate.defaultLanguageLabel",
            "Default language {{code}}",
            {
              code: languageDisplayCode(source) || "\u2014",
            },
          )}
          action={
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowPicker(true)}
            >
              <Plus className="size-3.5" />
              {t("wordpress.reTranslate.addALanguage", "Add a language")}
            </Button>
          }
        />
        <div className="px-5 pb-4 pt-0 sm:px-6 sm:pb-5">
          {languages.length === 0 ? (
            <div className="rounded-xl border border-dashed px-4 py-10 text-center mt-4">
              <p className="text-sm font-medium">
                {t(
                  "wordpress.reTranslate.noLanguagesOverview",
                  "No languages yet",
                )}
              </p>
              <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                {t(
                  "wordpress.reTranslate.noLanguagesOverviewHint",
                  "Add a language and every indexed string is queued for it.",
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setShowPicker(true)}
              >
                <Plus className="size-3.5" />
                {t("wordpress.reTranslate.addALanguage", "Add a language")}
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {languages.map((language) => {
                const stats = settings.stats.languages[language.code];
                const percent = stats?.percent ?? 0;
                const total = stats?.total ?? 0;
                const translated = stats?.translated ?? 0;
                const stale = stats?.stale ?? 0;
                const region = languageRegionName(language.code);

                return (
                  <li
                    key={language.code}
                    className="flex h-12 items-center gap-3 sm:h-14 sm:gap-4"
                  >
                    <span
                      className="flex w-7 shrink-0 items-center justify-center text-xl leading-none"
                      aria-hidden
                    >
                      {languageFlag(language.code) || language.flag}
                    </span>

                    <span className="flex min-w-0 flex-1 items-baseline gap-2 sm:max-w-[14rem] sm:flex-none sm:basis-[14rem]">
                      <span className="truncate text-sm font-medium">
                        {languageName(language.code, language.label)}
                        {region ? (
                          <span className="font-normal text-muted-foreground">
                            {" — "}
                            {region}
                          </span>
                        ) : null}
                      </span>
                      <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">
                        /{normalizeLanguageCode(language.code)}/
                      </span>
                    </span>

                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      <Progress value={percent} className="h-1.5 min-w-0 flex-1" />
                      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {percent}%
                      </span>
                    </span>

                    <span className="hidden w-[4.5rem] shrink-0 text-right text-xs tabular-nums text-muted-foreground md:block">
                      {translated.toLocaleString()} / {total.toLocaleString()}
                    </span>

                    <span className="hidden w-16 shrink-0 justify-end md:flex">
                      {stale > 0 ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/10 text-[11px] text-amber-800 dark:text-amber-300"
                        >
                          {t(
                            "wordpress.reTranslate.stale",
                            "{{count}} stale",
                            { count: stale },
                          )}
                        </Badge>
                      ) : null}
                    </span>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={removeMutation.isPending}
                      onClick={() => requestRemove(language.code)}
                      aria-label={t(
                        "wordpress.reTranslate.removeLanguage",
                        "Remove language",
                      )}
                    >
                      {removeMutation.isPending ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </SectionCard>

      <LanguagePicker
        open={showPicker}
        onOpenChange={setShowPicker}
        excludeCodes={addedCodes}
        onAdd={handleAdd}
        adding={addMutation.isPending}
      />

      <AlertDialog
        open={!!confirmRemove}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("wordpress.reTranslate.removeConfirmTitle", "Remove {{lang}}?", {
                lang: confirmRemove?.label ?? "",
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "wordpress.reTranslate.removeConfirmBody",
                "Remove it? Keeping the translations means adding the language back restores them.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:items-stretch sm:justify-start">
            <AlertDialogAction
              variant="outline"
              className="w-full"
              onClick={() => confirmRemoveLanguage(false)}
            >
              {t(
                "wordpress.reTranslate.removeKeepTranslations",
                "Keep translations",
              )}
            </AlertDialogAction>
            <AlertDialogAction
              variant="destructive"
              className="w-full"
              onClick={() => confirmRemoveLanguage(true)}
            >
              {t(
                "wordpress.reTranslate.removeDeleteTranslations",
                "Delete them too",
              )}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {settings.index.status !== "complete" ? (
        <InfoNote>
          <span className="inline-flex items-center gap-1.5">
            <ScanLine className="size-3.5 shrink-0" />
            {t(
              "wordpress.reTranslate.overviewScanHint",
              "Run a content scan from Settings to populate translation data.",
            )}
          </span>
        </InfoNote>
      ) : (
        <InfoNote>
          {t(
            "wordpress.reTranslate.languagesNote",
            "Adding a language queues every indexed string for it, and removing one can delete its translations. Translated content is served at /<code>/, for example /de/about/; your existing URLs never change.",
          )}
        </InfoNote>
      )}
    </div>
  );
}

function HowToStep({
  step,
  done,
  title,
  detail,
}: {
  step: number;
  done: boolean;
  title: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          done
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        {done ? "\u2713" : step}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {detail}
        </span>
      </span>
    </li>
  );
}

/**
 * The language picker, as a modal.
 *
 * The catalog carries a bare entry per language and one per regional variant
 * ("English", then "English — United States"), so it is long and the search box
 * is the real way through it. That is a dialog's job, not a card that pushes the
 * list of what is already translated off the screen.
 */
function LanguagePicker({
  open,
  onOpenChange,
  excludeCodes,
  onAdd,
  adding,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already added or the source language — normalized, as the plugin stores. */
  excludeCodes: Set<string>;
  onAdd: (code: string) => void;
  adding: boolean;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const available = useMemo(() => {
    const q = search.trim().toLowerCase();
    return LANGUAGE_CATALOG.filter((entry) => {
      if (excludeCodes.has(normalizeLanguageCode(entry.code))) return false;
      if (!q) return true;
      return (
        entry.code.toLowerCase().includes(q) ||
        entry.label.toLowerCase().includes(q) ||
        entry.region.toLowerCase().includes(q)
      );
    });
  }, [excludeCodes, search]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSearch("");
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>
            {t("wordpress.reTranslate.pickerTitle", "Add a language")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "wordpress.reTranslate.pickerSubtitle",
              "Every indexed string is queued for the language you pick. Choose a regional variant when one market should read differently from another.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="border-b px-5 py-3">
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "wordpress.reTranslate.searchLanguages",
                "Search languages…",
              )}
              className="pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {available.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {t(
                "wordpress.reTranslate.noMatchingLanguages",
                "No matching languages found.",
              )}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {available.map((entry) => (
                <button
                  key={entry.code}
                  type="button"
                  disabled={adding}
                  onClick={() => onAdd(entry.code)}
                  className="flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
                >
                  <span className="text-lg leading-none" aria-hidden>
                    {entry.flag || "🏳️"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {entry.label}
                      {entry.region ? (
                        <span className="font-normal text-muted-foreground">
                          {" — "}
                          {entry.region}
                        </span>
                      ) : null}
                    </span>
                    <span className="block font-mono text-[11px] text-muted-foreground">
                      /{normalizeLanguageCode(entry.code)}/
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
