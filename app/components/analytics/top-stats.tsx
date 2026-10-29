import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "~/lib/utils";
import { Skeleton } from "~/components/ui/skeleton";
import {
  explorerLabel,
  fillSlots,
  type ExplorerInterval,
} from "~/lib/analytics/website-stats";
import type { Overview, Series, StatsMetric } from "~/lib/api/website-stats";
import { formatMetric, metricLabel } from "./labels";

const METRICS: StatsMetric[] = [
  "visitors",
  "visits",
  "pageviews",
  "views_per_visit",
  "bounce_rate",
  "visit_duration",
];

/** Lower is better for these two. */
const LOWER_IS_BETTER: Partial<Record<StatsMetric, true>> = { bounce_rate: true };

const INK = "#141516";
const AXIS_TICK = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

function Change({
  metric,
  current,
  previous,
}: {
  metric: StatsMetric;
  current: number;
  previous: number;
}) {
  const { t, i18n } = useTranslation();
  if (metric === "bounce_rate") {
    const diff = Math.round(current - previous);
    if (diff === 0) return <Flat />;
    const good = diff < 0;
    return (
      <span className={cn("text-[12px] font-semibold", good ? "text-earned" : "text-overdue")}>
        {diff > 0 ? "↑" : "↓"} {t("analytics.points", "{{n}} pts", { n: Math.abs(diff) })}
      </span>
    );
  }
  if (!previous) {
    return current ? (
      <span className="text-[12px] font-semibold text-muted-foreground">
        {t("analytics.newThisPeriod", "new")}
      </span>
    ) : (
      <Flat />
    );
  }
  const rel = (current - previous) / previous;
  if (Math.abs(rel) < 0.005) return <Flat />;
  const good = LOWER_IS_BETTER[metric] ? rel < 0 : rel > 0;
  const pct = Math.round(Math.abs(rel) * 100);
  return (
    <span className={cn("text-[12px] font-semibold", good ? "text-earned" : "text-overdue")}>
      {rel > 0 ? "↑" : "↓"} {pct.toLocaleString(i18n.language)}%
    </span>
  );
}

function Flat() {
  const { t } = useTranslation();
  return <span className="text-[12px] font-medium text-muted-foreground">{t("analytics.noChange", "no change")}</span>;
}

