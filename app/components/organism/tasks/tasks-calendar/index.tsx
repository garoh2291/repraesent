import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  format as dateFnsFormat,
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
import { formatDate } from "~/lib/utils/format";
import type { Task } from "~/lib/api/tasks";
import type { WorkspaceMemberItem } from "~/components/organism/tasks/task-form-modal";
import { Segmented } from "~/components/notebook/segmented";

type CalViewType = "month" | "week";

interface TasksCalendarProps {
  tasks: Task[];
  isLoading?: boolean;
  workspaceMembers: WorkspaceMemberItem[];
  canEdit?: boolean;
  onMonthChange?: (year: number, month: number) => void;
  onTaskSelect: (taskId: string) => void;
}

export function TasksCalendar({
  tasks,
  isLoading,
  workspaceMembers,
  canEdit = true,
  onMonthChange,
  onTaskSelect,
}: TasksCalendarProps) {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [calViewType, setCalViewType] = useState<CalViewType>("month");
  // Phones: the grid only shows counts; the tapped day's tasks list below it.
  const [phoneDay, setPhoneDay] = useState<string>(() =>
    dateFnsFormat(new Date(), "yyyy-MM-dd"),
  );

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
    const key = dateFnsFormat(new Date(task.due_date), "yyyy-MM-dd");
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
      ? `${formatDate(weekStart, "MMM d")} – ${formatDate(addDays(weekStart, 6), "MMM d, yyyy")}`
      : formatDate(currentDate, "MMMM yyyy");

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Calendar header */}
        <div className="flex items-center justify-between max-sm:flex-col max-sm:items-stretch max-sm:gap-2">
          <div className="flex items-center gap-2 max-sm:justify-between">
            <button
              type="button"
              onClick={prev}
              className="flex h-8 w-8 max-sm:h-11 max-sm:w-11 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label={t("tasks.calendar.prevMonth")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h2 className="text-sm sm:text-base font-semibold text-foreground min-w-[120px] sm:min-w-[180px] text-center max-sm:flex-1 max-sm:text-[15px]">
              {navigationTitle}
            </h2>
            <button
              type="button"
              onClick={next}
              className="flex h-8 w-8 max-sm:h-11 max-sm:w-11 shrink-0 items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors"
              aria-label={t("tasks.calendar.nextMonth")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* View type toggle */}
            <Segmented
              label={t("tasks.calendar.viewTypeLabel", "Month or week")}
              value={calViewType}
              onChange={setCalViewType}
              stretch
              className="max-sm:flex-1"
              options={[
                { value: "month", label: t("tasks.calendar.monthView") },
                { value: "week", label: t("tasks.calendar.weekView") },
              ]}
            />

            <button
              type="button"
              onClick={goToday}
              className="press rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors max-sm:min-h-11 max-sm:rounded-xl max-sm:px-4 max-sm:text-sm"
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
                const key = dateFnsFormat(day, "yyyy-MM-dd");
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
                      "min-h-[80px] max-sm:min-h-12 max-sm:p-1 rounded-lg border p-1.5 transition-colors duration-150",
                      isCurrentMonth
                        ? "border-border bg-card"
                        : "border-border/40 bg-muted/20",
                      isToday(day) && "border-primary/40 bg-primary/5",
                      dayTasks.length > 0 && "cursor-pointer hover:bg-muted/50",
                      phoneDay === key && "max-sm:ring-2 max-sm:ring-foreground/70",
                    )}
                    onClick={() => {
                      setPhoneDay(key);
                      if (dayTasks.length > 0) {
                        setExpandedDay(isExpanded ? null : key);
                      }
                    }}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1 max-sm:mb-0 max-sm:justify-center">
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
                        {formatDate(day, "d")}
                      </span>
                      {hasUrgent && (
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 max-sm:hidden" />
                      )}
                    </div>

                    {/* Phones: a count instead of cramped titles */}
                    {dayTasks.length > 0 && (
                      <div className="flex justify-center sm:hidden">
                        <DayCount count={dayTasks.length} urgent={hasUrgent} />
                      </div>
                    )}

                    {/* Task items */}
                    {!isExpanded && dayTasks.length > 0 && (
                      <div className="space-y-0.5 mt-1 max-sm:hidden">
                        {dayTasks.slice(0, 2).map((task) => (
                          <div
                            key={task.id}
                            className={taskPillClass(task)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTaskSelect(task.id);
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
                      <div className="mt-1 space-y-0.5 max-sm:hidden">
                        {dayTasks.map((task) => (
                          <div
                            key={task.id}
                            className={taskPillClass(task)}
                            onClick={(e) => {
                              e.stopPropagation();
                              onTaskSelect(task.id);
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
          <div className="grid grid-cols-7 gap-2 max-sm:gap-1">
            {weekDays.map((day) => {
              const key = dateFnsFormat(day, "yyyy-MM-dd");
              const dayTasks = tasksByDay[key] ?? [];
              const hasUrgent = dayTasks.some((t) =>
                ["overdue", "due_soon"].includes(t.urgency ?? ""),
              );

              return (
                <div
                  key={key}
                  className={cn(
                    "flex flex-col rounded-lg border min-h-[160px] max-sm:min-h-0",
                    isToday(day)
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card",
                    phoneDay === key && "max-sm:ring-2 max-sm:ring-foreground/70",
                  )}
                  onClick={() => setPhoneDay(key)}
                >
                  {/* Day header */}
                  <div
                    className={cn(
                      "px-2 py-2 max-sm:px-0.5 text-center border-b max-sm:border-b-0",
                      isToday(day) ? "border-primary/20" : "border-border",
                    )}
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {formatDate(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "mx-auto mt-1 flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold",
                        isToday(day)
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground",
                      )}
                    >
                      {formatDate(day, "d")}
                    </div>
                  </div>

                  {/* Tasks */}
                  {dayTasks.length > 0 && (
                    <div className="flex justify-center pb-1.5 sm:hidden">
                      <DayCount count={dayTasks.length} urgent={hasUrgent} />
                    </div>
                  )}
                  <div className="flex-1 p-1.5 space-y-0.5 max-sm:hidden">
                    {dayTasks.length === 0 ? (
                      <div className="flex items-center justify-center h-full py-4">
                        <span className="text-[10px] text-muted-foreground/40">—</span>
                      </div>
                    ) : (
                      dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className={taskPillClass(task)}
                          onClick={() => onTaskSelect(task.id)}
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

        {/* Phones: the tapped day's tasks */}
        <PhoneDayList
          dayKey={phoneDay}
          tasks={tasksByDay[phoneDay] ?? []}
          onTaskSelect={onTaskSelect}
        />
      </div>
    </>
  );
}

function DayCount({ count, urgent }: { count: number; urgent: boolean }) {
  return (
    <span
      className={cn(
        "num inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
        urgent ? "bg-red-500 text-white" : "bg-foreground text-background",
      )}
    >
      {count}
    </span>
  );
}

function PhoneDayList({
  dayKey,
  tasks,
  onTaskSelect,
}: {
  dayKey: string;
  tasks: Task[];
  onTaskSelect: (taskId: string) => void;
}) {
  const { t } = useTranslation();
  const [y, m, d] = dayKey.split("-").map(Number);
  const day = new Date(y, m - 1, d);
  return (
    <section className="sm:hidden" aria-live="polite">
      <h3 className="mb-2 text-[15px] font-semibold text-foreground">
        {formatDate(day, "EEEE, MMM d")}
      </h3>
      {tasks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-[14px] text-muted-foreground">
          {t("tasks.calendar.nothingThisDay", "Nothing due this day.")}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                type="button"
                onClick={() => onTaskSelect(task.id)}
                className="press flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left"
              >
                <span
                  aria-hidden
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    task.status === "done"
                      ? "bg-muted-foreground/30"
                      : task.urgency === "overdue"
                        ? "bg-red-500"
                        : task.urgency === "due_soon"
                          ? "bg-yellow-500"
                          : "bg-foreground/40",
                  )}
                />
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[15px]",
                    task.status === "done"
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {task.title}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
