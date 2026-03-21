import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserLocale } from "~/lib/api/auth";

interface LanguageSwitcherProps {
  /** "dark" for sidebar/brand panels, "light" for form panels */
  variant?: "dark" | "light";
  /** When true, persists locale to user profile (fire-and-forget, does not block UI) */
  persistToDb?: boolean;
}

export function LanguageSwitcher({
  variant = "dark",
  persistToDb = false,
}: LanguageSwitcherProps) {
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const current = i18n.language?.startsWith("de") ? "de" : "en";

  const persistMutation = useMutation({
    mutationFn: (locale: "en" | "de") => updateUserLocale(locale),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    },
  });

  const handleChange = (lang: "en" | "de") => {
    if (lang === current) return;
    const maxAge = 60 * 60 * 24 * 365;
    document.cookie = `personal_lang=${lang}; path=/; max-age=${maxAge}; samesite=lax`;
    i18n.changeLanguage(lang);
    if (persistToDb) {
      persistMutation.mutate(lang);
    }
  };

  if (variant === "dark") {
    return (
      <div className="flex items-center gap-0.5 rounded-lg w-fit bg-white/5 p-0.5">
        {(["en", "de"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => handleChange(lang)}
            className={[
              "px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-widest transition-all duration-150",
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
      {(["en", "de"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => handleChange(lang)}
          className={[
            "px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-widest transition-all duration-150",
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