export function TopStats({
  overview,
  loading,
  metric,
  onMetric,
}: {
  overview: Overview | null | undefined;
  loading: boolean;
  metric: StatsMetric;
  onMetric: (m: StatsMetric) => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <div className="grid grid-cols-2 border-b border-border sm:grid-cols-3 lg:grid-cols-6">
      {METRICS.map((m) => {
        const on = m === metric;
        const cur = overview?.current[m] ?? 0;
        const prev = overview?.previous?.[m];
        return (
          <button
            key={m}
            type="button"
            onClick={() => onMetric(m)}
            aria-pressed={on}
            className={cn(
              "min-w-0 border-b-[3px] px-4 pb-3 pt-4 text-left transition-colors hover:bg-muted/40 max-lg:border-r max-lg:border-r-border/60",
              on ? "border-b-foreground bg-muted/40" : "border-b-transparent",
            )}
          >
            <span className="block truncate text-[12px] font-semibold text-muted-foreground">
              {metricLabel(m, t)}
            </span>
            {loading ? (
              <Skeleton className="mt-1.5 h-7 w-20" />
            ) : (
              <span className="title-display num mt-1 block truncate text-[24px] font-semibold text-foreground sm:text-[26px]">
                {formatMetric(m, cur, i18n.language)}
              </span>
            )}
            <span className="mt-0.5 block min-h-[18px]">
              {!loading && prev !== undefined ? (
                <Change metric={m} current={cur} previous={prev} />
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function VisitorsChart({
  series,
  loading,
  metric,
  interval,
  intervals,
  onInterval,
  from,
  to,
  compareFrom,
  compareTo,
  compareMode,
}: {
  series: Series | null | undefined;
  loading: boolean;
  metric: StatsMetric;
  interval: ExplorerInterval;
  intervals: ExplorerInterval[];
  onInterval: (i: ExplorerInterval) => void;
  from: string;
  to: string;
  compareFrom: string | null;
  compareTo: string | null;
  compareMode: "off" | "previous" | "year";
}) {
  const { t, i18n } = useTranslation();
  const data = useMemo(() => {
    const cur = fillSlots(series?.points ?? [], interval, from, to);
    const prev =
      series?.previous && compareFrom && compareTo
        ? fillSlots(series.previous, interval, compareFrom, compareTo, new Date(8.64e15))
        : null;
    return cur.map((p, i) => ({
      date: p.date,
      value: p.value,
      previous: prev ? (prev[i]?.value ?? null) : null,
      previousDate: prev ? (prev[i]?.date ?? null) : null,
    }));
  }, [series, interval, from, to, compareFrom, compareTo]);

  const step = Math.max(1, Math.ceil(data.length / 8));
  const ticks = data.filter((_, i) => i % step === 0).map((p) => p.date);
  const hasPrev = data.some((p) => p.previous !== null);
  const intervalLabel: Record<ExplorerInterval, string> = {
    hour: t("analytics.interval.hour", "Hours"),
    day: t("analytics.interval.day", "Days"),
    week: t("analytics.interval.week", "Weeks"),
    month: t("analytics.interval.month", "Months"),
  };

  return (
    <div className="space-y-3 px-4 pb-4 pt-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[15px] font-semibold text-foreground">
          {metricLabel(metric, t)}
          {hasPrev ? (
            <span className="ml-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
              <span className="inline-block w-4 border-t-2 border-dashed border-muted-foreground" aria-hidden />
              {compareMode === "year"
                ? t("analytics.comparedYear", "same dates last year")
                : t("analytics.comparedPeriod", "the period before")}
            </span>
          ) : null}
        </p>
        {intervals.length > 1 ? (
          <div role="radiogroup" aria-label={t("analytics.intervalLabel", "Group by")} className="inline-flex rounded-lg bg-muted p-0.5">
            {intervals.map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={interval === i}
                onClick={() => onInterval(i)}
                className={cn(
                  "rounded-md px-3 text-[12.5px] font-medium transition-colors max-sm:min-h-10 sm:py-1.5",
                  interval === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {intervalLabel[i]}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="h-56 w-full sm:h-64" />
      ) : (
        <div className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="statsInk" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={INK} stopOpacity={0.14} />
                  <stop offset="100%" stopColor={INK} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={(v) => explorerLabel(String(v), interval)}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                dy={8}
              />
              <YAxis
                allowDecimals={metric === "views_per_visit"}
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                width={44}
                tickFormatter={(v) => formatMetric(metric, Number(v), i18n.language)}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
                  if (!active || !row) return null;
                  return (
                    <div className="space-y-1 rounded-lg border border-border bg-card px-3 py-2 text-[13px] shadow-md">
                      <p className="text-[11px] text-muted-foreground">{explorerLabel(row.date, interval, true)}</p>
                      <p className="font-semibold text-foreground">
                        {metricLabel(metric, t)}: {formatMetric(metric, row.value, i18n.language)}
                      </p>
                      {row.previous !== null && row.previousDate ? (
                        <p className="text-muted-foreground">
                          {explorerLabel(row.previousDate, interval, true)}:{" "}
                          {formatMetric(metric, row.previous, i18n.language)}
                        </p>
                      ) : null}
                    </div>
                  );
                }}
              />
              {hasPrev ? (
                <Line
                  type="monotone"
                  dataKey="previous"
                  stroke="#8a8780"
                  strokeWidth={1.6}
                  strokeDasharray="5 5"
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
              <Area
                type="monotone"
                dataKey="value"
                stroke={INK}
                strokeWidth={2}
                fill="url(#statsInk)"
                activeDot={{ r: 4, fill: INK, stroke: "var(--card)", strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
