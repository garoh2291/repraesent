import { MoreHorizontal, Plus, Sparkles, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import flags from "react-phone-number-input/flags";
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";
import { FORM_LOCALES, type FormLocale } from "~/lib/forms/schema";

/**
 * Locale -> country for the flag. A language is not a country (English least of
 * all), so this is a pragmatic convention, not a fact: en shows the UK flag
 * because that is what every language picker does.
 *
 * The flag set is `react-phone-number-input/flags`, already a dependency and
 * already used by `molecule/phone-number-input.tsx` — real SVGs, so they render
 * identically everywhere. Emoji flags would have been one line, but Windows
 * ships no flag glyphs and would have shown bare "GB"/"DE" letter pairs.
 */
const LOCALE_COUNTRY: Record<FormLocale, "GB" | "DE" | "FR" | "NL"> = {
  en: "GB",
  de: "DE",
  fr: "FR",
  nl: "NL",
};

function LocaleFlag({ locale }: { locale: FormLocale }) {
  const country = LOCALE_COUNTRY[locale];
  const Flag = flags[country];
  if (!Flag) return null;
  return (
    <span
      aria-hidden
      className="flex h-3.5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[2px] ring-1 ring-inset ring-black/10 [&>svg]:h-full [&>svg]:w-full [&>svg]:object-cover"
    >
      <Flag title={country} />
    </span>
  );
}

interface Props {
  /** Enabled locales. Rendered default-first whatever order they are stored in. */
  locales: FormLocale[];
  defaultLocale: FormLocale;
  activeLocale: FormLocale;
  onSelect: (locale: FormLocale) => void;

  /** Blocking issues per locale — locale-scoped only, so a dot means that language. */
  issuesByLocale: ReadonlyMap<FormLocale, number>;

  /** Locales with at least one translate request in flight. */
  translating: ReadonlySet<FormLocale>;

  disabled?: boolean;

  onAddLocale: (locale: FormLocale) => void;
  onRemoveLocale: (locale: FormLocale) => void;
  onMakeDefault: (locale: FormLocale) => void;
  onTranslateLocale: (locale: FormLocale, overwrite: boolean) => void;
}

/**
 * The builder's language switcher, modelled on Customer.io's e-mail editor:
 * one tab per language with the default first, an Add button, and a validation
 * status on the right. Picking a tab switches the WHOLE builder — canvas,
 * inspector, design copy and confirmation e-mail — to that language.
 *
 * Deliberately not a Radix <Tabs>: the real tablist (Build / Design / …) sits
 * directly below it, and nesting two tablists confuses assistive tech. This is
 * a button group with aria-pressed, the same pattern the inline locale pills
 * used before the strip replaced them.
 *
 * Styled on the app's own tokens, not on hard-coded whites. It used to live in
 * the builder's dark #111113 command bar and was written for that surface only;
 * it now renders inside each tab panel, on the light background, so every
 * `white/…` value has been replaced by the token that means the same thing.
 *
 * Centred as one group — pills and the Add button together — so the row stays
 * balanced whether the form has one language or four.
 */
export function LanguageStrip({
  locales,
  defaultLocale,
  activeLocale,
  onSelect,
  issuesByLocale,
  translating,
  disabled,
  onAddLocale,
  onRemoveLocale,
  onMakeDefault,
  onTranslateLocale,
}: Props) {
  const { t } = useTranslation();
  const [confirmRemove, setConfirmRemove] = useState<FormLocale | null>(null);
  const [confirmRetranslate, setConfirmRetranslate] =
    useState<FormLocale | null>(null);

  const ordered = [
    defaultLocale,
    ...locales.filter((l) => l !== defaultLocale),
  ];
  const addable = FORM_LOCALES.filter((l) => !locales.includes(l));
  /**
   * One AI translation at a time, across the whole strip.
   *
   * Each run merges its result into `definition.content` — a single JSON blob —
   * so two overlapping runs both patch the copy they read at start and whichever
   * finishes second wins outright. The first language's strings vanish with no
   * error anywhere.
   */
  const anyTranslating = translating.size > 0;

  return (
    <>
      <div
        className="flex flex-wrap items-center justify-center gap-1"
        role="group"
        aria-label={t("forms.strip.groupLabel")}
      >
        {ordered.map((locale) => {
          const isDefault = locale === defaultLocale;
          const active = locale === activeLocale;
          const spinning = translating.has(locale);
          const count = issuesByLocale.get(locale) ?? 0;

          return (
            // Every locale is a filled, bordered pill — not just the active
            // one. Text-only tabs read as labels, and people could not tell the
            // non-default languages were clickable at all. The ⋯ lives inside
            // the same border so the pair reads as one control.
            <div
              key={locale}
              className={cn(
                "group/tab inline-flex h-8 items-center overflow-hidden rounded-lg border transition-colors",
                active
                  ? "border-primary/40 bg-primary/10"
                  : "bg-muted/40 hover:border-border/80 hover:bg-muted",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(locale)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-full items-center gap-1.5 pl-2 pr-1.5 text-sm transition-colors",
                  active
                    ? "font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LocaleFlag locale={locale} />

                {isDefault ? (
                  <span
                    className={cn(
                      "text-[10px] font-medium uppercase tracking-wide",
                      active ? "text-primary/70" : "text-muted-foreground/60",
                    )}
                  >
                    {t("forms.strip.default")} ·
                  </span>
                ) : null}
                <span className="font-mono text-xs uppercase">{locale}</span>

                {/* Exactly one glyph, spinner wins: a language mid-translation
                    is about to stop having issues. The empty span keeps the tab
                    width stable so the strip does not jitter. */}
                {spinning ? (
                  <Spinner className="h-3 w-3 text-muted-foreground" />
                ) : count > 0 ? (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-destructive"
                    aria-label={t("forms.strip.hasIssues", { count })}
                  />
                ) : (
                  <span className="h-1.5 w-1.5" aria-hidden="true" />
                )}
              </button>

              {!disabled ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t("forms.strip.localeMenu", {
                        locale: locale.toUpperCase(),
                      })}
                      className={cn(
                        "flex h-full items-center border-l px-1.5 transition-colors",
                        active
                          ? "border-primary/25 text-primary/70 hover:bg-primary/10 hover:text-primary"
                          : "border-border text-muted-foreground/70 hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-60">
                    {/* Four near-identical menus on one strip, so name the one
                        you actually opened. */}
                    <DropdownMenuLabel className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                      <LocaleFlag locale={locale} />
                      {t(`settings.language.${locale}`)}
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    {!isDefault ? (
                      <DropdownMenuItem onSelect={() => onMakeDefault(locale)}>
                        <Star className="h-4 w-4" />
                        {t("forms.strip.makeDefault")}
                      </DropdownMenuItem>
                    ) : null}

                    {/* Gated on `anyTranslating`, not on this locale's own
                        spinner: the AI call rewrites definition.content, so two
                        in flight at once race to merge into the same blob and
                        the loser's strings are silently dropped. */}
                    <DropdownMenuItem
                      disabled={isDefault || anyTranslating}
                      onSelect={() => onTranslateLocale(locale, false)}
                    >
                      <Sparkles className="h-4 w-4" />
                      {t("forms.strip.translateWithAi")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isDefault || anyTranslating}
                      onSelect={() => setConfirmRetranslate(locale)}
                    >
                      <Sparkles className="h-4 w-4" />
                      {t("forms.strip.retranslate")}
                    </DropdownMenuItem>

                    {!isDefault ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setConfirmRemove(locale)}
                        >
                          <Trash2 className="h-4 w-4" />
                          {t("forms.strip.removeLanguage")}
                        </DropdownMenuItem>
                      </>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          );
        })}

        {!disabled && addable.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={anyTranslating}
                title={
                  anyTranslating ? t("forms.strip.translationBusy") : undefined
                }
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-border disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("forms.strip.addLanguage")}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {t("forms.strip.addLanguageHint")}
              </DropdownMenuLabel>
              {addable.map((locale) => (
                <DropdownMenuItem
                  key={locale}
                  onSelect={() => onAddLocale(locale)}
                >
                  <LocaleFlag locale={locale} />
                  {/* Endonyms, already translated in all four locale files. */}
                  <span>{t(`settings.language.${locale}`)}</span>
                  <span className="ml-auto font-mono text-[11px] uppercase text-muted-foreground">
                    {locale}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        {/* No issue summary here. The sticky validation banner sits directly
            above this row and says the same thing with the detail to act on;
            two counts of the same problem is one too many. */}
      </div>

      <AlertDialog
        open={confirmRemove !== null}
        onOpenChange={(open) => !open && setConfirmRemove(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("forms.strip.removeConfirmTitle", {
                locale: (confirmRemove ?? "").toUpperCase(),
              })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("forms.strip.removeConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRemove) onRemoveLocale(confirmRemove);
                setConfirmRemove(null);
              }}
            >
              {t("forms.strip.removeLanguage")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={confirmRetranslate !== null}
        onOpenChange={(open) => !open && setConfirmRetranslate(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("forms.strip.retranslateConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("forms.strip.retranslateConfirmBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", { defaultValue: "Cancel" })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmRetranslate)
                  onTranslateLocale(confirmRetranslate, true);
                setConfirmRetranslate(null);
              }}
            >
              {t("forms.strip.retranslate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
