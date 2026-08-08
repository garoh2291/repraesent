import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

interface Props {
  status: "draft" | "published";
  hasUnpublishedChanges?: boolean;
  /**
   * `dark` is for the builder's #111113 command bar. The light tones use
   * 50-level fills that turn to mud on dark chrome, so this switches to the
   * translucent ladder the sidebar and trial banner already use. Default is
   * unchanged, so the forms list is untouched.
   */
  tone?: "light" | "dark";
  className?: string;
}

/**
 * Three states, not two: a published form with edits sitting in the draft is
 * neither "live as you see it" nor "offline", and hiding that difference is how
 * people end up wondering why their change never appeared on the website.
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

export function FormStatusBadge({
  status,
  hasUnpublishedChanges,
  tone = "light",
  className,
}: Props) {
  const { t } = useTranslation();

  const isLive = status === "published";
  const pending = isLive && hasUnpublishedChanges;

  const label = pending
    ? t("forms.status.unpublishedChanges")
    : isLive
      ? t("forms.status.published")
      : t("forms.status.draft");

  const tones = TONES[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        pending ? tones.pending : isLive ? tones.live : tones.draft,
        className,
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          pending
            ? "bg-amber-500"
            : isLive
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
