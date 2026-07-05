import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserLocale } from "~/lib/api/auth";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import {
  SUPPORTED_LOCALES,
  normalizeLocale,
  type SupportedLocale,
} from "~/i18n/locales";

/** Full display names for the compact dropdown variant. */
const LANGUAGE_NAMES: Record<SupportedLocale, string> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  nl: "Nederlands",
};

interface LanguageSwitcherProps {
  /** "dark"/"light" = button group; "dropdown" = compact NativeSelect with full names */
  variant?: "dark" | "light" | "dropdown";
  /** When true, persists locale to user profile (fire-and-forget, does not block UI) */
  persistToDb?: boolean;
  /** Extra classes applied to the root element. */
  className?: string;
}

export function LanguageSwitcher({
  variant = "dark",
  persistToDb = false,
  className,
}: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const current = normalizeLocale(i18n.language);

  const persistMutation = useMutation({
    mutationFn: (locale: SupportedLocale) => updateUserLocale(locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const handleChange = (lang: SupportedLocale) => {
    if (lang === current) return;
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `personal_lang=${lang}; path=/; max-age=${maxAge}; samesite=lax`;
    i18n.changeLanguage(lang);
    if (persistToDb) {
      persistMutation.mutate(lang);
    }
  };

  const btnBase =
    "px-2.5 py-1 rounded-md  text-[11px] font-semibold uppercase tracking-widest transition-all duration-150";

  if (variant === "dropdown") {
    return (
      <NativeSelect
        size="sm"
        value={current}
        onChange={(e) => handleChange(e.target.value as SupportedLocale)}
        aria-label="Language"
        className={
          "h-8 border-stone-200 border-none shadow-none text-[11px] text-stone-500 " +
          (className ?? "")
        }
      >
        {SUPPORTED_LOCALES.map((lang) => (
          <NativeSelectOption key={lang} value={lang}>
            {LANGUAGE_NAMES[lang]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    );
  }

  if (variant === "dark") {
    return (
      <div
        className={
          "flex items-center gap-0.5 rounded-lg w-fit bg-white/5 p-0.5 " +
          (className ?? "")
        }
      >
        {SUPPORTED_LOCALES.map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => handleChange(lang)}
            className={[
              btnBase,
              current === lang
                ? "bg-amber-400/15 text-amber-400 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]"
                : "text-white/25 hover:text-white/50",
            ].join(" ")}
          >
            {lang}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm">
      {SUPPORTED_LOCALES.map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => handleChange(lang)}
          className={[
            btnBase,
            current === lang
              ? "bg-stone-900 text-white shadow-sm"
              : "text-stone-400 hover:text-stone-600",
          ].join(" ")}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}
