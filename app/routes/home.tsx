import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ChevronRight, Package } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import { getLeadAnalytics, type LeadAnalyticsPeriod } from "~/lib/api/leads";

export function meta() {
  return [
    { title: "Home - Repraesent" },
    { name: "description", content: "Dashboard home" },
  ];
}

const PERIODS: { value: LeadAnalyticsPeriod; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "all_time", label: "All time" },
];

const SOURCE_COLORS: Record<string, string> = {
  urls: "#5265f3",
  appointment_booking: "#f5d74f",
};

/** Fill in zero-count data points for the full range so the chart has no gaps. */
function fillSeriesGaps(
  series: { date: string; count: number }[],
  period: LeadAnalyticsPeriod,
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
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
  } else if (period === "this_month") {
    const days = now.getDate();
    for (let i = 1; i <= days; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), i);
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
  } else {
    // all_time — fill every day from the earliest data point to today
    if (series.length === 0) return [];
    const start = new Date(series[0].date + "T00:00:00");
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
  }

  return slots.map((key) => ({ date: key, count: map.get(key) ?? 0 }));
}

/** Format an ISO date key for X-axis display */
function formatXLabel(date: string, period: LeadAnalyticsPeriod): string {
  if (period === "today") {
    const hour = parseInt(date.slice(11, 13), 10);
    return `${hour.toString().padStart(2, "0")}:00`;
  }
  // this_week / this_month / all_time — all use YYYY-MM-DD
  const [year, month, day] = date.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  if (!active || !payload?.length || !label) return null;
  const count = payload[0].value;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md text-[13px]">
      <p className="text-muted-foreground mb-0.5">
        {formatXLabel(label, period)}
      </p>
      <p className="font-semibold text-foreground">
        {count} {count === 1 ? "lead" : "leads"}
      </p>
    </div>
  );
}

function LeadAnalyticsChart() {
  const { currentWorkspace } = useAuthContext();
  const [period, setPeriod] = useState<LeadAnalyticsPeriod>("this_week");

  const { data, isLoading } = useQuery({
    queryKey: ["leadAnalytics", currentWorkspace?.id, period],
    queryFn: () => getLeadAnalytics(period),
    enabled: !!currentWorkspace?.id,
  });

  const chartData = useMemo(
    () => fillSeriesGaps(data?.series ?? [], period),
    [data?.series, period],
  );

  const maxY = Math.max(...chartData.map((p) => p.count), 1);
  const yDomain: [number, number] = [0, maxY + Math.ceil(maxY * 0.2)];

  // Show every Nth tick so labels don't overlap
  const tickCount = chartData.length;
  const tickStep =
    tickCount <= 10 ? 1 : tickCount <= 20 ? 2 : Math.ceil(tickCount / 10);
  const xTicks = chartData
    .filter((_, i) => i % tickStep === 0 || i === chartData.length - 1)
    .map((p) => p.date);

  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card p-6 space-y-5"
      style={{ animationDelay: "0.06s" }}
    >
      {/* Header row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Leads
          </p>
          {isLoading ? (
            <div className="h-8 w-12 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-3xl font-bold tracking-tight text-foreground">
              {data?.total ?? 0}
            </p>
          )}
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 rounded-xl bg-muted p-1 self-start">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-150",
                period === p.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Source badges */}
      {!isLoading && data && data.sources.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.sources.map((s) => (
            <Link
              key={s.source}
              to={`/lead-form?source=${s.source}`}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[12px] no-underline transition-colors hover:border-primary/40 hover:bg-muted"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{
                  backgroundColor: SOURCE_COLORS[s.source] ?? "#9aa3b2",
                }}
              />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="font-semibold text-foreground">{s.count}</span>
            </Link>
          ))}
        </div>
      )}

      {/* Chart */}
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

export default function Home() {
  const { user, currentWorkspace } = useAuthContext();

  const services = currentWorkspace?.services ?? [];
  const role = currentWorkspace?.member_role ?? "—";
  const displayName = [user?.first_name, user?.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-8 app-fade-in">
      {/* Page heading */}
      <div className="app-fade-up space-y-1">
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">
          Good to see you{displayName ? `, ${displayName.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-sm text-muted-foreground">
          {currentWorkspace?.name} · <span className="capitalize">{role}</span>
        </p>
      </div>

      {/* Analytics chart */}
      <LeadAnalyticsChart />

      {/* User + workspace info */}
      <div className="grid gap-4 sm:grid-cols-2 app-fade-up app-fade-up-d3">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Account
          </p>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {displayName || "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.email}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
          <div>
            <p className="text-lg font-semibold text-foreground">
              {currentWorkspace?.name ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5 capitalize">
              Role: {role}
            </p>
          </div>
        </div>
      </div>

      {/* Services */}
      <div className="app-fade-up app-fade-up-d4 space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Services
          </p>
          <p className="text-sm text-muted-foreground/70 mt-0.5">
            Services attached to this workspace
          </p>
        </div>

        {services.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              No services attached yet. Contact{" "}
              <a
                href="mailto:support@repraesent.com"
                className="text-primary hover:underline font-medium"
              >
                support@repraesent.com
              </a>{" "}
              to get started.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const hasSlug = !!s.service_slug;
              const cardContent = (
                <div
                  className={cn(
                    "flex items-center gap-4 rounded-2xl border border-border bg-card overflow-hidden h-[76px] transition-all duration-200",
                    hasSlug
                      ? "hover:border-primary/30 hover:shadow-md hover:shadow-primary/5 cursor-pointer"
                      : "opacity-55 cursor-not-allowed",
                  )}
                >
                  {s.service_image ? (
                    <img
                      src={s.service_image}
                      alt={s.service_name}
                      className="h-full w-20 shrink-0 object-cover p-2"
                    />
                  ) : (
                    <div className="flex h-full w-20 shrink-0 items-center justify-center bg-primary/6">
                      <Package className="h-6 w-6 text-primary/60" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-4">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {s.service_name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      {hasSlug ? (
                        <>
                          Open section
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" />
                        </>
                      ) : (
                        "Not available"
                      )}
                    </p>
                  </div>
                </div>
              );

              return hasSlug ? (
                <Link
                  key={s.service_id}
                  to={`/${s.service_slug}`}
                  className="block no-underline text-inherit"
                >
                  {cardContent}
                </Link>
              ) : (
                <div key={s.service_id}>{cardContent}</div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
