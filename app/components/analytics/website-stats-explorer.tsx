import { useMemo, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { formatNumber } from "~/lib/utils/format";
import { intervalsFor, readFilters, type ExplorerInterval } from "~/lib/analytics/website-stats";
import {
  getStatsOverview,
  getStatsRealtime,
  getStatsSeries,
  statsKeys,
  type StatsCompare,
  type StatsDimension,
  type StatsFilter,
  type StatsMetric,
  type StatsParams,
  type StatsScope,
} from "~/lib/api/website-stats";
import { Panel } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Button } from "~/components/ui/button";
import {
  DateRangePicker,
  RANGE_PRESETS,
  presetRange,
  type RangePreset,
  type RangeValue,
} from "~/components/notebook/date-range-picker";
import { TopStats, VisitorsChart } from "./top-stats";
import { BreakdownPanel } from "./breakdown-panel";
import { GoalsPanel } from "./goals-panel";
import { FilterBar } from "./filter-bar";

const DIMS: StatsDimension[] = [
  "channel", "source", "referrer", "utm_medium", "utm_source", "utm_campaign", "utm_content",
  "utm_term", "page", "entry_page", "exit_page", "country", "region", "device", "browser", "os", "goal",
];
const METRICS: StatsMetric[] = ["visitors", "visits", "pageviews", "views_per_visit", "bounce_rate", "visit_duration"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Mirrors the server's comparison window so the chart can line both up. */
function compareOf(from: string, to: string, mode: StatsCompare): { from: string; to: string } | null {
  if (mode === "off") return null;
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (mode === "year") {
    f.setFullYear(f.getFullYear() - 1);
    t.setFullYear(t.getFullYear() - 1);
    return { from: ymd(f), to: ymd(t) };
  }
  const days = Math.round((t.getTime() - f.getTime()) / 86_400_000) + 1;
  const end = new Date(f);
  end.setDate(end.getDate() - 1);
  const start = new Date(f);
  start.setDate(start.getDate() - days);
  return { from: ymd(start), to: ymd(end) };
}

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Berlin";
  } catch {
    return "Europe/Berlin";
  }
}

/** The pill showing people on the site right now. */
function LiveDot({ visitors }: { visitors: number }) {
  const { t } = useTranslation();
  const on = visitors > 0;
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-foreground">
      <span className="relative flex size-2.5" aria-hidden>
        {on ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-earned/60 motion-reduce:animate-none" />
        ) : null}
        <span className={on ? "relative inline-flex size-2.5 rounded-full bg-earned" : "relative inline-flex size-2.5 rounded-full bg-muted-foreground/50"} />
      </span>
      {t("analytics.liveNow", { count: visitors, formatted: formatNumber(visitors) })}
    </span>
  );
}

/**
 * The website-visitors explorer: date picker with comparison, filters, top
 * numbers, chart, four tabbed panels and goals. Used by the workspace page
 * (/analytics) and by brands for one partner house (/brand/analytics).
 * State lives in the URL; other search params (e.g. `workspace`) are kept.
 */
