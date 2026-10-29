import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, Globe } from "lucide-react";
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
import { formatNumber } from "~/lib/utils/format";
import {
  getWorkspacePlausibleStats,
  type PlausiblePeriod,
} from "~/lib/api/workspaces";
import {
  WEBSITE_PERIODS as PLAUSIBLE_PERIODS,
  fillSeriesGaps as fillPlausibleSeriesGaps,
  formatBucketLabel as formatPlausibleXLabel,
} from "~/lib/analytics/website-stats";


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

export function WebAnalyticsSection() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [period, setPeriod] = useState<PlausiblePeriod>("30d");

  const hasPlausible = currentWorkspace?.has_plausible_analytics ?? false;

  const { data: stats, isLoading } = useQuery({
    queryKey: ["workspace-plausible-stats", currentWorkspace?.id, period],
    queryFn: () => getWorkspacePlausibleStats(period),
    enabled: hasPlausible,
    staleTime: 60_000,
  });

  const timeseries = useMemo(
    () => fillPlausibleSeriesGaps(stats?.timeseries ?? [], period),
    [stats?.timeseries, period]
  );

  // Don't render if workspace has no analytics service or no brand plausible key
  if (!hasPlausible) return null;

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
        {
          label: t("home.metricPageviews"),
          value: formatNumber(agg.pageviews),
        },
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
          <div className="flex items-center gap-0.5 sm:gap-1 rounded-xl bg-muted p-0.5 sm:p-1 overflow-x-auto scrollbar-hide">
            {PLAUSIBLE_PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPeriod(p.value)}
                className={cn(
                  "rounded-lg px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-[11px] font-medium transition-all duration-150 whitespace-nowrap shrink-0 max-sm:min-h-10 max-sm:px-3 max-sm:text-[13px]",
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0 max-sm:min-h-11 max-sm:text-[13px]"
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
                stroke="#141516"
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "#141516",
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
