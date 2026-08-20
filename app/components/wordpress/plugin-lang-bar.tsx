import { cn } from "~/lib/utils";
import type { PluginI18nLanguage } from "~/lib/wordpress/plugin-i18n";

/**
 * Language switcher for plugin settings — mirrors the WP admin lang bars
 * (re-appointment / cookies / re-index / re-maintenance).
 */
export function PluginLangBar({
  languages,
  active,
  source,
  dirty,
  dirtyLanguages,
  disabled,
  unsavedMessage = "You have unsaved changes. Switch language anyway?",
  ariaLabel = "Language",
  onChange,
  className,
}: {
  languages: PluginI18nLanguage[];
  active: string;
  source: string;
  /** Warn before leaving the current language. Screens that keep per-language
   *  drafts pass `dirtyLanguages` instead and skip the prompt entirely. */
  dirty?: boolean;
  /** Languages with unsaved edits — marked with a dot. */
  dirtyLanguages?: string[];
  disabled?: boolean;
  unsavedMessage?: string;
  ariaLabel?: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  if (languages.length < 2) return null;

  function select(code: string) {
    if (!code || code === active || disabled) return;
    if (dirty && !window.confirm(unsavedMessage)) return;
    onChange(code);
  }

  return (
    // One frame whatever is selected — the source language used to sit on a
    // different background from the targets, which read as a different control.
    <div
      className={cn(
        "flex w-fit max-w-full flex-wrap items-center gap-1 rounded-xl border bg-muted/40 p-1",
        className,
      )}
    >
      <div
        className="flex flex-wrap gap-1"
        role="tablist"
        aria-label={ariaLabel}
      >
        {languages.map((lang) => {
          const isActive = lang.code === active;
          const isDirty = dirtyLanguages?.includes(lang.code) ?? false;
          const isSourceLang = lang.is_source || lang.code === source;
          return (
            <button
              key={lang.code}
              type="button"
              role="tab"
              aria-pressed={isActive}
              disabled={disabled}
              data-language={lang.code}
              onClick={() => select(lang.code)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "bg-card text-foreground shadow-xs"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
                disabled && "opacity-50",
              )}
            >
              {lang.label}
              {isDirty ? (
                <span
                  aria-hidden
                  title="Unsaved changes"
                  className="size-1.5 rounded-full bg-amber-500"
                />
              ) : null}
              {isSourceLang ? (
                <span className="rounded bg-muted px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Source
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