export function WebsiteStatsExplorer({
  scope,
  header,
}: {
  scope: StatsScope;
  /** Page header; gets the matched website and the live pill once known. */
  header: (info: { site: string | null; live: ReactNode }) => ReactNode;
}) {
  const { t } = useTranslation();
  const [sp, setSp] = useSearchParams();

  // ── State from the URL (shareable, back button works) ──
  const presetParam = sp.get("preset") as RangePreset | null;
  const fromParam = sp.get("from");
  const toParam = sp.get("to");
  const range: RangeValue = useMemo(() => {
    if (presetParam && RANGE_PRESETS.includes(presetParam)) {
      return { ...presetRange(presetParam), preset: presetParam };
    }
    if (fromParam && toParam && DAY.test(fromParam) && DAY.test(toParam)) {
      return { from: fromParam, to: toParam, preset: null };
    }
    return { ...presetRange("last_30"), preset: "last_30" };
  }, [presetParam, fromParam, toParam]);
  const compare = (["off", "previous", "year"].includes(sp.get("compare") ?? "")
    ? sp.get("compare")
    : "previous") as StatsCompare;
  const metric = (METRICS.includes(sp.get("metric") as StatsMetric) ? sp.get("metric") : "visitors") as StatsMetric;
  const filtersRaw = sp.get("f");
  const filters = useMemo(() => readFilters<StatsFilter>(filtersRaw, DIMS), [filtersRaw]);
  const intervals = intervalsFor(range.from, range.to);
  const interval = (intervals.includes(sp.get("interval") as ExplorerInterval)
    ? sp.get("interval")
    : intervals[0]) as ExplorerInterval;

  const update = (patch: Record<string, string | null>, push = true) => {
    const next = new URLSearchParams(sp);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    setSp(next, { replace: !push, preventScrollReset: true });
  };

  const params: StatsParams = useMemo(
    () => ({ from: range.from, to: range.to, tz: browserTimeZone(), filters }),
    [range.from, range.to, filters],
  );
  const cmpRange = compareOf(range.from, range.to, compare);

  const overview = useQuery({
    queryKey: statsKeys.overview(scope, params, compare),
    queryFn: () => getStatsOverview(scope, params, compare),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const series = useQuery({
    queryKey: statsKeys.series(scope, params, metric, interval, compare),
    queryFn: () => getStatsSeries(scope, params, metric, interval, compare),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const live = useQuery({
    queryKey: statsKeys.realtime(scope),
    queryFn: () => getStatsRealtime(scope),
    refetchInterval: 30_000,
  });

  const setFilters = (next: StatsFilter[]) => update({ f: next.length ? JSON.stringify(next) : null });
  const addFilter = (dim: StatsDimension, value: string) => {
    const rest = filters.filter((f) => !(f.dim === dim && f.op === "is"));
    setFilters([...rest, { dim, op: "is", values: [value] }]);
  };

  const failed = !overview.isLoading && (overview.isError || overview.data === null);
  const dimTabs = (list: [StatsDimension, string, string][]) =>
    list.map(([dim, k, f]) => ({ dim: dim as Exclude<StatsDimension, "goal">, label: t(k, f) }));

  return (
    <>
      {header({
        site: overview.data?.site_id ?? null,
        live: live.data ? <LiveDot visitors={live.data.visitors} /> : null,
      })}

      <div className="space-y-2.5 sm:sticky sm:top-0 sm:z-20 sm:-mx-6 sm:bg-background/95 sm:px-6 sm:py-2.5 sm:backdrop-blur">
        <DateRangePicker
          value={range}
          compare={compare}
          onChange={(v, c) =>
            update(
              v.preset
                ? { preset: v.preset, from: null, to: null, compare: c, interval: null }
                : { preset: null, from: v.from, to: v.to, compare: c, interval: null },
            )
          }
          className="max-sm:w-full"
        />
        <FilterBar filters={filters} onChange={setFilters} params={params} scope={scope} />
      </div>

      {failed ? (
        <Panel className="p-5 sm:p-6">
          <EmptyState
            title={t("analytics.loadFailedTitle", "The numbers didn't load")}
            body={t("analytics.loadFailed", "We couldn't load this right now. Try again in a minute.")}
            action={
              <Button variant="outline" onClick={() => overview.refetch()}>
                {t("analytics.retry", "Try again")}
              </Button>
            }
          />
        </Panel>
      ) : (
        <>
          <Panel className="overflow-hidden">
            <TopStats
              overview={overview.data}
              loading={overview.isLoading}
              metric={metric}
              onMetric={(m) => update({ metric: m === "visitors" ? null : m }, false)}
            />
            <VisitorsChart
              series={series.data}
              loading={series.isLoading}
              metric={metric}
              interval={interval}
              intervals={intervals}
              onInterval={(i) => update({ interval: i === intervals[0] ? null : i }, false)}
              from={range.from}
              to={range.to}
              compareFrom={cmpRange?.from ?? null}
              compareTo={cmpRange?.to ?? null}
              compareMode={compare}
            />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <BreakdownPanel
              title={t("analytics.sourcesTitle", "Where they came from")}
              hint={t("analytics.rowFilterTip", "Click a row to filter")}
              params={params}
              scope={scope}
              enabled
              onFilter={addFilter}
              tabs={[
                { key: "channel", label: t("analytics.tab.channels", "Channels"), dims: dimTabs([["channel", "analytics.dim.channel", "Channel"]]) },
                { key: "source", label: t("analytics.tab.sources", "Sources"), dims: dimTabs([["source", "analytics.dim.source", "Source"]]) },
                {
                  key: "utm",
                  label: t("analytics.tab.utm", "Campaign links (UTM)"),
                  dims: dimTabs([
                    ["utm_campaign", "analytics.utm.campaign", "Campaign"],
                    ["utm_source", "analytics.utm.source", "Source"],
                    ["utm_medium", "analytics.utm.medium", "Medium"],
                    ["utm_content", "analytics.utm.content", "Content"],
                    ["utm_term", "analytics.utm.term", "Term"],
                  ]),
                },
                { key: "referrer", label: t("analytics.tab.referrers", "Referring pages"), dims: dimTabs([["referrer", "analytics.dim.referrer", "Referring page"]]) },
              ]}
            />
            <BreakdownPanel
              title={t("analytics.pagesTitle", "Pages")}
              hint={t("analytics.pagesHint", "Entry = first page, exit = last page")}
              params={params}
              scope={scope}
              enabled
              onFilter={addFilter}
              tabs={[
                { key: "page", label: t("analytics.tab.topPages", "Top pages"), dims: dimTabs([["page", "analytics.dim.page", "Page"]]) },
                { key: "entry", label: t("analytics.tab.entryPages", "Entry pages"), dims: dimTabs([["entry_page", "analytics.dim.entryPage", "Entry page"]]) },
                { key: "exit", label: t("analytics.tab.exitPages", "Exit pages"), dims: dimTabs([["exit_page", "analytics.dim.exitPage", "Exit page"]]) },
              ]}
            />
            <BreakdownPanel
              title={t("analytics.locationsTitle", "Locations")}
              hint={t("analytics.citiesNote", "City names are not available")}
              params={params}
              scope={scope}
              enabled
              onFilter={addFilter}
              tabs={[
                { key: "country", label: t("analytics.tab.countries", "Countries"), dims: dimTabs([["country", "analytics.dim.country", "Country"]]) },
                { key: "region", label: t("analytics.tab.regions", "Regions"), dims: dimTabs([["region", "analytics.dim.region", "Region"]]) },
              ]}
            />
            <BreakdownPanel
              title={t("analytics.devicesTitle", "Devices")}
              params={params}
              scope={scope}
              enabled
              onFilter={addFilter}
              tabs={[
                { key: "device", label: t("analytics.tab.device", "Device"), dims: dimTabs([["device", "analytics.dim.device", "Device"]]) },
                { key: "browser", label: t("analytics.tab.browser", "Browser"), dims: dimTabs([["browser", "analytics.dim.browser", "Browser"]]) },
                { key: "os", label: t("analytics.tab.os", "System"), dims: dimTabs([["os", "analytics.dim.os", "System"]]) },
              ]}
            />
          </div>

          <GoalsPanel params={params} scope={scope} enabled onFilter={(goal) => addFilter("goal", goal)} />

          <p className="text-[12px] text-muted-foreground">
            {t("analytics.footnote", "Counted without cookies. Times are in your time zone ({{tz}}).", { tz: params.tz })}
          </p>
        </>
      )}
    </>
  );
}
