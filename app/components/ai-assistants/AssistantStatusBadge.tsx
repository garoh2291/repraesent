import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import type { AssistantStatus } from "~/lib/api/ai-assistants";

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

/** Same three-state ladder as FormStatusBadge: draft / live / live-with-edits. */
export function AssistantStatusBadge({
  status,
  hasUnpublishedChanges,
  tone = "light",
  className,
}: {
  status: AssistantStatus;
  hasUnpublishedChanges?: boolean;
  tone?: "light" | "dark";
  className?: string;
}) {
  const { t } = useTranslation();
  const isLive = status === "published";
  const pending = isLive && hasUnpublishedChanges;
  const tones = TONES[tone];
  const label = pending
    ? t("aiAssistants.status.unpublishedChanges")
    : isLive
      ? t("aiAssistants.status.published")
      : t("aiAssistants.status.draft");

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        pending ? tones.pending : isLive ? tones.live : tones.draft,
        className,
      )}
    >
      <span
        aria-hidden
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
      />
      {label}
    </span>
  );
}
