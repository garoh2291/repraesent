import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import type { Lead } from "~/lib/api/leads";
import { TaskUrgencyBadge } from "~/components/organism/tasks/task-urgency-badge";
import TooltipContainer from "~/components/tooltip-container";

interface LeadTasksSummaryCellProps {
  lead: Lead;
  onClick?: () => void;
}

export function LeadTasksSummaryCell({
  lead,
  onClick,
}: LeadTasksSummaryCellProps) {
  const { t } = useTranslation();
  const summary = lead.tasks_summary;

  if (!summary || summary.open_count === 0) {
    return (
      <span className="text-muted-foreground/40 text-sm select-none">—</span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2 py-1 -mx-2 -my-1 transition-colors",
        "hover:bg-muted/60 text-left"
      )}
    >
      {/* Open count badge */}
      <span className="inline-flex items-center rounded-full bg-muted border border-border px-2 py-0.5 text-[10px] font-semibold text-foreground leading-none">
        {t("tasks.leadRow.openCount", { count: summary.open_count })}
      </span>

      {/* Urgency badge for nearest task */}
      {summary.nearest_urgency && (
        <TaskUrgencyBadge urgency={summary.nearest_urgency} compact />
      )}

      {/* Nearest task title (truncated) */}
      {summary.nearest_title && (
        <TooltipContainer tooltipContent={summary.nearest_title}>
          <span
            className={cn(
              "text-[11px] text-muted-foreground truncate max-w-[100px]",
              summary.nearest_urgency === "overdue" && "text-red-600",
              summary.nearest_urgency === "due_soon" && "text-yellow-700"
            )}
          >
            {summary.nearest_title}
          </span>
        </TooltipContainer>
      )}
    </button>
  );
}
