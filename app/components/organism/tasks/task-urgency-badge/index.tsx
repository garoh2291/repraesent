import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import type { TaskUrgency } from "~/lib/api/tasks";

interface TaskUrgencyBadgeProps {
  urgency: TaskUrgency;
  className?: string;
  compact?: boolean;
}

const URGENCY_STYLES: Record<
  NonNullable<TaskUrgency>,
  { badge: string; dot: string }
> = {
  overdue: {
    badge: "text-red-600 bg-red-50 border-red-200",
    dot: "bg-red-500",
  },
  due_soon: {
    badge: "text-yellow-700 bg-yellow-50 border-yellow-200",
    dot: "bg-yellow-500",
  },
  upcoming: {
    badge: "text-amber-700 bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
  },
};

export function TaskUrgencyBadge({
  urgency,
  className,
  compact = false,
}: TaskUrgencyBadgeProps) {
  const { t } = useTranslation();

  if (!urgency) return null;

  const styles = URGENCY_STYLES[urgency];

  if (compact) {
    return (
      <span
        className={cn(
          "inline-block h-2 w-2 rounded-full flex-shrink-0",
          styles.dot,
          className,
        )}
        title={t(`tasks.urgency.${urgency}`)}
      />
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold leading-none",
        styles.badge,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", styles.dot)} />
      {t(`tasks.urgency.${urgency}`)}
    </span>
  );
}
