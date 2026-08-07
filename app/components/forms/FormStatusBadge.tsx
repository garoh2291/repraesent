import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

interface Props {
  status: "draft" | "published";
  hasUnpublishedChanges?: boolean;
  className?: string;
}

/**
 * Three states, not two: a published form with edits sitting in the draft is
 * neither "live as you see it" nor "offline", and hiding that difference is how
 * people end up wondering why their change never appeared on the website.
 */
export function FormStatusBadge({
  status,
  hasUnpublishedChanges,
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

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        pending
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
          : isLive
            ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300"
            : "border-border bg-muted/50 text-muted-foreground",
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
              : "bg-muted-foreground/50",
        )}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
