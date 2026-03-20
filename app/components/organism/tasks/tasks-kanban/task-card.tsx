import { useDraggable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Link } from "react-router";
import { cn } from "~/lib/utils";
import { TaskUrgencyBadge } from "~/components/organism/tasks/task-urgency-badge";
import type { Task } from "~/lib/api/tasks";

interface TaskCardProps {
  task: Task;
  onSelect: () => void;
  disabled?: boolean;
  isDragging?: boolean;
  canEdit?: boolean;
}

function getAssigneeInitials(task: Task): string {
  const f = task.assignee_first_name?.trim() ?? "";
  const l = task.assignee_last_name?.trim() ?? "";
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  return "?";
}

export function TaskCard({
  task,
  onSelect,
  disabled,
  isDragging: isDraggingProp,
  canEdit = true,
}: TaskCardProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggingState,
  } = useDraggable({
    id: `task-${task.id}`,
    disabled: !canEdit || disabled,
  });

  const isDragging = isDraggingProp || isDraggingState;

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "rounded-lg border bg-card p-3 space-y-2 shadow-sm",
        canEdit && !disabled && "cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-shadow duration-150",
        isDragging && "opacity-90 shadow-lg ring-1 ring-primary/20",
      )}
      onClick={() => !isDragging && onSelect()}
    >
      {/* Title */}
      <p
        className={cn(
          "text-sm font-medium leading-snug",
          task.status === "done" && "line-through text-muted-foreground",
        )}
      >
        {task.title}
      </p>

      {/* Description snippet */}
      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Urgency + due date */}
      {(task.urgency || task.due_date) && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.urgency && (
            <TaskUrgencyBadge urgency={task.urgency} />
          )}
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(task.due_date), "MMM d")}
            </span>
          )}
        </div>
      )}

      {/* Lead name + assignee */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        {task.lead_full_name ? (
          <span
            className="text-[10px] text-muted-foreground truncate max-w-[120px]"
            title={task.lead_full_name}
          >
            {task.lead_full_name}
          </span>
        ) : (
          <span />
        )}

        {task.assignee_id && (
          <span
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold"
            title={`${task.assignee_first_name ?? ""} ${task.assignee_last_name ?? ""}`.trim()}
          >
            {getAssigneeInitials(task)}
          </span>
        )}
      </div>
    </div>
  );
}
