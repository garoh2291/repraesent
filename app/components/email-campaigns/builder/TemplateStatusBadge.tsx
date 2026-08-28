import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

/**
 * FormStatusBadge's three-state model, adapted to template versioning:
 * draft (never published) / v N (published, current) / v N + pending dot
 * (published but the draft has edits an autosave is about to publish, or —
 * when auto-publish is off — edits nobody has published).
 */
const TONES = {
  light: {
    pending:
      "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300",
    live: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300",
    draft: "border-border bg-muted/50 text-muted-foreground",
  },
  dark: {
    pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    live: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    draft: "border-white/10 bg-white/5 text-white/50",
  },
} as const;

export function TemplateStatusBadge({
  version,
  hasUnpublishedChanges,
  tone = "light",
  className,
}: {
  /** 0 = never published. */
  version: number;
  hasUnpublishedChanges?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const { t } = useTranslation();

  const published = version > 0;
  const pending = published && hasUnpublishedChanges;

  const label = pending
    ? t("forms.status.unpublishedChanges", {
        defaultValue: "Unpublished changes",
      })
    : published
      ? `v${version}`
      : t("forms.status.draft", { defaultValue: "Draft" });

  const tones = TONES[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        pending ? tones.pending : published ? tones.live : tones.draft,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          pending
            ? "bg-amber-500"
            : published
              ? "bg-emerald-500"
              : tone === "dark"
                ? "bg-white/40"
                : "bg-muted-foreground/50",
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
