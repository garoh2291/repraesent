import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { LocaleFlag } from "~/components/forms/LanguageStrip";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  AI_LOCALES,
  translateAiTexts,
  type AiLocale,
  type LocalizedText,
} from "~/lib/api/ai-onboarding";
import { cn } from "~/lib/utils";

/** The admin's UI language when it is one of the four, else English. */
export function useUiLocale(): AiLocale {
  const { i18n } = useTranslation();
  const l = (i18n.language ?? "en").slice(0, 2) as AiLocale;
  return (AI_LOCALES as readonly string[]).includes(l) ? l : "en";
}

/**
 * One text in four languages: flag pills to switch, a dot on languages that
 * have text, and "Fill the others with AI" (translates the visible language
 * into the empty ones; never overwrites what the admin wrote).
 */
export function LocalizedField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  maxLength = 1000,
  hint,
}: {
  label: string;
  value: LocalizedText;
  onChange: (next: LocalizedText) => void;
  /** Shown per language when empty (the default this text replaces). */
  placeholder?: LocalizedText;
  multiline?: boolean;
  maxLength?: number;
  hint?: string;
}) {
  const { t } = useTranslation();
  const id = useId();
  const uiLocale = useUiLocale();
  const [locale, setLocale] = useState<AiLocale>(uiLocale);
  const [busy, setBusy] = useState(false);
  const current = value[locale] ?? "";
  const empty = AI_LOCALES.filter((l) => l !== locale && !value[l]?.trim());

  const set = (text: string) => {
    const next = { ...value };
    if (text) next[locale] = text;
    else delete next[locale];
    onChange(next);
  };

  const fill = async () => {
    if (!current.trim() || empty.length === 0) return;
    setBusy(true);
    try {
      const res = await translateAiTexts({
        source_locale: locale,
        items: { text: current },
        targets: empty,
      });
      const next = { ...value };
      for (const l of empty) {
        const v = res.values[l]?.text;
        if (v && !next[l]?.trim()) next[l] = v;
      }
      onChange(next);
      if (res.failed.length)
        toast.error(
          t("settings.onboarding.ai.translateSome", {
            langs: res.failed.map((l) => l.toUpperCase()).join(", "),
          }),
        );
      else toast.success(t("settings.onboarding.ai.translated"));
    } catch (err) {
      toast.error(
        extractErrorMessage(err) || t("settings.onboarding.ai.translateFailed"),
      );
    } finally {
      setBusy(false);
    }
  };

  const Field = multiline ? Textarea : Input;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div
          role="tablist"
          aria-label={t("settings.onboarding.ai.language")}
          className="inline-flex gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
        >
          {AI_LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={locale === l}
              onClick={() => setLocale(l)}
              className={cn(
                "relative flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-semibold uppercase tracking-wide transition-colors",
                locale === l
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="hidden sm:inline-flex">
                <LocaleFlag locale={l} />
              </span>
              {l}
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full",
                  value[l]?.trim()
                    ? "bg-foreground/70"
                    : "bg-transparent ring-1 ring-inset ring-muted-foreground/40",
                )}
              />
            </button>
          ))}
        </div>
        {empty.length > 0 ? (
          <button
            type="button"
            onClick={fill}
            disabled={busy || !current.trim()}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3.5" aria-hidden />
            )}
            {t("settings.onboarding.ai.fillOthers", { count: empty.length })}
          </button>
        ) : null}
      </div>
      <Field
        id={id}
        value={current}
        maxLength={maxLength}
        onChange={(
          e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>,
        ) => set(e.target.value)}
        placeholder={placeholder?.[locale] ?? ""}
        lang={locale}
        className={cn(multiline ? "min-h-20 resize-y" : "h-10")}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Europe (default) · US · Canada · Australia, for choosing which wording to edit. */
export function RegionPills<R extends string>({
  regions,
  value,
  onChange,
  filled,
}: {
  regions: readonly R[];
  value: R;
  onChange: (r: R) => void;
  /** Regions that have their own text (dot). */
  filled?: (r: R) => boolean;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t("settings.onboarding.regions.label")}
      className="inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {regions.map((r) => (
        <button
          key={r}
          type="button"
          role="tab"
          aria-selected={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
            value === r
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`settings.onboarding.regions.${r === "default" ? "europe" : r}`)}
          {r !== "default" && filled?.(r) ? (
            <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          ) : null}
        </button>
      ))}
    </div>
  );
}
