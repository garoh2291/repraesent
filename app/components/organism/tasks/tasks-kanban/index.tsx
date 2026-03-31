import { useState, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { formatDate } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { TaskCard } from "./task-card";
import { TaskUrgencyBadge } from "~/components/organism/tasks/task-urgency-badge";
import { type Task, type TaskStatus } from "~/lib/api/tasks";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";

const TASK_STATUS_COLUMNS: TaskStatus[] = ["todo", "in_progress", "done"];

const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  todo: "bg-slate-400",
  in_progress: "bg-blue-500",
  done: "bg-emerald-500",
};

interface TasksKanbanProps {
  tasks: Task[];
  isLoading: boolean;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  isUpdating?: boolean;
  canEdit?: boolean;
  workspaceMembers: WorkspaceMemberItem[];
  onTaskSelect: (taskId: string) => void;
}

export function TasksKanban({
  tasks,
  isLoading,
  onStatusChange,
  isUpdating,
  canEdit = true,
  workspaceMembers,
  onTaskSelect,
}: TasksKanbanProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const undoStackRef = useRef<
    Array<{ taskId: string; previousStatus: TaskStatus }>
  >([]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const taskId = String(active.id).replace(/^task-/, "");
      const newStatus = String(over.id) as TaskStatus;

      const task = tasks.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) return;

      undoStackRef.current.push({
        taskId,
        previousStatus: task.status,
      });
      onStatusChange(taskId, newStatus);
    },
    [tasks, onStatusChange],
  );

  // Undo with Cmd+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const last = undoStackRef.current.pop();
        if (last) onStatusChange(last.taskId, last.previousStatus);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onStatusChange]);

  const tasksByStatus = TASK_STATUS_COLUMNS.reduce(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>,
  );

  const activeTask = activeId
    ? tasks.find((t) => t.id === String(activeId).replace(/^task-/, ""))
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <div className="h-5 w-5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Schedule-style accordion list */}
      <div className="sm:hidden">
        <TasksMobileSchedule
          tasksByStatus={tasksByStatus}
          onTaskSelect={onTaskSelect}
        />
      </div>

      {/* Desktop: Kanban board */}
      <div className="hidden sm:block flex-1 min-h-0">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 flex-1 min-h-0 pb-4 overflow-x-auto scrollbar-hide sm:grid sm:grid-cols-3">
            {TASK_STATUS_COLUMNS.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasksByStatus[status]}
                onTaskSelect={onTaskSelect}
                isUpdating={isUpdating}
                canEdit={canEdit}
                colorClass={TASK_STATUS_COLORS[status]}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTask ? (
              <TaskCard
                task={activeTask}
                onSelect={() => {}}
                isDragging
                canEdit={canEdit}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </>
  );
}

function KanbanColumn({
  status,
  tasks,
  onTaskSelect,
  isUpdating,
  canEdit,
  colorClass,
}: {
  status: TaskStatus;
  tasks: Task[];
  onTaskSelect: (id: string) => void;
  isUpdating?: boolean;
  canEdit?: boolean;
  colorClass: string;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const isEmpty = tasks.length === 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-xl border bg-muted/50 transition-all duration-150 min-h-[200px] min-w-[240px] sm:min-w-0 shrink-0 sm:shrink",
        isOver && "ring-2 ring-primary/40 bg-primary/5",
      )}
    >
      {/* Column header accent */}
      <div className={cn("h-1 rounded-t-xl shrink-0", colorClass)} />

      {/* Column title */}
      <div className="shrink-0 px-3 pt-3 pb-2">
        <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
          <span className={cn("inline-block h-2 w-2 rounded-full", colorClass)} />
          <span>{t(`tasks.statuses.${status}`)}</span>
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-background px-1.5 text-xs font-medium text-muted-foreground">
            {tasks.length}
          </span>
        </h3>
      </div>

      {/* Cards */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2">
        {isEmpty ? (
          <div className="flex items-center justify-center py-8 text-xs text-muted-foreground/50">
            —
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onSelect={() => onTaskSelect(task.id)}
              disabled={isUpdating}
              canEdit={canEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ─── Mobile Schedule List (Google Calendar-style) ─── */

function TasksMobileSchedule({
  tasksByStatus,
  onTaskSelect,
}: {
  tasksByStatus: Record<TaskStatus, Task[]>;
  onTaskSelect: (id: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2 pt-2 pb-6">
      {TASK_STATUS_COLUMNS.map((status) => {
        const tasks = tasksByStatus[status];
        const colorClass = TASK_STATUS_COLORS[status];
        const count = tasks.length;

        return (
          <ScheduleSection
            key={status}
            defaultOpen={count > 0}
            header={
              <>
                <div className={cn("h-8 w-1 rounded-full shrink-0", colorClass)} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-semibold text-foreground">
                    {t(`tasks.statuses.${status}`)}
                  </span>
                </div>
                <span
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold",
                    count > 0
                      ? `${colorClass} text-white`
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              </>
            }
          >
            {count === 0 ? (
              <div className="px-4 pb-4 pt-1">
                <p className="text-xs text-muted-foreground/50 text-center py-3">
                  —
                </p>
              </div>
            ) : (
              <div className="px-3 pb-3 space-y-1">
                {tasks.map((task) => (
                  <TaskScheduleRow
                    key={task.id}
                    task={task}
                    colorClass={colorClass}
                    onSelect={() => onTaskSelect(task.id)}
                  />
                ))}
              </div>
            )}
          </ScheduleSection>
        );
      })}
    </div>
  );
}

function TaskScheduleRow({
  task,
  colorClass,
  onSelect,
}: {
  task: Task;
  colorClass: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/60 active:bg-muted"
      )}
    >
      {/* Color accent line */}
      <div className={cn("mt-1 h-4 w-0.5 rounded-full shrink-0", colorClass)} />

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p
          className={cn(
            "text-sm font-medium leading-snug truncate",
            task.status === "done" && "line-through text-muted-foreground"
          )}
        >
          {task.title}
        </p>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {task.description}
          </p>
        )}

        {/* Meta row: urgency, due date, lead name */}
        <div className="flex items-center gap-2 flex-wrap pt-0.5">
          {task.urgency && <TaskUrgencyBadge urgency={task.urgency} />}
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground">
              {formatDate(new Date(task.due_date), "MMM d")}
            </span>
          )}
          {task.lead_full_name && (
            <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
              {task.lead_full_name}
            </span>
          )}
        </div>
      </div>

      {/* Assignee avatar */}
      {task.assignee_id && (
        <span
          className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground"
          title={`${task.assignee_first_name ?? ""} ${task.assignee_last_name ?? ""}`.trim()}
        >
          {(() => {
            const f = task.assignee_first_name?.trim() ?? "";
            const l = task.assignee_last_name?.trim() ?? "";
            if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
            if (f) return f.slice(0, 2).toUpperCase();
            return "?";
          })()}
        </span>
      )}
    </button>
  );
}

/* ─── Lightweight disclosure (no Radix, no mount/unmount) ─── */

function ScheduleSection({
  defaultOpen,
  header,
  children,
}: {
  defaultOpen: boolean;
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card overflow-hidden",
        "shadow-[0_1px_2px_0_rgba(0,0,0,0.04)]"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        {header}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
