import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { LayoutList, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { cn } from "~/lib/utils";
import {
  getBrandAnalytics,
  type WorkspaceLeadSeries,
} from "~/lib/api/brand";
import type { LeadAnalyticsPeriod } from "~/lib/api/leads";

export function meta() {
  return [
    { title: "Home - Repraesent" },
    { name: "description", content: "Brand dashboard" },
  ];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PERIODS: { value: LeadAnalyticsPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "all_time", label: "All Time" },
];

const WORKSPACE_COLORS = [
  "#5265f3",
  "#f5d74f",
  "#34d399",
  "#f472b6",
  "#fb923c",
  "#a78bfa",
  "#38bdf8",
  "#f87171",
];

const STATUS_COLORS: Record<string, string> = {
  new_lead: "#5265f3",
  in_progress: "#f5d74f",
  on_hold: "#fb923c",
  pending: "#38bdf8",
  success: "#34d399",
  rejected: "#f87171",
  stale: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  new_lead: "New Lead",
  in_progress: "In Progress",
  on_hold: "On Hold",
  pending: "Pending",
  success: "Success",
  rejected: "Rejected",
  stale: "Stale",
};

const VISIBLE_STATUSES = [
  "new_lead",
  "in_progress",
  "on_hold",
  "pending",
  "success",
  "rejected",
  "stale",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function getDateSlots(
  period: LeadAnalyticsPeriod,
  workspaces: WorkspaceLeadSeries[]
): string[] {
  const now = new Date();
  const slots: string[] = [];

  if (period === "today") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let h = 0; h <= now.getHours(); h++) {
      const d = new Date(today);
      d.setHours(h);
      slots.push(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(h)}:00:00`
      );
    }
  } else if (period === "this_week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      slots.push(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      );
    }
  } else if (period === "this_month") {
    for (let i = 1; i <= now.getDate(); i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      slots.push(
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(i)}`
      );
    }
  } else {
    // all_time: collect all unique dates across all workspaces
    const allDates = new Set<string>();
    workspaces.forEach((ws) => ws.series.forEach((s) => allDates.add(s.date)));
    if (allDates.size === 0) return [];
    return Array.from(allDates).sort();
  }

  return slots;
}

