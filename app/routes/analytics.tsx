import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { formatNumber } from "~/lib/utils/format";
import { countryName } from "~/lib/forms/phone";
import {
  getWorkspacePlausibleStats,
  type PlausiblePeriod,
} from "~/lib/api/workspaces";
import {
  WEBSITE_PERIODS,
  fillSeriesGaps,
  flagEmoji,
  formatBucketLabel,
  secondsToWords,
} from "~/lib/analytics/website-stats";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { EmptyState } from "~/components/notebook/empty-state";
import { Stat } from "~/components/notebook/stat";
import { Segmented } from "~/components/notebook/segmented";
import { Skeleton } from "~/components/ui/skeleton";
import { Button } from "~/components/ui/button";

export function meta() {
  return [
    { title: i18n.t("analytics.metaTitle") },
    { name: "description", content: i18n.t("analytics.metaDescription") },
  ];
}

const AXIS_TICK = {
  fontSize: 11,
  fill: "var(--muted-foreground)",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
};

/** Website visitors, drawn from our own stats (pa-002 ClickHouse). */
export default function Analytics() {
  const { t, i18n: i18nInstance } = useTranslation();
  useDocumentMeta({
    titleKey: "analytics.metaTitle",
    descriptionKey: "analytics.metaDescription",
  });
  const { currentWorkspace } = useAuthContext();
  const tracked = currentWorkspace?.has_plausible_analytics ?? false;
  const [period, setPeriod] = useState<PlausiblePeriod>("30d");

  // Same key as the Website card, so both share one cache entry.
  const { data: stats, isLoading } = useQuery({
    queryKey: ["workspace-plausible-stats", currentWorkspace?.id, period],
    queryFn: () => getWorkspacePlausibleStats(period),
    enabled: tracked,
    staleTime: 5 * 60_000,
  });

  const series = useMemo(
    () => fillSeriesGaps(stats?.timeseries ?? [], period),
    [stats?.timeseries, period],
  );
  const locale = i18nInstance.language ?? "de";

  const header = (
    <PageHeader
      eyebrow={t("sections.results", "Results")}
      title={t("analytics.title")}
      subtitle={stats?.site_id ? stats.site_id : t("analytics.subtitle")}
      actions={
        tracked ? (
          <Segmented
            value={period}
            onChange={setPeriod}
            label={t("analytics.periodLabel")}
            className="max-w-full overflow-x-auto scrollbar-hide"
            options={WEBSITE_PERIODS.map((p) => ({
              value: p.value,
              label: t(p.labelKey),
            }))}
          />
        ) : null
      }
    />
  );

  if (!tracked || (!isLoading && !stats)) {
    return (
      <PageContainer className="space-y-6">
        {header}
        <Panel className="p-5 sm:p-6">
          <EmptyState
            icon={<Globe className="size-5" aria-hidden />}
            title={t("analytics.notTrackedTitle")}
            body={t("analytics.notTrackedBody")}
            action={
              <Button asChild variant="outline">
                <Link to="/website">{t("analytics.notTrackedAction")}</Link>
              </Button>
            }
          />
        </Panel>
      </PageContainer>
    );
  }

  const agg = stats?.aggregate;
  const nobody = !isLoading && (agg?.visitors ?? 0) === 0;
  const tickStep = Math.max(1, Math.ceil(series.length / 8));
  const ticks = series
    .filter((_, i) => i % tickStep === 0 || i === series.length - 1)
    .map((p) => p.date);

  return (
    <PageContainer className="space-y-6">
      {header}

      <Panel className="p-5 sm:p-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-56 w-full" />
          </div>
        ) : (
          <>
            <p className="title-display text-[22px] font-semibold leading-snug text-foreground sm:text-[26px]">
              {t("analytics.headline", {
                count: agg?.visitors ?? 0,
                formatted: formatNumber(agg?.visitors ?? 0),
              })}
            </p>
            {nobody ? (
              <p className="mt-2 text-[14px] text-muted-foreground">
                {period === "all_time"
                  ? t("analytics.nobodyEver")
                  : t("analytics.nobodyTryLonger")}
              </p>
            ) : (
              <div className="mt-5 h-56 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={series}
                    margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
                  >
                    <defs>
                      <linearGradient id="visitorsInk" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#141516" stopOpacity={0.14} />
                        <stop offset="100%" stopColor="#141516" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="var(--border)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      ticks={ticks}
                      tickFormatter={(v) => formatBucketLabel(v, period)}
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      dy={8}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                      content={({ active, payload, label }) =>
                        active && payload?.length && label ? (
                          <div className="space-y-0.5 rounded-lg border border-border bg-card px-3 py-2 text-[13px] shadow-md">
                            <p className="text-[11px] text-muted-foreground">
                              {formatBucketLabel(String(label), period)}
                            </p>
                            <p className="font-semibold text-foreground">
                              {t("home.plausibleVisitors", {
                                count: Number(payload[0]?.payload?.visitors ?? 0),
                              })}
                            </p>
                            <p className="text-muted-foreground">
                              {t("analytics.pagesInTooltip", {
                                count: Number(payload[0]?.payload?.pageviews ?? 0),
                              })}
                            </p>
                          </div>
                        ) : null
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="visitors"
                      stroke="#141516"
                      strokeWidth={2}
                      fill="url(#visitorsInk)"
                      activeDot={{ r: 4, fill: "#141516", stroke: "var(--card)", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mt-6 grid grid-cols-2 gap-6 border-t border-border pt-6 sm:grid-cols-4">
              <Stat value={formatNumber(agg?.visits ?? 0)} label={t("analytics.visits")} />
              <Stat
                value={formatNumber(agg?.pageviews ?? 0)}
                label={t("analytics.pagesViewed")}
              />
              <Stat
                value={`${Math.round(agg?.bounce_rate ?? 0)}%`}
                label={t("analytics.leftAfterOne")}
              />
              <Stat
                value={secondsToWords(agg?.visit_duration ?? 0, locale)}
                label={t("analytics.timeOnSite")}
              />
            </div>
          </>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-3">
        <ShareList
          title={t("analytics.sourcesTitle")}
          loading={isLoading}
          rows={(stats?.top_sources ?? []).map((s) => ({
            key: s.source,
            label:
              s.source === "Direct / None" ? t("analytics.sourceDirect") : s.source,
            value: s.visitors,
          }))}
          empty={t("analytics.listEmpty")}
        />
        <ShareList
          title={t("analytics.pagesTitle")}
          loading={isLoading}
          rows={(stats?.top_pages ?? []).map((p) => ({
            key: p.page,
            label: p.page,
            mono: true,
            value: p.visitors,
          }))}
          empty={t("analytics.listEmpty")}
        />
        <ShareList
          title={t("analytics.countriesTitle")}
          loading={isLoading}
          rows={(stats?.countries ?? []).map((c) => ({
            key: c.country,
            label: countryName(c.country, locale),
            prefix: flagEmoji(c.country),
            value: c.visitors,
          }))}
          empty={t("analytics.listEmpty")}
        />
      </div>
    </PageContainer>
  );
}

type ShareRow = {
  key: string;
  label: string;
  value: number;
  prefix?: string;
  mono?: boolean;
};

/** A ranked list where a thin ink bar shows each row's share of the top row. */
function ShareList({
  title,
  rows,
  loading,
  empty,
}: {
  title: string;
  rows: ShareRow[];
  loading: boolean;
  empty: string;
}) {
  const { t } = useTranslation();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Panel>
      <PanelHeader title={title} hint={t("analytics.peopleColumn")} />
      {loading ? (
        <div className="space-y-2 p-4 sm:p-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="px-4 py-5 text-[14px] text-muted-foreground sm:px-5">{empty}</p>
      ) : (
        <ul className="space-y-1 p-2 sm:p-3">
          {rows.map((r) => (
            <li key={r.key} className="relative flex min-h-10 items-center gap-3 rounded-md px-2.5">
              <span
                aria-hidden
                className="absolute inset-y-1 left-0 rounded-md bg-foreground/[0.06]"
                style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
              />
              <span
                className={
                  "relative min-w-0 flex-1 truncate text-[14px] text-foreground" +
                  (r.mono ? " font-mono text-[13px]" : "")
                }
                title={r.label}
              >
                {r.prefix ? <span className="mr-1.5">{r.prefix}</span> : null}
                {r.label}
              </span>
              <span className="num relative text-[14px] font-semibold text-foreground">
                {formatNumber(r.value)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
