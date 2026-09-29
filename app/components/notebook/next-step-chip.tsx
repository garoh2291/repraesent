import { CalendarClock, CircleDashed } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";

interface Summary {
  open_count: number;
  nearest_due_date: string | null;
  nearest_urgency: "overdue" | "due_soon" | "upcoming" | null;
  nearest_title: string | null;
}

function whenOf(iso: string, locale: string): "today" | "tomorrow" | string {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "today";
  if (new Date(today.getTime() + 86_400_000).toDateString() === d.toDateString()) {
    return "tomorrow";
  }
  return d.toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

/**
 * "What happens next on this deal?" Every open deal should have an answer
 * (NOTEBOOK_UX_PLAN.md D7): the nearest open task, or a marker-yellow
 * "No next step" nudge.
 *
 * Rendered as a span (never a <button>): it sits inside clickable, draggable
 * cards, and a button inside a button is invalid HTML that breaks clicks.
 */
export function NextStepChip({
  summary,
  className,
  onAdd,
}: {
  summary: Summary | null | undefined;
  className?: string;
  /** Makes the "No next step" chip actionable. */
  onAdd?: () => void;
}) {
  const { t, i18n } = useTranslation();
  if (!summary) return null;

  if (summary.open_count === 0) {
    const interactive = !!onAdd;
    return (
      <span
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onPointerDown={interactive ? (e) => e.stopPropagation() : undefined}
        onMouseDown={interactive ? (e) => e.stopPropagation() : undefined}
        onTouchStart={interactive ? (e) => e.stopPropagation() : undefined}
        onClick={
          interactive
            ? (e) => {
                e.preventDefault();
                e.stopPropagation();
                onAdd?.();
              }
            : undefined
        }
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onAdd?.();
                }
              }
            : undefined
        }
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-md bg-marker-soft px-1.5 py-0.5 text-[11.5px] font-medium text-marker-ink",
          interactive &&
            "press cursor-pointer hover:bg-marker focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25",
          className,
        )}
      >
        <CircleDashed className="size-3.5" aria-hidden />
        {t("nextStep.none", "No next step")}
      </span>
    );
  }

  const when = summary.nearest_due_date
    ? whenOf(summary.nearest_due_date, i18n.language)
    : null;
  const whenLabel =
    when === "today"
      ? t("nextStep.today", "today")
      : when === "tomorrow"
        ? t("nextStep.tomorrow", "tomorrow")
        : when;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium",
        summary.nearest_urgency === "overdue"
          ? "bg-overdue-soft text-overdue"
          : "bg-muted text-foreground/80",
        className,
      )}
      title={summary.nearest_title ?? undefined}
    >
      <CalendarClock className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{summary.nearest_title}</span>
      {whenLabel ? <span className="shrink-0 text-muted-foreground">· {whenLabel}</span> : null}
    </span>
  );
}
