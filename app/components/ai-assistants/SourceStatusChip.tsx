import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import type { SourceStatus } from "~/lib/api/ai-assistants";

const WORKING: ReadonlySet<SourceStatus> = new Set([
  "pending",
  "uploading",
  "queued",
  "crawling",
  "parsing",
  "embedding",
]);

/**
 * One chip per pipeline stage. While a source is in flight the dot breathes
 * (opacity only — `motion-reduce` freezes it), so a list of ten sources reads
 * at a glance without a spinner on every row.
 */
export function SourceStatusChip({
  status,
  className,
}: {
  status: SourceStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  const working = WORKING.has(status);
  const failed = status === "failed";
  const ready = status === "ready";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        ready &&
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        failed &&
          "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
        working &&
          "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          ready && "bg-emerald-500",
          failed && "bg-red-500",
          working && "bg-sky-400 animate-pulse motion-reduce:animate-none",
        )}
      />
      {t(`aiAssistants.sourceStatus.${status}`)}
    </span>
  );
}
