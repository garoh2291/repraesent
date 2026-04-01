import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  AlertCircle,
  Clock,
  Globe,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  format,
  isToday,
  isTomorrow,
  isPast,
  addDays,
  subDays,
} from "date-fns";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { formatDate as fmtDate, formatRelativeTime, formatDateShort, formatNumber } from "~/lib/utils/format";
import { getLeadAnalytics, type LeadAnalyticsPeriod } from "~/lib/api/leads";
import { getAllTasks, type Task } from "~/lib/api/tasks";
import {
  getWorkspacePlausibleStats,
  type PlausiblePeriod,
} from "~/lib/api/workspaces";

export function meta() {
  return [
    { title: "Home - Repraesent" },
    { name: "description", content: "Dashboard home" },
  ];
}

function usePeriods(): { value: LeadAnalyticsPeriod; labelKey: string }[] {
  return [
    { value: "today", labelKey: "home.periodToday" },
    { value: "this_week", labelKey: "home.periodThisWeek" },
    { value: "this_month", labelKey: "home.periodThisMonth" },
    { value: "all_time", labelKey: "home.periodAllTime" },
  ];
}

const FORM_NAME_COLORS = [
  "#5265f3",
  "#f5d74f",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#38bdf8",
  "#f87171",
];

function getFormNameColor(index: number): string {
  return FORM_NAME_COLORS[index % FORM_NAME_COLORS.length];
}

