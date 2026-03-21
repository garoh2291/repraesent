import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthContext } from "~/providers/auth-provider";
import { useSearchParamsSelect } from "~/lib/hooks/useQueryParams";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { TasksKanban } from "~/components/organism/tasks/tasks-kanban";
import { TasksCalendar } from "~/components/organism/tasks/tasks-calendar";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  TaskFormModal,
  type WorkspaceMemberItem,
} from "~/components/organism/tasks/task-form-modal";
import { TaskDetailModal } from "~/components/organism/tasks/task-detail-modal";
import {
  getAllTasks,
  updateTask,
  type TaskStatus,
  type Task,
} from "~/lib/api/tasks";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { LayoutGrid, CalendarDays, Plus, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";

export function meta() {
  return [
    { title: "Tasks - Repraesent" },
    { name: "description", content: "Tasks" },
  ];
}

export default function TasksPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [onSelect, clearParams] = useSearchParamsSelect();

  const viewMode = (searchParams.get("view") ?? "kanban") as
    | "kanban"
    | "calendar";
  const assigneeFilter = searchParams.get("assignee") ?? "";
  const statusFilter = (searchParams.get("status") ?? "") as TaskStatus | "";
  const search = searchParams.get("search") ?? "";
  const debouncedSearch = useDebounce(search, 300);

  const selectedTaskId = searchParams.get("task_id") ?? null;
  const [formOpen, setFormOpen] = useState(false);

  const handleTaskSelect = useCallback(
    (taskId: string) => onSelect({ task_id: taskId }, true),
    [onSelect]
  );
  const handleTaskModalClose = useCallback(
    () => onSelect({ task_id: "" }, true),
    [onSelect]
  );

  const hasFilters = !!(assigneeFilter || statusFilter || debouncedSearch);
  const tasksQuery = useQuery({
    queryKey: [
      "tasks",
      debouncedSearch,
      statusFilter || undefined,
      assigneeFilter || undefined,
      viewMode,
    ],
    queryFn: () =>
      getAllTasks({
        limit: 200,
        search: debouncedSearch || undefined,
        status: (statusFilter || undefined) as TaskStatus | undefined,
        assignee_id: assigneeFilter || undefined,
      }),
    enabled: !!currentWorkspace,
    refetchOnMount: "always",
  });

  const workspaceQuery = useQuery({
    queryKey: ["workspace-detail"],
    queryFn: () => getWorkspaceDetail(),
    enabled: !!currentWorkspace,
  });

  const workspaceMembers: WorkspaceMemberItem[] = useMemo(
    () =>
      (workspaceQuery.data?.members ?? []).map((m) => ({
        user_id: m.user_id,
        user_first_name: m.user_first_name,
        user_last_name: m.user_last_name,
        user_email: m.user_email,
        role: m.role,
      })),
    [workspaceQuery.data]
  );

  const statusChangeMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      updateTask(taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const prev = queryClient.getQueryData([
        "tasks",
        debouncedSearch,
        statusFilter || undefined,
        assigneeFilter || undefined,
        viewMode,
      ]);
      queryClient.setQueryData(
        [
          "tasks",
          debouncedSearch,
          statusFilter || undefined,
          assigneeFilter || undefined,
          viewMode,
        ],
        (old: Awaited<ReturnType<typeof getAllTasks>> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((t) => (t.id === taskId ? { ...t, status } : t)),
          };
        }
      );
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) {
        queryClient.setQueryData(
          [
            "tasks",
            debouncedSearch,
            statusFilter || undefined,
            assigneeFilter || undefined,
            viewMode,
          ],
          ctx.prev
        );
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
    },
  });

  const tasks = tasksQuery.data?.data ?? [];

  return (
    <div
      className={cn(
        "app-fade-in",
        viewMode === "kanban"
          ? "flex flex-col min-h-[calc(100vh-8rem)] p-6 gap-6"
          : "p-6 space-y-6"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 app-fade-up">
        <div>
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            {t("tasks.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("tasks.pageHint")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* New task button */}
          <Button
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={() => setFormOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("tasks.newTask")}
          </Button>

          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button
              onClick={() => onSelect({ view: "kanban" }, true)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                viewMode === "kanban"
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              {t("tasks.kanbanView")}
            </button>
            <button
              onClick={() => onSelect({ view: "calendar" }, true)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                viewMode === "calendar"
                  ? "bg-white shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              {t("tasks.calendarView")}
            </button>
          </div>
        </div>
      </div>

      <div className="border-t border-border shrink-0" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 shrink-0 app-fade-up app-fade-up-d1">
        {/* Search */}
        <div className="relative">
          <Input
            value={search}
            onChange={(e) =>
              onSelect({ search: e.target.value, page: "1" }, true)
            }
            placeholder={t("tasks.searchPlaceholder")}
            className="h-9 w-[220px] text-sm pr-3"
          />
        </div>

        {/* Assignee filter */}
        <Select
          value={assigneeFilter || "all"}
          onValueChange={(v) =>
            onSelect({ assignee: v === "all" ? "" : v }, true)
          }
        >
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder={t("tasks.allAssignees")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              {t("tasks.allAssignees")}
            </SelectItem>
            {workspaceMembers.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id} className="text-xs">
                {m.user_first_name} {m.user_last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) =>
            onSelect({ status: v === "all" ? "" : v }, true)
          }
        >
          <SelectTrigger className="h-9 w-[140px] text-xs">
            <SelectValue placeholder={t("tasks.allStatuses")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">
              {t("tasks.allStatuses")}
            </SelectItem>
            {(["todo", "in_progress", "done"] as TaskStatus[]).map((s) => (
              <SelectItem key={s} value={s} className="text-xs">
                {t(`tasks.statuses.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {hasFilters && (
          <button
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
            onClick={() =>
              onSelect({ assignee: "", status: "", search: "" }, true)
            }
          >
            {t("tasks.clearFilters")} <X size={12} />
          </button>
        )}
      </div>

      {/* Content */}
      {viewMode === "kanban" ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <TasksKanban
            tasks={tasks}
            isLoading={tasksQuery.isLoading}
            onStatusChange={(taskId, status) =>
              statusChangeMutation.mutate({ taskId, status })
            }
            isUpdating={statusChangeMutation.isPending}
            canEdit={true}
            workspaceMembers={workspaceMembers}
            onTaskSelect={handleTaskSelect}
          />
        </div>
      ) : (
        <TasksCalendar
          tasks={tasks}
          isLoading={tasksQuery.isLoading}
          workspaceMembers={workspaceMembers}
          canEdit={true}
          onTaskSelect={handleTaskSelect}
        />
      )}

      {/* Task detail modal (sync with task_id URL param) */}
      <TaskDetailModal
        open={!!selectedTaskId}
        onOpenChange={(open) => !open && handleTaskModalClose()}
        taskId={selectedTaskId}
        workspaceMembers={workspaceMembers}
        canEdit={true}
      />

      {/* Task form modal */}
      <TaskFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        workspaceMembers={workspaceMembers}
      />
    </div>
  );
}
