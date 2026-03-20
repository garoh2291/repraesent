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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { cn } from "~/lib/utils";
import { TaskCard } from "./task-card";
import { TaskDetailModal } from "~/components/organism/tasks/task-detail-modal";
import { updateTask, type Task, type TaskStatus } from "~/lib/api/tasks";
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
}

export function TasksKanban({
  tasks,
  isLoading,
  onStatusChange,
  isUpdating,
  canEdit = true,
  workspaceMembers,
}: TasksKanbanProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-3 gap-4 flex-1 min-h-0 pb-4">
          {TASK_STATUS_COLUMNS.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasksByStatus[status]}
              onTaskSelect={(id) => setSelectedTaskId(id)}
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

      <TaskDetailModal
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        taskId={selectedTaskId}
        workspaceMembers={workspaceMembers}
        canEdit={canEdit}
      />
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
        "flex flex-col rounded-xl border bg-muted/50 transition-all duration-150 min-h-[200px]",
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
