import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { FORM_LOCALES, type FormLocale } from "~/lib/forms/schema";
import { LANGUAGE_NAMES } from "~/i18n/language-names";

const NONE = "__none__";

export function isCustomerLocale(v: unknown): v is FormLocale {
  return typeof v === "string" && (FORM_LOCALES as readonly string[]).includes(v);
}

/**
 * Said the moment a language is picked that will land on someone's customer
 * card — so changing it for one appointment never silently changes it for
 * every email they get afterwards.
 */
export function announceCardLanguage(t: TFunction, name: string | null | undefined, locale: FormLocale) {
  toast.info(
    name
      ? t("appointmentBook.language.cardWillUpdate", "{{language}} will also be saved on {{name}}'s customer card.", {
          language: LANGUAGE_NAMES[locale],
          name,
        })
      : t("appointmentBook.language.cardWillUpdateNoName", "{{language}} will also be saved on their customer card.", {
          language: LANGUAGE_NAMES[locale],
        }),
    { description: t("appointmentBook.language.cardWillUpdateWhy", "Every email to them from now on goes out in it.") },
  );
}

/** The language a customer gets emails in. `allowNone` adds a "not set" choice. */
export function CustomerLanguageSelect({
  value,
  onChange,
  allowNone = false,
  noneLabel,
  placeholder,
  invalid = false,
  className,
  id,
}: {
  value: FormLocale | null;
  onChange: (v: FormLocale | null) => void;
  allowNone?: boolean;
  noneLabel?: string;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
  id?: string;
}) {
  const { t } = useTranslation();
  return (
    <Select value={value ?? (allowNone ? NONE : "")} onValueChange={(v) => onChange(v === NONE ? null : (v as FormLocale))}>
      <SelectTrigger
        id={id}
        aria-invalid={invalid || undefined}
        className={cn("h-10 w-full max-sm:h-11 sm:w-[220px]", invalid && "border-secondary ring-2 ring-secondary/40", className)}
      >
        <SelectValue placeholder={placeholder ?? t("appointmentBook.language.pick", "Pick a language")} />
      </SelectTrigger>
      <SelectContent>
        {allowNone ? <SelectItem value={NONE}>{noneLabel ?? t("appointmentBook.language.none", "Not set")}</SelectItem> : null}
        {FORM_LOCALES.map((l) => (
          <SelectItem key={l} value={l}>
            {LANGUAGE_NAMES[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
