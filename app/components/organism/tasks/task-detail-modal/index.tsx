import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { format, formatDistanceToNow } from "date-fns";
import { Link } from "react-router";
import {
  Pencil,
  Trash2,
  ExternalLink,
  CalendarIcon,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import { Calendar } from "~/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { cn } from "~/lib/utils";
import TooltipContainer from "~/components/tooltip-container";
import { TaskUrgencyBadge } from "~/components/organism/tasks/task-urgency-badge";
import { TaskFormModal, type WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import {
  getTask,
  getTaskHistory,
  updateTask,
  deleteTask,
  type TaskHistoryItem,
} from "~/lib/api/tasks";

function formatHistoryAction(item: TaskHistoryItem, t: ReturnType<typeof useTranslation>["t"]): string {
  if (item.action === "task_created") return t("tasks.detail.historyTaskCreated");
  if (item.action === "task_deleted") return t("tasks.detail.historyTaskDeleted");
  if (item.action === "task_updated") {
    const details = item.details as Record<string, unknown>;
    if (details.new_status) {
      const newStatus = details.new_status as string;
      return t("tasks.detail.historyStatusChanged", {
        newStatus: t(`tasks.statuses.${newStatus}`, { defaultValue: newStatus }),
      });
    }
    return t("tasks.detail.historyTaskUpdated");
  }
  return item.action.replace(/_/g, " ");
}

function getInitials(first: string | null, last: string | null): string {
  const f = first?.trim() ?? "";
  const l = last?.trim() ?? "";
  if (f && l) return `${f[0]}${l[0]}`.toUpperCase();
  if (f) return f.slice(0, 2).toUpperCase();
  if (l) return l.slice(0, 2).toUpperCase();
  return "S";
}

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string | null;
  workspaceMembers: WorkspaceMemberItem[];
  canEdit?: boolean;
}

export function TaskDetailModal({
  open,
  onOpenChange,
  taskId,
  workspaceMembers,
  canEdit = true,
}: TaskDetailModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: task, isLoading, isError } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId!),
    enabled: !!taskId && open,
    retry: false,
  });

  // Close modal immediately when the backend returns an error (e.g. invalid/unknown task ID)
  useEffect(() => {
    if (isError) onOpenChange(false);
  }, [isError, onOpenChange]);

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: ["task-history", taskId],
    queryFn: () => getTaskHistory(taskId!),
    enabled: !!taskId && open,
  });

  const invalidateTask = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["task", taskId] });
    queryClient.invalidateQueries({ queryKey: ["task-history", taskId] });
    if (task?.entity_id) {
      queryClient.invalidateQueries({ queryKey: ["lead-tasks", task.entity_id] });
    }
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  }, [queryClient, taskId, task]);

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) =>
      updateTask(taskId!, { status: status as any }),
    onSuccess: invalidateTask,
  });

  const updateAssigneeMutation = useMutation({
    mutationFn: (assigneeId: string | null) =>
      updateTask(taskId!, { assignee_id: assigneeId }),
    onSuccess: invalidateTask,
  });

  const updateDueDateMutation = useMutation({
    mutationFn: (dueDate: Date | null) =>
      updateTask(taskId!, { due_date: dueDate ? dueDate.toISOString() : null }),
    onSuccess: invalidateTask,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteTask(taskId!),
    onSuccess: () => {
      invalidateTask();
      onOpenChange(false);
    },
  });

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[560px] max-h-[90vh] flex flex-col overflow-hidden p-0">
          {isLoading || !task ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-5 w-5 app-spin rounded-full border-2 border-primary/20 border-t-primary" />
            </div>
          ) : (
            <>
              {/* Header — pr-12 reserves space for the dialog's own X close button */}
              <DialogHeader className="px-5 pt-5 pb-3 shrink-0 pr-12">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <TooltipContainer
                      tooltipContent={task.title}
                      showCopyButton={false}
                    >
                      <DialogTitle
                        className={cn(
                          "text-base font-semibold leading-snug truncate",
                          task.status === "done" &&
                            "line-through text-muted-foreground",
                        )}
                      >
                        {task.title}
                      </DialogTitle>
                    </TooltipContainer>

                    {/* Attached lead */}
                    {task.lead_full_name && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>{t("tasks.detail.attachedLead")}:</span>
                        <Link
                          to={`/lead-form/${task.entity_id}`}
                          className="font-medium text-foreground hover:underline inline-flex items-center gap-0.5"
                          onClick={() => onOpenChange(false)}
                        >
                          {task.lead_full_name}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                    )}
                  </div>

                  {/* Action buttons — placed next to title, clear of the X button via pr-12 */}
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-7 w-7"
                        onClick={() => setEditOpen(true)}
                        title={t("tasks.actions.edit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                        title={t("tasks.actions.delete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </DialogHeader>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4 space-y-5">
                {/* Description */}
                {task.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {task.description}
                  </p>
                )}

                {/* Metadata grid */}
                <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-3">
                  {/* Status */}
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-1.5">
                    {t("tasks.fields.status")}
                  </span>
                  <div>
                    {canEdit ? (
                      <Select
                        value={task.status}
                        onValueChange={(v) => updateStatusMutation.mutate(v)}
                        disabled={updateStatusMutation.isPending}
                      >
                        <SelectTrigger className="h-8 text-xs w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(["todo", "in_progress", "done"] as const).map(
                            (s) => (
                              <SelectItem key={s} value={s} className="text-xs">
                                {t(`tasks.statuses.${s}`)}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="inline-flex items-center rounded-lg bg-muted/60 px-3 py-1.5 text-xs">
                        {t(`tasks.statuses.${task.status}`)}
                      </span>
                    )}
                  </div>

                  {/* Due date */}
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-1.5">
                    {t("tasks.fields.dueDate")}
                  </span>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs transition-colors hover:bg-muted",
                              !task.due_date && "text-muted-foreground",
                            )}
                          >
                            <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                            {task.due_date
                              ? format(new Date(task.due_date), "PPP")
                              : t("tasks.form.dueDatePlaceholder")}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={
                              task.due_date
                                ? new Date(task.due_date)
                                : undefined
                            }
                            onSelect={(d) => {
                              updateDueDateMutation.mutate(d ?? null);
                              setCalendarOpen(false);
                            }}
                            initialFocus
                          />
                          {task.due_date && (
                            <div className="border-t p-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full text-xs"
                                onClick={() => {
                                  updateDueDateMutation.mutate(null);
                                  setCalendarOpen(false);
                                }}
                              >
                                <X className="h-3 w-3 mr-1" />
                                {t("common.remove")}
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                    ) : task.due_date ? (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(task.due_date), "PPP")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                    {task.urgency && (
                      <TaskUrgencyBadge urgency={task.urgency} />
                    )}
                  </div>

                  {/* Assignee */}
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-1.5">
                    {t("tasks.fields.assignee")}
                  </span>
                  <div>
                    {canEdit ? (
                      <Select
                        value={task.assignee_id ?? "unassigned"}
                        onValueChange={(v) =>
                          updateAssigneeMutation.mutate(
                            v === "unassigned" ? null : v,
                          )
                        }
                        disabled={updateAssigneeMutation.isPending}
                      >
                        <SelectTrigger className="h-8 text-xs w-[180px]">
                          <SelectValue placeholder={t("tasks.form.unassigned")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned" className="text-xs">
                            {t("tasks.form.unassigned")}
                          </SelectItem>
                          {workspaceMembers.map((m) => (
                            <SelectItem
                              key={m.user_id}
                              value={m.user_id}
                              className="text-xs"
                            >
                              {m.user_first_name} {m.user_last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : task.assignee_id ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">
                          {getInitials(
                            task.assignee_first_name,
                            task.assignee_last_name,
                          )}
                        </span>
                        {task.assignee_first_name} {task.assignee_last_name}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </div>

                  {/* Created by */}
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground pt-1">
                    {t("tasks.fields.createdBy")}
                  </span>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">
                      {getInitials(
                        task.creator_first_name,
                        task.creator_last_name,
                      )}
                    </span>
                    <span>
                      {task.creator_first_name} {task.creator_last_name}
                    </span>
                    <span className="text-muted-foreground/60">·</span>
                    <span>
                      {formatDistanceToNow(new Date(task.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>

                {/* History */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    {t("tasks.detail.history")}
                  </h4>
                  {historyLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 app-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground/60" />
                      <span className="text-sm text-muted-foreground">
                        {t("common.loading")}
                      </span>
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {t("tasks.detail.noHistory")}
                    </p>
                  ) : (
                    <div className="relative pl-4">
                      <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                      <div className="space-y-0">
                        {history.map((item, idx) => {
                          const actionText = formatHistoryAction(item, t);
                          const relativeTime = item.created_at
                            ? formatDistanceToNow(new Date(item.created_at), {
                                addSuffix: true,
                              })
                            : "";
                          return (
                            <div
                              key={idx}
                              className="relative flex gap-3 pb-4 last:pb-0"
                            >
                              <div className="absolute -left-[9px] top-1.5 z-10">
                                <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-border ring-2 ring-background" />
                              </div>
                              <div className="min-w-0 flex-1 py-0.5 pl-2">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {actionText}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                  <TooltipContainer
                                    tooltipContent={
                                      item.user_first_name && item.user_last_name
                                        ? `${item.user_first_name} ${item.user_last_name}`
                                        : t("tasks.detail.system")
                                    }
                                    showCopyButton={false}
                                  >
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold">
                                      {getInitials(
                                        item.user_first_name,
                                        item.user_last_name,
                                      )}
                                    </span>
                                  </TooltipContainer>
                                  <span>{relativeTime}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      {task && (
        <TaskFormModal
          open={editOpen}
          onOpenChange={setEditOpen}
          leadId={task.entity_id}
          task={task}
          workspaceMembers={workspaceMembers}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["task", taskId] });
          }}
        />
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("tasks.actions.confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("tasks.actions.confirmDeleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-foreground text-background hover:opacity-90 transition-opacity"
              onClick={() => deleteMutation.mutate()}
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
