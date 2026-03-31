import { useState, useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ArrowRight, LayoutList, TrendingUp, FileDown, Loader2, Globe, ExternalLink } from "lucide-react";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "~/components/ui/hover-card";
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
import { formatNumber, formatDecimal, formatDateShort } from "~/lib/utils/format";
import {
  getBrandAnalytics,
  getBrandPlausibleAnalytics,
  getBrandWorkspacesOverview,
  exportBrandReport,
  type WorkspaceLeadSeries,
  type PlausibleWorkspaceSeries,
} from "~/lib/api/brand";
import type { LeadAnalyticsPeriod } from "~/lib/api/leads";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "~/components/ui/dialog";

export function meta() {
  return [
    { title: "Home - Repraesent" },
    { name: "description", content: "Brand dashboard" },
  ];
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PERIODS: { value: LeadAnalyticsPeriod; labelKey: string }[] = [
  { value: "today", labelKey: "brand.periodToday" },
  { value: "this_week", labelKey: "brand.periodThisWeek" },
  { value: "this_month", labelKey: "brand.periodThisMonth" },
  { value: "all_time", labelKey: "brand.periodAllTime" },
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

const STATUS_LABEL_KEYS: Record<string, string> = {
  new_lead: "brand.statusNewLead",
  in_progress: "brand.statusInProgress",
  on_hold: "brand.statusOnHold",
  pending: "brand.statusPending",
  success: "brand.statusSuccess",
  rejected: "brand.statusRejected",
  stale: "brand.statusStale",
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
      slots.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(i)}`);
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
  return formatDateShort(d);
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
  const { t } = useTranslation();
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
            {STATUS_LABEL_KEYS[entry.dataKey]
              ? t(STATUS_LABEL_KEYS[entry.dataKey])
              : entry.dataKey}
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
  colorMap,
}: {
  title: string;
  description: string;
  workspaces: WorkspaceLeadSeries[];
  isLoading: boolean;
  period: LeadAnalyticsPeriod;
  onPeriodChange: (p: LeadAnalyticsPeriod) => void;
  lineStyle?: "solid" | "dashed";
  colorMap: Record<string, string>;
}) {
  const { t } = useTranslation();
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
    lineData.length <= 10
      ? 1
      : lineData.length <= 20
        ? 2
        : Math.ceil(lineData.length / 10);
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
              {t("brand.viewTrend")}
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
              {t("brand.viewStatus")}
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
                {t(p.labelKey)}
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
          {workspaces.map((ws) => {
            const wsColor = colorMap[ws.workspace_id] ?? WORKSPACE_COLORS[0];
            const isActive =
              hoveredWorkspace === null || hoveredWorkspace === ws.workspace_id;
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
                    backgroundColor: wsColor,
                    transform:
                      hoveredWorkspace === ws.workspace_id
                        ? "scale(1.4)"
                        : "scale(1)",
                  }}
                />
                <span
                  className={cn(
                    "transition-colors duration-150",
                    isActive ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {ws.workspace_name}
                </span>
                <span className="font-semibold text-foreground">
                  {ws.total}
                </span>
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
              <span className="text-muted-foreground">
                {STATUS_LABEL_KEYS[s] ? t(STATUS_LABEL_KEYS[s]) : s}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      {isLoading ? (
        <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
      ) : workspaces.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t("brand.noData")}</p>
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
              {workspaces.map((ws) => {
                const wsColor =
                  colorMap[ws.workspace_id] ?? WORKSPACE_COLORS[0];
                const isActive =
                  hoveredWorkspace === null ||
                  hoveredWorkspace === ws.workspace_id;
                return (
                  <Line
                    key={ws.workspace_id}
                    type="monotone"
                    dataKey={ws.workspace_id}
                    stroke={wsColor}
                    strokeWidth={hoveredWorkspace === ws.workspace_id ? 3 : 2}
                    strokeOpacity={isActive ? 1 : 0.1}
                    strokeDasharray={lineStyle === "dashed" ? "6 3" : undefined}
                    dot={false}
                    activeDot={
                      isActive
                        ? {
                            r: 4,
                            fill: wsColor,
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
                  name={STATUS_LABEL_KEYS[s] ? t(STATUS_LABEL_KEYS[s]) : s}
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

// ─── Analytics Chart Section (trend-only) ────────────────────────────────────

function buildPlausibleLineData(
  workspaces: PlausibleWorkspaceSeries[],
): Record<string, string | number>[] {
  const allDates = new Set<string>();
  workspaces.forEach((ws) =>
    ws.timeseries.forEach((t) => allDates.add(t.date))
  );
  const slots = Array.from(allDates).sort();

  return slots.map((date) => {
    const point: Record<string, string | number> = { date };
    workspaces.forEach((ws) => {
      const found = ws.timeseries.find((t) => t.date === date);
      point[ws.workspace_id] = found?.visitors ?? 0;
    });
    return point;
  });
}

function PlausibleTooltip({
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
  workspaces: PlausibleWorkspaceSeries[];
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

function AnalyticsChartSection({
  workspaces,
  isLoading,
  period,
  onPeriodChange,
  colorMap,
}: {
  workspaces: PlausibleWorkspaceSeries[];
  isLoading: boolean;
  period: LeadAnalyticsPeriod;
  onPeriodChange: (p: LeadAnalyticsPeriod) => void;
  colorMap: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [hoveredWorkspace, setHoveredWorkspace] = useState<string | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWorkspaceEnter = useCallback((wsId: string) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredWorkspace(wsId);
  }, []);

  const handleWorkspaceLeave = useCallback(() => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredWorkspace(null), 150);
  }, []);

  const lineData = useMemo(
    () => buildPlausibleLineData(workspaces),
    [workspaces]
  );

  // Aggregate metrics (all or hovered-only)
  const metrics = useMemo(() => {
    const filtered = hoveredWorkspace
      ? workspaces.filter((ws) => ws.workspace_id === hoveredWorkspace)
      : workspaces;
    const visitors = filtered.reduce((s, ws) => s + ws.visitors, 0);
    const pageviews = filtered.reduce((s, ws) => s + ws.pageviews, 0);
    const visits = filtered.reduce((s, ws) => s + ws.visits, 0);
    const viewsPerVisit = visits > 0 ? Math.round((pageviews / visits) * 10) / 10 : 0;
    return { visitors, pageviews, visits, viewsPerVisit };
  }, [workspaces, hoveredWorkspace]);

  const tickStep =
    lineData.length <= 10
      ? 1
      : lineData.length <= 20
        ? 2
        : Math.ceil(lineData.length / 10);
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

  const metricCards = [
    { label: t("brand.metricVisitors", "Unique Visitors"), value: formatNumber(metrics.visitors) },
    { label: t("brand.metricVisits", "Total Visits"), value: formatNumber(metrics.visits) },
    { label: t("brand.metricPageviews", "Pageviews"), value: formatNumber(metrics.pageviews) },
    { label: t("brand.metricViewsPerVisit", "Views / Visit"), value: formatDecimal(metrics.viewsPerVisit, 1) },
  ];

  return (
    <div className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-visible relative z-10">
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Globe className="h-3 w-3" />
            {t("brand.webAnalyticsChart", "Web Analytics")}
          </p>
          {isLoading ? (
            <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {formatNumber(metrics.visitors)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {t("brand.webAnalyticsDescription", "Website visitor data across all partner houses")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
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
                {t(p.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metric cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : workspaces.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {metricCards.map((card) => (
            <div
              key={card.label}
              className={cn(
                "rounded-xl border px-3 py-2.5 transition-all duration-300 ease-out",
                hoveredWorkspace
                  ? "border-primary/20 bg-primary/5"
                  : "border-border bg-muted/30"
              )}
            >
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                {card.label}
              </p>
              <p className="text-lg font-bold tracking-tight text-foreground tabular-nums transition-opacity duration-200">
                {card.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {/* Workspace color legend */}
      {isLoading && (
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
      {!isLoading && workspaces.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {workspaces.map((ws) => {
            const wsColor = colorMap[ws.workspace_id] ?? WORKSPACE_COLORS[0];
            const isActive =
              hoveredWorkspace === null || hoveredWorkspace === ws.workspace_id;
            return (
              <HoverCard
                key={ws.workspace_id}
                openDelay={200}
                closeDelay={100}
                onOpenChange={(open) => {
                  if (open) {
                    handleWorkspaceEnter(ws.workspace_id);
                  } else {
                    handleWorkspaceLeave();
                  }
                }}
              >
                <HoverCardTrigger asChild>
                  <div
                    className="flex items-center gap-1.5 text-[12px] cursor-pointer select-none transition-opacity duration-150"
                    style={{ opacity: isActive ? 1 : 0.35 }}
                    onMouseEnter={() => handleWorkspaceEnter(ws.workspace_id)}
                    onMouseLeave={() => {/* let HoverCard onOpenChange handle it */}}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0 transition-transform duration-150"
                      style={{
                        backgroundColor: wsColor,
                        transform:
                          hoveredWorkspace === ws.workspace_id
                            ? "scale(1.4)"
                            : "scale(1)",
                      }}
                    />
                    <span
                      className={cn(
                        "transition-colors duration-150",
                        isActive ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {ws.workspace_name}
                    </span>
                    <span className="font-semibold text-foreground">
                      {formatNumber(ws.visitors)}
                    </span>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent
                  side="top"
                  sideOffset={8}
                  className="w-auto p-2"
                >
                  <Link
                    to={`/brand/analytics?workspace=${ws.workspace_id}`}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium text-foreground hover:bg-muted transition-colors duration-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    {t("brand.fullAnalytics", "See full analytics")}
                  </Link>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      )}

      {/* Chart */}
      {isLoading ? (
        <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
      ) : workspaces.length === 0 ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t("brand.noData")}</p>
        </div>
      ) : (
        <div className="h-48 relative" style={{ overflow: "visible" }}>
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
                  <PlausibleTooltip period={period} workspaces={workspaces} />
                }
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                allowEscapeViewBox={{ x: false, y: true }}
                wrapperStyle={{ zIndex: 50 }}
              />
              {workspaces.map((ws) => {
                const wsColor =
                  colorMap[ws.workspace_id] ?? WORKSPACE_COLORS[0];
                const isActive =
                  hoveredWorkspace === null ||
                  hoveredWorkspace === ws.workspace_id;
                return (
                  <Line
                    key={ws.workspace_id}
                    type="monotone"
                    dataKey={ws.workspace_id}
                    stroke={wsColor}
                    strokeWidth={hoveredWorkspace === ws.workspace_id ? 3 : 2}
                    strokeOpacity={isActive ? 1 : 0.1}
                    dot={false}
                    activeDot={
                      isActive
                        ? {
                            r: 4,
                            fill: wsColor,
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
      )}
    </div>
  );
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

const RANK_CONFIG = [
  {
    color: "#f5d74f",
    label: "bg-amber-400/15 text-amber-300 border border-amber-400/20",
  },
  {
    color: "#94a3b8",
    label: "bg-slate-400/15 text-slate-300 border border-slate-400/15",
  },
  {
    color: "#fb923c",
    label: "bg-orange-400/15 text-orange-300 border border-orange-400/15",
  },
];

function LeaderboardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <div className="h-2.5 w-28 rounded bg-muted" />
          <div className="h-5 w-20 rounded bg-muted" />
        </div>
        <div className="h-4 w-16 rounded bg-muted" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2 px-1">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-muted shrink-0" />
              <div
                className="h-3 flex-1 rounded bg-muted"
                style={{ maxWidth: `${80 - i * 10}%` }}
              />
              <div className="h-3 w-8 rounded bg-muted shrink-0" />
            </div>
            <div className="ml-9 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-muted-foreground/20"
                style={{ width: `${80 - i * 12}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceLeaderboard({
  workspaces,
  isLoading,
  total,
  colorMap,
  period,
  onPeriodChange,
}: {
  workspaces: { id: string; name: string; leads_count: number }[];
  isLoading: boolean;
  total: number;
  colorMap: Record<string, string>;
  period: LeadAnalyticsPeriod;
  onPeriodChange: (p: LeadAnalyticsPeriod) => void;
}) {
  const { t } = useTranslation();
  if (isLoading) return <LeaderboardSkeleton />;
  if (!workspaces.length) return null;

  const max = Math.max(...workspaces.map((w) => w.leads_count), 1);

  return (
    <div className="app-fade-up rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {t("brand.leaderboardTitle", "Top Partner Houses")}
          </p>
          <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatNumber(total)}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("brand.leaderboardSubtitle", "total leads")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
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
                {t(p.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Ranked rows */}
      <div className="space-y-2">
        {workspaces.map((ws, i) => {
          const pct = (ws.leads_count / max) * 100;
          const wsColor =
            colorMap[ws.id] ?? WORKSPACE_COLORS[i % WORKSPACE_COLORS.length];
          const rank = RANK_CONFIG[i] ?? {
            label: "bg-muted text-muted-foreground border border-transparent",
          };
          const isFirst = i === 0;

          return (
            <div
              key={ws.id}
              className={cn(
                "rounded-xl px-3 py-2.5 transition-colors duration-100",
                isFirst
                  ? "bg-amber-400/5 border border-amber-400/10"
                  : "hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                {/* Rank badge */}
                <span
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                    rank.label
                  )}
                >
                  {i + 1}
                </span>

                {/* Name */}
                <span
                  className={cn(
                    "flex-1 text-[13px] font-medium truncate",
                    isFirst ? "text-foreground" : "text-foreground/80"
                  )}
                >
                  {ws.name}
                </span>

                {/* Count */}
                <span
                  className={cn(
                    "tabular-nums text-sm font-bold shrink-0",
                    isFirst ? "text-amber-300" : "text-foreground/60"
                  )}
                >
                  {formatNumber(ws.leads_count)}
                </span>
              </div>

              {/* Bar */}
              <div className="ml-9 h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: wsColor,
                    transitionDelay: `${i * 60}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* View all at bottom */}
      <div className="flex justify-center pt-1">
        <Link
          to="/brand/workspaces"
          className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
        >
          {t("brand.leaderboardViewAll", "View all")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ─── Export Report Modal ──────────────────────────────────────────────────────

const EXPORT_PERIODS: { value: LeadAnalyticsPeriod; labelKey: string }[] = [
  { value: "today", labelKey: "brand.periodToday" },
  { value: "this_week", labelKey: "brand.periodThisWeek" },
  { value: "this_month", labelKey: "brand.periodThisMonth" },
  { value: "all_time", labelKey: "brand.periodAllTime" },
];

function ExportReportModal({
  open,
  onClose,
  colorMap,
}: {
  open: boolean;
  onClose: () => void;
  colorMap: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] =
    useState<LeadAnalyticsPeriod>("this_month");
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: workspaceData, isLoading: wsLoading } = useQuery({
    queryKey: ["brand-workspaces-export-list"],
    queryFn: () => getBrandWorkspacesOverview({ limit: 100, page: 1 }),
    enabled: open,
    staleTime: 60_000,
  });

  const workspaces = workspaceData?.data ?? [];
  const activeId = selectedWorkspaceId || workspaces[0]?.id || "";
  const activeName =
    workspaces.find((w) => w.id === activeId)?.name ?? "";

  async function handleExport() {
    if (!activeId) return;
    setIsExporting(true);
    setError(null);
    try {
      await exportBrandReport(activeId, selectedPeriod, activeName);
      onClose();
    } catch {
      setError(t("brand.exportError"));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <FileDown className="h-4 w-4 text-muted-foreground" />
            {t("brand.exportTitle")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            {t("brand.exportDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Workspace */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {t("brand.exportWorkspace")}
            </label>
            {wsLoading ? (
              <div className="h-9 animate-pulse rounded-md bg-muted" />
            ) : (
              <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-border p-1">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => setSelectedWorkspaceId(ws.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-left transition-colors duration-100",
                      (selectedWorkspaceId || workspaces[0]?.id) === ws.id
                        ? "bg-primary/8 text-foreground font-medium"
                        : "text-foreground/70 hover:bg-muted/60"
                    )}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{
                        backgroundColor:
                          colorMap[ws.id] ??
                          WORKSPACE_COLORS[
                            workspaces.findIndex((w) => w.id === ws.id) %
                              WORKSPACE_COLORS.length
                          ],
                      }}
                    />
                    <span className="truncate flex-1">{ws.name}</span>
                  </button>
                ))}
                {workspaces.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {t("brand.exportNoWorkspaces")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Period */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">
              {t("brand.exportPeriod")}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {EXPORT_PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setSelectedPeriod(p.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-[13px] font-medium text-left transition-all duration-100",
                    selectedPeriod === p.value
                      ? "border-primary bg-primary/6 text-foreground"
                      : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                  )}
                >
                  {t(p.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            {t("brand.exportCancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={isExporting || !activeId}
            className="gap-2"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {t("brand.exportGenerating")}
              </>
            ) : (
              <>
                <FileDown className="h-3.5 w-3.5" />
                {t("brand.exportDownload")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BrandDashboard() {
  const { t } = useTranslation();
  const [bookingsPeriod, setBookingsPeriod] =
    useState<LeadAnalyticsPeriod>("this_week");
  const [submissionsPeriod, setSubmissionsPeriod] =
    useState<LeadAnalyticsPeriod>("this_week");
  const [plausiblePeriod, setPlausiblePeriod] =
    useState<LeadAnalyticsPeriod>("this_week");
  const [leaderboardPeriod, setLeaderboardPeriod] =
    useState<LeadAnalyticsPeriod>("all_time");
  const [exportOpen, setExportOpen] = useState(false);

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

  const { data: plausibleData, isLoading: plausibleLoading } = useQuery({
    queryKey: ["brand-analytics", "plausible", plausiblePeriod],
    queryFn: () => getBrandPlausibleAnalytics(plausiblePeriod),
    staleTime: 0,
  });

  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ["brand-workspaces-overview-leaderboard", leaderboardPeriod],
    queryFn: () => getBrandWorkspacesOverview({ limit: 50, page: 1, period: leaderboardPeriod }),
    staleTime: 0,
  });

  const topWorkspaces = useMemo(() => {
    const all = overviewData?.data ?? [];
    return [...all].sort((a, b) => b.leads_count - a.leads_count).slice(0, 8);
  }, [overviewData]);

  const totalLeads = useMemo(
    () => (overviewData?.data ?? []).reduce((s, w) => s + w.leads_count, 0),
    [overviewData]
  );

  // Stable workspace → color map across all charts
  const workspaceColorMap = useMemo(() => {
    const ids = new Set<string>();
    // Leaderboard workspaces first (they define the "canonical" ordering)
    topWorkspaces.forEach((ws) => ids.add(ws.id));
    // Then bookings, submissions & plausible workspaces
    (bookingsData?.bookings ?? []).forEach((ws) => ids.add(ws.workspace_id));
    (submissionsData?.submissions ?? []).forEach((ws) =>
      ids.add(ws.workspace_id)
    );
    (plausibleData?.workspaces ?? []).forEach((ws) =>
      ids.add(ws.workspace_id)
    );
    const map: Record<string, string> = {};
    let i = 0;
    ids.forEach((id) => {
      map[id] = WORKSPACE_COLORS[i % WORKSPACE_COLORS.length];
      i++;
    });
    return map;
  }, [topWorkspaces, bookingsData, submissionsData, plausibleData]);

  return (
    <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-6 py-10! space-y-6 sm:space-y-8 app-fade-in">
      {/* Page heading */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground tracking-tight">
            {t("brand.greeting", "Good to see you.")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t(
              "brand.greetingSubtitle",
              "Here's how your partner houses are performing."
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setExportOpen(true)}
          className="shrink-0 gap-1.5"
        >
          <FileDown className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("brand.exportButton")}</span>
          <span className="sm:hidden">{t("brand.exportButtonShort")}</span>
        </Button>
      </div>

      <ExportReportModal open={exportOpen} onClose={() => setExportOpen(false)} colorMap={workspaceColorMap} />

      {/* Web Analytics Chart */}
      <AnalyticsChartSection
        workspaces={plausibleData?.workspaces ?? []}
        isLoading={plausibleLoading}
        period={plausiblePeriod}
        onPeriodChange={setPlausiblePeriod}
        colorMap={workspaceColorMap}
      />

      {/* Workspace leaderboard */}
      <WorkspaceLeaderboard
        workspaces={topWorkspaces}
        isLoading={overviewLoading}
        total={totalLeads}
        colorMap={workspaceColorMap}
        period={leaderboardPeriod}
        onPeriodChange={setLeaderboardPeriod}
      />

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
        colorMap={workspaceColorMap}
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
        colorMap={workspaceColorMap}
      />
    </div>
  );
}