function formatXLabel(date: string, period: LeadAnalyticsPeriod): string {
  if (period === "today") {
    const hour = parseInt(date.slice(11, 13), 10);
    return `${hour.toString().padStart(2, "0")}:00`;
  }
  const [year, month, day] = date.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildLineData(
  workspaces: WorkspaceLeadSeries[],
  period: LeadAnalyticsPeriod
): Record<string, string | number>[] {
  const slots = getDateSlots(period, workspaces);
  return slots.map((date) => {
    const point: Record<string, string | number> = { date };
    workspaces.forEach((ws) => {
      const found = ws.series.find((s) => s.date === date);
      point[ws.workspace_id] = found?.count ?? 0;
    });
    return point;
  });
}

function buildBarData(
  workspaces: WorkspaceLeadSeries[]
): Record<string, string | number>[] {
  return workspaces.map((ws) => {
    const point: Record<string, string | number> = {
      workspace_name: ws.workspace_name,
    };
    VISIBLE_STATUSES.forEach((s) => {
      const found = ws.status_breakdown.find((sb) => sb.status === s);
      point[s] = found?.count ?? 0;
    });
    return point;
  });
}

// ─── Tooltips ────────────────────────────────────────────────────────────────

function MultiLineTooltip({
  active,
  payload,
  label,
  period,
  workspaces,
}: {
  active?: boolean;
  payload?: { value: number; color: string; dataKey: string }[];
  label?: string;
  period: LeadAnalyticsPeriod;
  workspaces: WorkspaceLeadSeries[];
}) {
  if (!active || !payload?.length || !label) return null;
  const wsMap = new Map(
    workspaces.map((ws) => [ws.workspace_id, ws.workspace_name])
  );
  const visible = payload.filter((e) => e.value > 0);
  if (!visible.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-[13px] space-y-1.5 max-w-[220px]">
      <p className="text-muted-foreground text-[11px]">
        {formatXLabel(label, period)}
      </p>
      {visible.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground truncate flex-1 text-[12px]">
            {wsMap.get(entry.dataKey) ?? entry.dataKey}
          </span>
          <span className="font-semibold text-foreground shrink-0">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function StatusTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number; fill: string; dataKey: string }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  const filtered = payload.filter((p) => p.value > 0);
  if (!filtered.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-[13px] space-y-1.5 max-w-[220px]">
      <p className="text-muted-foreground font-medium text-[11px] truncate">
        {label}
      </p>
      {filtered.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.fill }}
          />
          <span className="text-muted-foreground truncate flex-1 text-[12px]">
            {STATUS_LABELS[entry.dataKey] ?? entry.dataKey}
          </span>
          <span className="font-semibold text-foreground shrink-0">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Chart Section ────────────────────────────────────────────────────────────

function ChartSection({
  title,
  description,
  workspaces,
  isLoading,
  period,
  onPeriodChange,
  lineStyle = "solid",
}: {
  title: string;
  description: string;
  workspaces: WorkspaceLeadSeries[];
  isLoading: boolean;
  period: LeadAnalyticsPeriod;
  onPeriodChange: (p: LeadAnalyticsPeriod) => void;
  lineStyle?: "solid" | "dashed";
}) {
  const [view, setView] = useState<"line" | "bar">("line");
  const [hoveredWorkspace, setHoveredWorkspace] = useState<string | null>(null);

  const total = workspaces.reduce((sum, ws) => sum + ws.total, 0);

  const lineData = useMemo(
    () => buildLineData(workspaces, period),
    [workspaces, period]
  );

  const barData = useMemo(() => buildBarData(workspaces), [workspaces]);

  // x-axis tick decimation for line chart
  const tickStep =
    lineData.length <= 10 ? 1 : lineData.length <= 20 ? 2 : Math.ceil(lineData.length / 10);
  const xTicks = lineData
    .filter((_, i) => i % tickStep === 0 || i === lineData.length - 1)
    .map((p) => p.date as string);

  const maxY = Math.max(
    ...lineData.flatMap((point) =>
      workspaces.map((ws) => (point[ws.workspace_id] as number) ?? 0)
    ),
    1
  );
  const yDomain: [number, number] = [0, maxY + Math.ceil(maxY * 0.2)];

  const barMaxX = Math.max(
    ...barData.map((row) =>
      VISIBLE_STATUSES.reduce((sum, s) => sum + ((row[s] as number) ?? 0), 0)
    ),
    1
  );

  // Dynamic height for bar chart: 48px per row + padding
  const barChartHeight = Math.max(workspaces.length * 36 + 24, 80);

  return (
    <div className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </p>
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {total}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          {/* View toggle: Trend line / Status bar */}
          <div className="flex items-center gap-1 rounded-xl bg-muted p-1">
            <button
              onClick={() => setView("line")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
                view === "line"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="h-3 w-3 shrink-0" />
              Trend
            </button>
            <button
              onClick={() => setView("bar")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 whitespace-nowrap",
                view === "bar"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <LayoutList className="h-3 w-3 shrink-0" />
              Status
            </button>
          </div>

          {/* Period buttons — shown for both trend and status views */}
          <div className="flex items-center gap-1 rounded-xl bg-muted p-1 overflow-x-auto scrollbar-hide">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => onPeriodChange(p.value)}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 whitespace-nowrap shrink-0",
                  period === p.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Workspace color legend skeleton — keeps card height stable while loading */}
      {view === "line" && isLoading && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {[72, 96, 80].map((w, i) => (
            <div
              key={i}
              className="h-[18px] animate-pulse rounded-md bg-muted"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
      )}

      {/* Workspace color legend (line view) */}
      {view === "line" && !isLoading && workspaces.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {workspaces.map((ws, i) => {
            const isActive = hoveredWorkspace === null || hoveredWorkspace === ws.workspace_id;
            return (
              <div
                key={ws.workspace_id}
                className="flex items-center gap-1.5 text-[12px] cursor-pointer select-none transition-opacity duration-150"
                style={{ opacity: isActive ? 1 : 0.35 }}
                onMouseEnter={() => setHoveredWorkspace(ws.workspace_id)}
                onMouseLeave={() => setHoveredWorkspace(null)}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform duration-150"
                  style={{
                    backgroundColor: WORKSPACE_COLORS[i % WORKSPACE_COLORS.length],
                    transform: hoveredWorkspace === ws.workspace_id ? "scale(1.4)" : "scale(1)",
                  }}
                />
                <span className={cn("transition-colors duration-150", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {ws.workspace_name}
                </span>
                <span className="font-semibold text-foreground">{ws.total}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Status color legend (bar view) */}
      {view === "bar" && !isLoading && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {VISIBLE_STATUSES.map((s) => (
            <div key={s} className="flex items-center gap-1.5 text-[11px]">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: STATUS_COLORS[s] }}
              />
              <span className="text-muted-foreground">{STATUS_LABELS[s]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {isLoading ? (
        <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
      ) : workspaces.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">No data available</p>
        </div>
      ) : view === "line" ? (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={lineData}
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
                  fontFamily: "inherit",
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
                  fontFamily: "inherit",
                }}
                axisLine={false}
                tickLine={false}
                width={32}
              />
              <Tooltip
                content={
                  <MultiLineTooltip period={period} workspaces={workspaces} />
                }
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              />
              {workspaces.map((ws, i) => {
                const isActive = hoveredWorkspace === null || hoveredWorkspace === ws.workspace_id;
                return (
                  <Line
                    key={ws.workspace_id}
                    type="monotone"
                    dataKey={ws.workspace_id}
                    stroke={WORKSPACE_COLORS[i % WORKSPACE_COLORS.length]}
                    strokeWidth={hoveredWorkspace === ws.workspace_id ? 3 : 2}
                    strokeOpacity={isActive ? 1 : 0.1}
                    strokeDasharray={lineStyle === "dashed" ? "6 3" : undefined}
                    dot={false}
                    activeDot={
                      isActive
                        ? {
                            r: 4,
                            fill: WORKSPACE_COLORS[i % WORKSPACE_COLORS.length],
                            stroke: "var(--card)",
                            strokeWidth: 2,
                          }
                        : false
                    }
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        /* Stacked horizontal bar chart — one row per workspace, colored by status */
        <div style={{ height: `${barChartHeight}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={barData}
              layout="vertical"
              barSize={14}
              margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                domain={[0, barMaxX + Math.ceil(barMaxX * 0.1)]}
                tick={{
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontFamily: "inherit",
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="workspace_name"
                width={110}
                tick={{
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                  fontFamily: "inherit",
                }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={<StatusTooltip />}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              {VISIBLE_STATUSES.map((s, idx) => (
                <Bar
                  key={s}
                  dataKey={s}
                  stackId="stack"
                  fill={STATUS_COLORS[s]}
                  name={STATUS_LABELS[s]}
                  radius={
                    idx === VISIBLE_STATUSES.length - 1
                      ? [0, 3, 3, 0]
                      : undefined
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandDashboard() {
  const { t } = useTranslation();
  const [bookingsPeriod, setBookingsPeriod] =
    useState<LeadAnalyticsPeriod>("this_week");
  const [submissionsPeriod, setSubmissionsPeriod] =
    useState<LeadAnalyticsPeriod>("this_week");

  const { data: bookingsData, isLoading: bookingsLoading } = useQuery({
    queryKey: ["brand-analytics", "bookings", bookingsPeriod],
    queryFn: () => getBrandAnalytics(bookingsPeriod),
    staleTime: 0,
  });

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ["brand-analytics", "submissions", submissionsPeriod],
    queryFn: () => getBrandAnalytics(submissionsPeriod),
    staleTime: 0,
  });

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6 space-y-6 sm:space-y-8">
      {/* Page heading */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          {t("brand.greeting", "Good to see you.")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("brand.greetingSubtitle", "Here's how your workspaces are performing.")}
        </p>
      </div>

      {/* Appointment Bookings Chart */}
      <ChartSection
        title={t("brand.bookingsChart", "Appointment Bookings")}
        description={t(
          "brand.bookingsDescription",
          "Leads submitted via the appointment booking form"
        )}
        workspaces={bookingsData?.bookings ?? []}
        isLoading={bookingsLoading}
        period={bookingsPeriod}
        onPeriodChange={setBookingsPeriod}
        lineStyle="solid"
      />

      {/* Form Submissions Chart */}
      <ChartSection
        title={t("brand.submissionsChart", "Form Submissions")}
        description={t(
          "brand.submissionsDescription",
          "All form submissions excluding appointment bookings and hidden leads"
        )}
        workspaces={submissionsData?.submissions ?? []}
        isLoading={submissionsLoading}
        period={submissionsPeriod}
        onPeriodChange={setSubmissionsPeriod}
        lineStyle="dashed"
      />
    </div>
  );
}
