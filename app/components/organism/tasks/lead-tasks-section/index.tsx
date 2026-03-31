import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { isToday, isTomorrow } from "date-fns";
import { Plus, Check } from "lucide-react";
import { formatDate } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import { TaskUrgencyBadge } from "~/components/organism/tasks/task-urgency-badge";
import { TaskFormModal, type WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import { TaskDetailModal } from "~/components/organism/tasks/task-detail-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  getTasksForLead,
  updateTask,
  type Task,
} from "~/lib/api/tasks";

function getAssigneeInitials(task: Task): string {
  const f = task.assignee_first_name?.trim() ?? "";
  const l = task.assignee_last_name?.trim() ?? "";
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return "?";
}

function formatDueDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return formatDate(d, "MMM d");
}

interface LeadTasksSectionProps {
  leadId: string;
  canEdit?: boolean;
  workspaceMembers: WorkspaceMemberItem[];
}

export function LeadTasksSection({
  leadId,
  canEdit = true,
  workspaceMembers,
}: LeadTasksSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [pendingToggle, setPendingToggle] = useState<{
    taskId: string;
    isDone: boolean;
  } | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["lead-tasks", leadId],
    queryFn: () => getTasksForLead(leadId),
    enabled: !!leadId,
  });

  const toggleDoneMutation = useMutation({
    mutationFn: ({ taskId, isDone }: { taskId: string; isDone: boolean }) =>
      updateTask(taskId, { status: isDone ? "done" : "todo" }),
    onMutate: async ({ taskId, isDone }) => {
      await queryClient.cancelQueries({ queryKey: ["lead-tasks", leadId] });
      const prev = queryClient.getQueryData<Task[]>(["lead-tasks", leadId]);
      queryClient.setQueryData<Task[]>(["lead-tasks", leadId], (old = []) =>
        old.map((t) =>
          t.id === taskId ? { ...t, status: isDone ? "done" : "todo" } : t,
        ),
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(["lead-tasks", leadId], ctx.prev);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", leadId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t("tasks.title")}
        </h3>
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 app-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
          <span className="text-sm text-muted-foreground">
            {t("common.loading")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("tasks.title")}{" "}
            {tasks.length > 0 && (
              <span className="ml-1 normal-case tracking-normal font-normal text-muted-foreground/60">
                ({tasks.length})
              </span>
            )}
          </h3>
          {canEdit && (
            <button
              onClick={() => setFormOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/60 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <Plus className="h-3 w-3" />
              {t("tasks.actions.addTask")}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {/* Open tasks */}
          {openTasks.length === 0 && doneTasks.length === 0 && (
            <p className="text-sm text-muted-foreground py-1">
              {t("tasks.noTasksHint")}
            </p>
          )}

          {openTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              canEdit={canEdit}
              onToggle={() =>
                setPendingToggle({ taskId: task.id, isDone: true })
              }
              onClick={() => setSelectedTaskId(task.id)}
              formatDueDate={formatDueDate}
              getAssigneeInitials={getAssigneeInitials}
            />
          ))}

          {/* Done tasks (collapsible) */}
          {doneTasks.length > 0 && (
            <div className="pt-1">
              <button
                onClick={() => setShowCompleted((v) => !v)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCompleted
                  ? t("tasks.hideCompleted")
                  : t("tasks.showCompleted", { count: doneTasks.length })}
              </button>

              {showCompleted && (
                <div className="mt-1.5 space-y-1.5">
                  {doneTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      canEdit={canEdit}
                      onToggle={() =>
                        setPendingToggle({ taskId: task.id, isDone: false })
                      }
                      onClick={() => setSelectedTaskId(task.id)}
                      formatDueDate={formatDueDate}
                      getAssigneeInitials={getAssigneeInitials}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <TaskFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        leadId={leadId}
        workspaceMembers={workspaceMembers}
      />

      <TaskDetailModal
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
        taskId={selectedTaskId}
        workspaceMembers={workspaceMembers}
        canEdit={canEdit}
      />

      {/* Confirm toggle done/reopen */}
      <AlertDialog
        open={!!pendingToggle}
        onOpenChange={(open) => !open && setPendingToggle(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingToggle?.isDone
                ? t("tasks.confirm.markDoneTitle")
                : t("tasks.confirm.reopenTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingToggle?.isDone
                ? t("tasks.confirm.markDoneDesc")
                : t("tasks.confirm.reopenDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingToggle) {
                  toggleDoneMutation.mutate({
                    taskId: pendingToggle.taskId,
                    isDone: pendingToggle.isDone,
                  });
                  setPendingToggle(null);
                }
              }}
            >
              {pendingToggle?.isDone
                ? t("tasks.actions.markDone")
                : t("tasks.actions.reopen")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function TaskRow({
  task,
  canEdit,
  onToggle,
  onClick,
  formatDueDate,
  getAssigneeInitials,
}: {
  task: Task;
  canEdit: boolean;
  onToggle: () => void;
  onClick: () => void;
  formatDueDate: (d: string) => string;
  getAssigneeInitials: (t: Task) => string;
}) {
  const isDone = task.status === "done";

  return (
    <div
      className={cn(
        "group flex items-start gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 transition-all duration-150",
        "hover:border-border/80 hover:shadow-sm",
      )}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (canEdit) onToggle();
        }}
        disabled={!canEdit}
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-150",
          isDone
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border group-hover:border-primary/40",
          !canEdit && "cursor-default",
        )}
      >
        {isDone && <Check className="h-2 w-2" />}
      </button>

      {/* Content */}
      <div
        className="flex-1 min-w-0 cursor-pointer"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      >
        <p
          className={cn(
            "text-sm font-medium leading-snug truncate",
            isDone && "line-through text-muted-foreground",
          )}
        >
          {task.title}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {task.urgency && <TaskUrgencyBadge urgency={task.urgency} />}
          {task.due_date && !task.urgency && (
            <span className="text-xs text-muted-foreground">
              {formatDueDate(task.due_date)}
            </span>
          )}
          {task.due_date && task.urgency && (
            <span className="text-xs text-muted-foreground">
              {formatDueDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      {/* Assignee avatar */}
      {task.assignee_id && (
        <div
          className="shrink-0 mt-0.5"
          title={`${task.assignee_first_name ?? ""} ${task.assignee_last_name ?? ""}`.trim()}
        >
          <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">
            {getAssigneeInitials(task)}
          </span>
        </div>
      )}
    </div>
  );
}