function fillSeriesGaps(
  series: { date: string; count: number }[],
  period: LeadAnalyticsPeriod
): { date: string; count: number }[] {
  const now = new Date();
  const map = new Map(series.map((p) => [p.date, p.count]));
  const slots: string[] = [];

  if (period === "today") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let h = 0; h <= now.getHours(); h++) {
      const d = new Date(today);
      d.setHours(h);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00`;
      slots.push(key);
    }
  } else if (period === "this_week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  } else if (period === "this_month") {
    const days = now.getDate();
    for (let i = 1; i <= days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  } else {
    if (series.length === 0) return [];
    const start = new Date(series[0].date + "T00:00:00");
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  }

  return slots.map((key) => ({ date: key, count: map.get(key) ?? 0 }));
}

function formatXLabel(date: string, period: LeadAnalyticsPeriod): string {
  if (period === "today") {
    const hour = parseInt(date.slice(11, 13), 10);
    return `${hour.toString().padStart(2, "0")}:00`;
  }
  const [year, month, day] = date.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return formatDateShort(d);
}

function CustomTooltip({
  active,
  payload,
  label,
  period,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  period: LeadAnalyticsPeriod;
}) {
  const { t } = useTranslation();
  if (!active || !payload?.length || !label) return null;
  const count = payload[0].value;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-[13px]">
      <p className="text-muted-foreground mb-0.5">
        {formatXLabel(label, period)}
      </p>
      <p className="font-semibold text-foreground">
        {t("home.tooltipLead", { count })}
      </p>
    </div>
  );
}

function LeadAnalyticsChart() {
  const { currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  const periods = usePeriods();
  const [period, setPeriod] = useState<LeadAnalyticsPeriod>("this_week");

  const { data, isLoading } = useQuery({
    queryKey: ["leadAnalytics", currentWorkspace?.id, period],
    queryFn: () => getLeadAnalytics(period),
    enabled: !!currentWorkspace?.id,
  });

  const chartData = useMemo(
    () => fillSeriesGaps(data?.series ?? [], period),
    [data?.series, period]
  );

  const maxY = Math.max(...chartData.map((p) => p.count), 1);
  const yDomain: [number, number] = [0, maxY + Math.ceil(maxY * 0.2)];

  const tickCount = chartData.length;
  const tickStep =
    tickCount <= 10 ? 1 : tickCount <= 20 ? 2 : Math.ceil(tickCount / 10);
  const xTicks = chartData
    .filter((_, i) => i % tickStep === 0 || i === chartData.length - 1)
    .map((p) => p.date);

  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5"
      style={{ animationDelay: "0.06s" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("home.leadsChartTitle")}
          </p>
          {isLoading ? (
            <div className="h-8 w-12 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {data?.total ?? 0}
            </p>
          )}
        </div>

        <Link
          to="/lead-form"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0 mt-1"
        >
          {t("home.viewAllLeads")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-center gap-1 rounded-xl bg-muted p-1 overflow-x-auto scrollbar-hide w-fit">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-[12px] font-medium transition-all duration-150 whitespace-nowrap shrink-0",
              period === p.value
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(p.labelKey)}
          </button>
        ))}
      </div>

      {!isLoading && data && data.form_names.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.form_names.map((f, idx) => (
            <Link
              key={f.form_name}
              to={`/lead-form?form_name=${f.form_name}`}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[12px] no-underline transition-colors hover:border-primary/40 hover:bg-muted"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: getFormNameColor(idx),
                }}
              />
              <span className="text-muted-foreground">{f.label}</span>
              <span className="font-semibold text-foreground">{f.count}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="h-48">
        {isLoading ? (
          <div className="h-full w-full animate-pulse rounded-xl bg-muted" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chartData}
              margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                ticks={xTicks}
                tickFormatter={(v) => formatXLabel(v, period)}
                tick={{
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                domain={yDomain}
                allowDecimals={false}
                tick={{
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                content={<CustomTooltip period={period} />}
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#5265f3"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#5265f3",
                  stroke: "var(--card)",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function formatTaskDueLabel(dateStr: string): {
  label: string;
  urgent: boolean;
  overdue: boolean;
} {
  const d = new Date(dateStr);
  if (isPast(d) && !isToday(d))
    return {
      label: formatRelativeTime(d),
      urgent: true,
      overdue: true,
    };
  if (isToday(d)) return { label: "Today", urgent: true, overdue: false };
  if (isTomorrow(d))
    return { label: "Tomorrow", urgent: false, overdue: false };
  return { label: fmtDate(d, "MMM d"), urgent: false, overdue: false };
}

function MyTaskRow({ task }: { task: Task }) {
  const isDone = task.status === "done";
  const dueInfo = task.due_date ? formatTaskDueLabel(task.due_date) : null;

  return (
    <Link
      to={`/tasks?task_id=${task.id}`}
      className={cn(
        "group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all duration-150",
        isDone
          ? "border-border/50 bg-muted/30"
          : task.urgency === "overdue"
            ? "border-red-200/70 bg-red-50/50 hover:border-red-200 hover:bg-red-50"
            : task.urgency === "due_soon"
              ? "border-yellow-200/70 bg-yellow-50/40 hover:border-yellow-200 hover:bg-yellow-50"
              : "border-border bg-card hover:border-border/80 hover:bg-muted/30"
      )}
    >
      {/* Status icon */}
      <div className="shrink-0">
        {isDone ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
        ) : task.urgency === "overdue" ? (
          <AlertCircle className="h-4 w-4 text-red-500" />
        ) : task.urgency === "due_soon" ? (
          <Clock className="h-4 w-4 text-yellow-600" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium leading-snug truncate",
            isDone && "line-through text-muted-foreground/60"
          )}
        >
          {task.title}
        </p>
        {task.lead_full_name && (
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {task.lead_full_name}
          </p>
        )}
      </div>

      {/* Due date badge */}
      {dueInfo && (
        <span
          className={cn(
            "shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full",
            isDone
              ? "bg-muted text-muted-foreground/60"
              : dueInfo.overdue
                ? "bg-red-100 text-red-700"
                : dueInfo.urgent
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-muted text-muted-foreground"
          )}
        >
          {dueInfo.label}
        </span>
      )}
    </Link>
  );
}

function getDateGroupKey(task: Task): string {
  if (!task.due_date) return "9999-99-99";
  return task.due_date.slice(0, 10);
}

function getDateGroupLabel(
  key: string,
  t: (key: string) => string
): { label: string; isOverdue: boolean } {
  if (key === "9999-99-99") {
    return { label: t("home.taskDateNoDueDate"), isOverdue: false };
  }
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const tomorrowStr = format(addDays(new Date(), 1), "yyyy-MM-dd");
  if (key === todayStr)
    return { label: t("home.taskDateToday"), isOverdue: false };
  if (key === tomorrowStr)
    return { label: t("home.taskDateTomorrow"), isOverdue: false };
  const d = new Date(key + "T00:00:00");
  const isOverdue = key < todayStr;
  return { label: fmtDate(d, "EEE, MMM d"), isOverdue };
}

function groupTasksByDate(
  tasks: Task[],
  t: (key: string) => string
): { label: string; isOverdue: boolean; tasks: Task[] }[] {
  const groups = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = getDateGroupKey(task);
    const existing = groups.get(key);
    if (existing) existing.push(task);
    else groups.set(key, [task]);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, groupTasks]) => {
      const { label, isOverdue } = getDateGroupLabel(key, t);
      return { label, isOverdue, tasks: groupTasks };
    });
}

function MyTasksSection({ userId }: { userId: string }) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();

  const todayStr = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);
  const yesterdayStr = useMemo(
    () => format(subDays(new Date(), 1), "yyyy-MM-dd"),
    []
  );

  // Today + future tasks (all statuses, up to 10)
  const { data: upcomingData, isLoading: upcomingLoading } = useQuery({
    queryKey: ["home-tasks-upcoming", userId, currentWorkspace?.id, todayStr],
    queryFn: () =>
      getAllTasks({ assignee_id: userId, due_date_from: todayStr, limit: 10 }),
    enabled: !!userId && !!currentWorkspace,
    refetchOnMount: "always",
  });

  // Overdue tasks (past due, not done)
  const { data: overdueData, isLoading: overdueLoading } = useQuery({
    queryKey: [
      "home-tasks-overdue",
      userId,
      currentWorkspace?.id,
      yesterdayStr,
    ],
    queryFn: () =>
      getAllTasks({
        assignee_id: userId,
        due_date_to: yesterdayStr,
        limit: 50,
      }),
    enabled: !!userId && !!currentWorkspace,
    refetchOnMount: "always",
  });

  const isLoading = upcomingLoading || overdueLoading;

  const tasks = useMemo(() => {
    const upcoming = upcomingData?.data ?? [];
    const overdue = (overdueData?.data ?? []).filter(
      (task) => task.status !== "done"
    );
    // Overdue first (oldest → newest), then upcoming
    return [...overdue, ...upcoming];
  }, [upcomingData, overdueData]);

  const openCount = tasks.filter((task) => task.status !== "done").length;
  const dateGroups = useMemo(() => groupTasksByDate(tasks, t), [tasks, t]);

  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5"
      style={{ animationDelay: "0.1s" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("home.myTasks")}
          </p>
          {isLoading ? (
            <div className="h-8 w-12 animate-pulse rounded-md bg-muted" />
          ) : (
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-bold tracking-tight text-foreground">
                {openCount}
              </p>
              <span className="text-sm text-muted-foreground">
                {t("home.myTasksOpen")}
              </span>
            </div>
          )}
        </div>

        <Link
          to="/tasks"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0 mt-1"
        >
          {t("home.viewAllTasks")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Task list grouped by date */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[58px] rounded-xl border border-border animate-pulse bg-muted/40"
            />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <CheckCircle2 className="h-8 w-8 text-muted-foreground/25" />
          <p className="text-sm text-muted-foreground">{t("home.noMyTasks")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {dateGroups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              {/* Date group header */}
              <div className="flex items-center gap-2 px-1">
                {group.isOverdue && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                )}
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    group.isOverdue
                      ? "text-red-500"
                      : group.label === t("home.taskDateToday")
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {group.label}
                </p>
                <span className="flex-1 h-px bg-border/50" />
                <span className="text-[10px] text-muted-foreground/60">
                  {group.tasks.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.tasks.map((task) => (
                  <MyTaskRow key={task.id} task={task} />
                ))}
              </div>
            </div>
          ))}
          {(upcomingData?.total ?? 0) > 10 && (
            <Link
              to="/tasks"
              className="flex items-center justify-center gap-1.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              +{(upcomingData?.total ?? 0) - 10} {t("home.moreTasks")}
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Plausible Web Analytics Section ─────────────────────────────────────────

const PLAUSIBLE_PERIODS: { value: PlausiblePeriod; labelKey: string }[] = [
  { value: "today", labelKey: "home.periodToday" },
  { value: "this_week", labelKey: "home.periodThisWeek" },
  { value: "this_month", labelKey: "home.period30d" },
  { value: "all_time", labelKey: "home.periodAllTime" },
];

function formatPlausibleXLabel(date: string, period: PlausiblePeriod): string {
  if (period === "today") {
    // hourly data like "2026-04-01 14:00:00" or "2026-04-01T14:00:00"
    const hourMatch = date.match(/(\d{2}):00/);
    if (hourMatch) return `${hourMatch[1]}:00`;
    return date;
  }
  if (period === "all_time") {
    // monthly data like "2026-03"
    const parts = date.split("-");
    if (parts.length === 2) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      return d.toLocaleString(undefined, { month: "short" });
    }
  }
  const [year, month, day] = date.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return formatDateShort(d);
}

function PlausibleStatsTooltip({
  active,
  payload,
  label,
  period,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  period: PlausiblePeriod;
}) {
  const { t } = useTranslation();
  if (!active || !payload?.length || !label) return null;
  const visitors = payload[0]?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-[13px] space-y-0.5">
      <p className="text-muted-foreground text-[11px] mb-0.5">
        {formatPlausibleXLabel(label, period)}
      </p>
      <p className="font-semibold text-foreground">
        {t("home.plausibleVisitors", { count: visitors })}
      </p>
    </div>
  );
}

function WebAnalyticsSection() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [period, setPeriod] = useState<PlausiblePeriod>("this_week");

  const hasPlausible = currentWorkspace?.has_plausible_analytics ?? false;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["workspace-plausible-stats", currentWorkspace?.id, period],
    queryFn: () => getWorkspacePlausibleStats(period),
    enabled: hasPlausible,
    staleTime: 60_000,
  });

  // Don't render if workspace has no analytics service or no brand plausible key
  if (!hasPlausible) return null;

  const timeseries = stats?.timeseries ?? [];
  const agg = stats?.aggregate;

  const tickStep =
    timeseries.length <= 10
      ? 1
      : timeseries.length <= 20
        ? 2
        : Math.ceil(timeseries.length / 10);
  const xTicks = timeseries
    .filter((_, i) => i % tickStep === 0 || i === timeseries.length - 1)
    .map((p) => p.date);

  const maxY = Math.max(...timeseries.map((p) => p.visitors), 1);
  const yDomain: [number, number] = [0, maxY + Math.ceil(maxY * 0.2)];

  const metricCards = agg
    ? [
        { label: t("home.metricVisitors"), value: formatNumber(agg.visitors) },
        { label: t("home.metricVisits"), value: formatNumber(agg.visits) },
        { label: t("home.metricPageviews"), value: formatNumber(agg.pageviews) },
        { label: t("home.metricBounceRate"), value: `${agg.bounce_rate}%` },
      ]
    : [];

  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-visible relative z-10"
      style={{ animationDelay: "0.14s" }}
    >
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            {t("home.webAnalytics")}
          </p>
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {formatNumber(agg?.visitors ?? 0)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("home.webAnalyticsDescription")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <div className="flex items-center gap-1 rounded-xl bg-muted p-1 overflow-x-auto scrollbar-hide">
            {PLAUSIBLE_PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 whitespace-nowrap shrink-0",
                  period === p.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>

          <Link
            to="/analytics"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0"
          >
            {t("home.viewFullAnalytics")}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Metric cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : agg ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metricCards.map((card) => (
            <div
              key={card.label}
              className="rounded-xl border border-border bg-muted/30 px-3 py-2.5"
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                {card.label}
              </p>
              <p className="text-lg font-bold tracking-tight text-foreground tabular-nums">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Chart */}
      {isLoading ? (
        <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
      ) : timeseries.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            {t("home.noAnalyticsData")}
          </p>
        </div>
      ) : (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={timeseries}
              margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                ticks={xTicks}
                tickFormatter={(v) => formatPlausibleXLabel(v, period)}
                tick={{
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                domain={yDomain}
                allowDecimals={false}
                tick={{
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                content={<PlausibleStatsTooltip period={period} />}
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              <Line
                type="monotone"
                dataKey="visitors"
                stroke="#5265f3"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#5265f3",
                  stroke: "var(--card)",
                  strokeWidth: 2,
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { user, currentWorkspace } = useAuthContext();
  const { t } = useTranslation();

  const role = currentWorkspace?.member_role ?? "—";
  const displayName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");
  const firstName = displayName.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      {/* Page heading */}
      <div className="app-fade-up space-y-1">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {t("home.greeting", { name: firstName ? `, ${firstName}` : "" })}
        </h1>
        <p className="text-sm text-muted-foreground">
          {currentWorkspace?.name} · <span className="capitalize">{role}</span>
        </p>
      </div>

      {/* Web Analytics (Plausible) — shown if workspace has analytics service */}
      <WebAnalyticsSection />

      {/* My tasks */}
      {user?.id && <MyTasksSection userId={user.id} />}

      {/* Analytics chart */}
      <LeadAnalyticsChart />
    </div>
  );
}
