/**
 * The old home screen's two overview sections, re-homed on Results
 * (NOTEBOOK_UX_PLAN.md §3 "Re-homed old home content"). Unchanged logic.
 */
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  ArrowRight,
  Inbox,
  TrendingUp,
  Trophy,
  Columns3,
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
import { useAuthContext } from "~/providers/auth-provider";
import { cn } from "~/lib/utils";
import {
  formatDateShort,
  formatNumber,
  formatCurrency,
  formatCurrencyTotals,
  sumByCurrency,
} from "~/lib/utils/format";
import { useWorkspaceCurrency } from "~/lib/hooks/useWorkspaceCurrency";
import { getLeadAnalytics, type LeadAnalyticsPeriod } from "~/lib/api/leads";
import { getDeals, type DealListItem } from "~/lib/api/deals";
import { useDealStageLookup } from "~/lib/hooks/usePipelineStages";

function usePeriods(): { value: LeadAnalyticsPeriod; labelKey: string }[] {
  return [
    { value: "1d", labelKey: "home.period1d" },
    { value: "7d", labelKey: "home.period7d" },
    { value: "30d", labelKey: "home.period30d" },
    { value: "all_time", labelKey: "home.periodAllTime" },
  ];
}

const FORM_NAME_COLORS = [
  "#141516",
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

  if (period === "1d") {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let h = 0; h <= now.getHours(); h++) {
      const d = new Date(today);
      d.setHours(h);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(h).padStart(2, "0")}:00:00`;
      slots.push(key);
    }
  } else if (period === "7d") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      slots.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
      );
    }
  } else if (period === "30d") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
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
  if (period === "1d") {
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

export function LeadAnalyticsChart() {
  const { currentWorkspace } = useAuthContext();
  const { t } = useTranslation();
  const periods = usePeriods();
  const [period, setPeriod] = useState<LeadAnalyticsPeriod>("7d");

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
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0 mt-1 max-sm:min-h-11 max-sm:text-[13px]"
        >
          {t("home.viewAllInquiries", "See all inquiries")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex items-center gap-0.5 sm:gap-1 rounded-xl bg-muted p-0.5 sm:p-1 overflow-x-auto scrollbar-hide w-fit">
        {periods.map((p) => (
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

      {!isLoading && data && data.form_names.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.form_names.map((f, idx) => (
            <Link
              key={f.form_name}
              to={`/lead-form?form_name=${f.form_name}`}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-[12px] no-underline transition-colors hover:border-primary/40 hover:bg-muted max-sm:min-h-10 max-sm:text-[13px]"
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
        )}
      </div>
    </div>
  );
}

type SummaryCategory = "open" | "won";

const DEAL_SUMMARY_CARDS: {
  category: SummaryCategory;
  labelKey: string;
  labelDefault: string;
  icon: typeof Inbox;
  iconWrap: string;
  accent: string;
  ring: string;
}[] = [
  {
    category: "open",
    labelKey: "home.dealsOpen",
    labelDefault: "Open deals",
    icon: TrendingUp,
    iconWrap: "bg-sky-100 text-sky-600",
    accent: "from-sky-400/20",
    ring: "group-hover:ring-sky-300/60",
  },
  {
    category: "won",
    labelKey: "home.dealsWon",
    labelDefault: "Won",
    icon: Trophy,
    iconWrap: "bg-emerald-100 text-emerald-600",
    accent: "from-emerald-400/20",
    ring: "group-hover:ring-emerald-300/60",
  },
];

function sumDealValue(deals: DealListItem[]): Map<string, number> {
  return sumByCurrency(deals, (d) => ({ value: d.value, currency: d.currency }));
}

function mergeTotals(...maps: Array<Map<string, number>>): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of maps) for (const [k, v] of m) out.set(k, (out.get(k) ?? 0) + v);
  return out;
}

export function DealsSummarySection() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  // Deals here span every pipeline, so the lookup resolves per deal.
  const { resolve: resolveDealStage } = useDealStageLookup();

  const { data, isLoading } = useQuery({
    // Nested under the "deals-pipeline" prefix so every deal mutation
    // (move, reorder, won/lost, create, edit) — which all invalidate
    // ["deals-pipeline"] — also refreshes these summary counts.
    queryKey: ["deals-pipeline", "home-summary", currentWorkspace?.id],
    queryFn: () => getDeals({ page: 1, limit: 500 }),
    enabled: !!currentWorkspace,
    // The global default is refetchOnMount: false, so a query invalidated
    // while this page is unmounted (e.g. after creating a deal from the
    // pipeline) would serve stale cache on return and miss the new deal.
    // Refetch on mount so navigating back to home always reflects mutations.
    staleTime: 0,
    refetchOnMount: "always",
  });

  const byCategory = useMemo(() => {
    const acc: Record<SummaryCategory, DealListItem[]> = { open: [], won: [] };
    for (const d of data?.data ?? []) {
      // Unknown keys (stage deleted from config) count as open — better than
      // vanishing from the summary.
      const category = resolveDealStage(d.pipeline_id, d.stage)?.category ?? "open";
      if (category === "open" || category === "won") acc[category].push(d);
    }
    return acc;
  }, [data?.data, resolveDealStage]);

  // Lost deals stay excluded, matching the old hardcoded new+in_progress+won.
  const masterTotals = mergeTotals(sumDealValue(byCategory.open), sumDealValue(byCategory.won));
  const { currency: workspaceCurrency } = useWorkspaceCurrency();
  // The workspace currency is the headline; other currencies sit under it,
  // never added in (no exchange rates).
  const headline = masterTotals.get(workspaceCurrency) ?? 0;
  const others = new Map([...masterTotals].filter(([cur, v]) => cur !== workspaceCurrency && v !== 0));

  return (
    <div
      className="app-fade-up rounded-2xl border border-border bg-card p-4 sm:p-6 space-y-4 sm:space-y-5"
      style={{ animationDelay: "0.02s" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Columns3 className="h-3 w-3" />
            {t("home.dealsTitle", { defaultValue: "Pipeline" })}
          </p>
          {isLoading ? (
            <div className="h-8 w-12 animate-pulse rounded-md bg-muted" />
          ) : (
            <>
              <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
                {formatCurrency(headline, workspaceCurrency)}
              </p>
              {others.size > 0 ? (
                <p className="text-sm font-semibold text-muted-foreground tabular-nums">
                  + {formatCurrencyTotals(others, workspaceCurrency)}
                </p>
              ) : null}
            </>
          )}
        </div>

        <Link
          to="/pipeline"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors shrink-0 mt-1 max-sm:min-h-11 max-sm:text-[13px]"
        >
          {t("home.viewPipeline", { defaultValue: "View pipeline" })}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Stage cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DEAL_SUMMARY_CARDS.map(
          ({ category, labelKey, labelDefault, icon: Icon, iconWrap, accent }) => {
          const categoryDeals = byCategory[category];
          const count = categoryDeals.length;
          const total = sumDealValue(categoryDeals);

          return (
            <Link
              key={category}
              to="/pipeline"
              className="group relative overflow-hidden rounded-xl border border-border bg-muted/30 p-4 transition-colors duration-150 hover:bg-muted/60 hover:border-border/80"
            >

              <div className="relative flex items-start justify-between gap-3">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    iconWrap,
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/30 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
              </div>

              <div className="relative mt-4 space-y-1">
                <p className="text-[12px] font-medium text-muted-foreground">
                  {t(labelKey, { defaultValue: labelDefault })}
                </p>
                {isLoading ? (
                  <div className="h-8 w-14 animate-pulse rounded-md bg-muted" />
                ) : (
                  <p className="text-[28px] font-bold leading-none tracking-tight text-foreground tabular-nums">
                    {formatNumber(count)}
                  </p>
                )}
              </div>

              <div className="relative mt-3 flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                  {t("home.dealsTotalValue", { defaultValue: "Total value" })}
                </p>
                {isLoading ? (
                  <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                ) : (
                  <p className="text-[15px] font-semibold text-foreground tabular-nums leading-tight">
                    {formatCurrencyTotals(total, workspaceCurrency)}
                  </p>
                )}
              </div>
            </Link>
          );
        },
        )}
      </div>
    </div>
  );
}

// ─── Tasks Summary Section ───────────────────────────────────────────────────


