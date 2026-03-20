import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  addDays,
  addWeeks,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { TaskDetailModal } from "~/components/organism/tasks/task-detail-modal";
import type { Task } from "~/lib/api/tasks";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";

type CalViewType = "month" | "week";

interface TasksCalendarProps {
  tasks: Task[];
  isLoading?: boolean;
  workspaceMembers: WorkspaceMemberItem[];
  canEdit?: boolean;
  onMonthChange?: (year: number, month: number) => void;
}

export function TasksCalendar({
  tasks,
  isLoading,
  workspaceMembers,
  canEdit = true,
  onMonthChange,
}: TasksCalendarProps) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [calViewType, setCalViewType] = useState<CalViewType>("month");

  // --- Month view data ---
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calStart, end: calEnd });

  // --- Week view data ---
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  const tasksByDay: Record<string, Task[]> = {};
  for (const task of tasks) {
    if (!task.due_date) continue;
    const key = format(new Date(task.due_date), "yyyy-MM-dd");
    if (!tasksByDay[key]) tasksByDay[key] = [];
    tasksByDay[key].push(task);
  }

  const prev = () => {
    const d = new Date(currentDate);
    if (calViewType === "week") {
      setCurrentDate(subWeeks(d, 1));
    } else {
      d.setMonth(d.getMonth() - 1);
      setCurrentDate(d);
      onMonthChange?.(d.getFullYear(), d.getMonth() + 1);
    }
  };

  const next = () => {
    const d = new Date(currentDate);
    if (calViewType === "week") {
      setCurrentDate(addWeeks(d, 1));
    } else {
      d.setMonth(d.getMonth() + 1);
      setCurrentDate(d);
      onMonthChange?.(d.getFullYear(), d.getMonth() + 1);
    }
  };

  const goToday = () => setCurrentDate(new Date());

  const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const taskPillClass = (task: Task) =>
    cn(
      "text-[10px] leading-tight truncate rounded border px-1 py-0.5 cursor-pointer hover:opacity-80 transition-opacity",
      task.status === "done"
        ? "border-border/30 text-muted-foreground/60 line-through"
        : task.urgency === "overdue"
          ? "border-red-200 bg-red-50 text-red-700"
          : task.urgency === "due_soon"
            ? "border-yellow-200 bg-yellow-50 text-yellow-800"
            : "border-border bg-muted text-foreground",
    );

  const navigationTitle =
    calViewType === "week"
      ? `${format(weekStart, "MMM d")} – ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
      : format(currentDate, "MMMM yyyy");

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Calendar header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label={t("tasks.calendar.prevMonth")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-base font-semibold text-foreground min-w-[180px] text-center">
              {navigationTitle}
            </h2>
            <button
              type="button"
              onClick={next}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label={t("tasks.calendar.nextMonth")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View type toggle */}
            <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
              <button
                type="button"
                onClick={() => setCalViewType("month")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                  calViewType === "month"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("tasks.calendar.monthView")}
              </button>
              <button
                type="button"
                onClick={() => setCalViewType("week")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150",
                  calViewType === "week"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("tasks.calendar.weekView")}
              </button>
            </div>

            <button
              type="button"
              onClick={goToday}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
            >
              {t("tasks.calendar.today")}
            </button>
          </div>
        </div>

        {/* ── Month View ── */}
        {calViewType === "month" && (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-1"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {monthDays.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayTasks = tasksByDay[key] ?? [];
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isExpanded = expandedDay === key;
                const hasUrgent = dayTasks.some((t) =>
                  ["overdue", "due_soon"].includes(t.urgency ?? ""),
                );

                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[80px] rounded-lg border p-1.5 transition-colors duration-150",
                      isCurrentMonth
                        ? "border-border bg-card"
                        : "border-border/40 bg-muted/20",
                      isToday(day) && "border-primary/40 bg-primary/5",
                      dayTasks.length > 0 && "cursor-pointer hover:bg-muted/50",
                    )}
                    onClick={() => {
                      if (dayTasks.length > 0) {
                        setExpandedDay(isExpanded ? null : key);
                      }
                    }}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-medium",
                          isToday(day)
                            ? "bg-primary text-primary-foreground"
                            : isCurrentMonth
                              ? "text-foreground"
                              : "text-muted-foreground/50",
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {hasUrgent && (
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      )}
                    </div>

                    {/* Task items */}
                    {!isExpanded && dayTasks.length > 0 && (
                      <div className="space-y-0.5 mt-1">
                        {dayTasks.slice(0, 2).map((task) => (
                          <div
                            key={task.id}
                            className={taskPillClass(task)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(task.id);
                            }}
                          >
                            {task.title}
                          </div>
                        ))}
                        {dayTasks.length > 2 && (
                          <div className="text-[10px] text-muted-foreground pl-1">
                            +{dayTasks.length - 2} more
                          </div>
                        )}
                      </div>
                    )}

                    {/* Expanded list */}
                    {isExpanded && (
                      <div className="mt-1 space-y-0.5">
                        {dayTasks.map((task) => (
                          <div
                            key={task.id}
                            className={taskPillClass(task)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskId(task.id);
                            }}
                          >
                            {task.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── Week View ── */}
        {calViewType === "week" && (
          <div className="grid grid-cols-7 gap-2">
            {weekDays.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay[key] ?? [];

              return (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col rounded-lg border min-h-[160px]",
                    isToday(day)
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card",
                  )}
                >
                  {/* Day header */}
                  <div
                    className={cn(
                      "px-2 py-2 text-center border-b",
                      isToday(day) ? "border-primary/20" : "border-border",
                    )}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold",
                        isToday(day)
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="flex-1 p-1.5 space-y-0.5">
                    {dayTasks.length === 0 ? (
                      <div className="flex items-center justify-center h-full py-4">
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      </div>
                    ) : (
                      dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className={taskPillClass(task)}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          {task.title}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
