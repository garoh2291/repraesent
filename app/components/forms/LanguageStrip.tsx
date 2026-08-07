import {
  AlertTriangle,
  Check,
  MoreHorizontal,
  Plus,
  Sparkles,
  Star,
  Trash2,
} from "lucide-react";
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
import { Spinner } from "~/components/ui/spinner";
import { cn } from "~/lib/utils";
import { FORM_LOCALES, type FormLocale } from "~/lib/forms/schema";

interface Props {
  /** Enabled locales. Rendered default-first whatever order they are stored in. */
  locales: FormLocale[];
  defaultLocale: FormLocale;
  activeLocale: FormLocale;
  onSelect: (locale: FormLocale) => void;

  /** Blocking issues per locale — locale-scoped only, so a dot means that language. */
  issuesByLocale: ReadonlyMap<FormLocale, number>;
  /** Grand total including language-agnostic issues; drives the right-hand pill. */
  totalIssues: number;
  onFocusIssues: () => void;

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
 */
export function LanguageStrip({
  locales,
  defaultLocale,
  activeLocale,
  onSelect,
  issuesByLocale,
  totalIssues,
  onFocusIssues,
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

  return (
    <>
      <div
        className="flex flex-wrap items-center gap-1 py-1.5"
        role="group"
        aria-label={t("forms.strip.groupLabel")}
      >
        {ordered.map((locale) => {
          const isDefault = locale === defaultLocale;
          const active = locale === activeLocale;
          const spinning = translating.has(locale);
          const count = issuesByLocale.get(locale) ?? 0;

          return (
            <div key={locale} className="group/tab flex items-center">
              <button
                type="button"
                onClick={() => onSelect(locale)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md pl-2.5 pr-2 text-sm transition-colors",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {isDefault ? (
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
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
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-muted focus-visible:opacity-100 group-hover/tab:opacity-100 data-[state=open]:opacity-100"
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-60">
                    {!isDefault ? (
                      <DropdownMenuItem onSelect={() => onMakeDefault(locale)}>
                        <Star className="h-4 w-4" />
                        {t("forms.strip.makeDefault")}
                      </DropdownMenuItem>
                    ) : null}

                    <DropdownMenuItem
                      disabled={isDefault || spinning}
                      onSelect={() => onTranslateLocale(locale, false)}
                    >
                      <Sparkles className="h-4 w-4" />
                      {t("forms.strip.translateWithAi")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isDefault || spinning}
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
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
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
                  <span className="font-mono text-xs uppercase">{locale}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}

        <div className="ml-auto">
          {totalIssues === 0 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {t("forms.strip.noErrors")}
            </span>
          ) : (
            <button
              type="button"
              onClick={onFocusIssues}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              {t("forms.strip.issueCount", { count: totalIssues })}
            </button>
          )}
        </div>
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
