import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { formatNumber } from "~/lib/utils/format";
import { secondsToWords } from "~/lib/analytics/website-stats";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { Skeleton } from "~/components/ui/skeleton";
import {
  getStatsReadDepth,
  statsKeys,
  type StatsParams,
  type StatsScope,
} from "~/lib/api/website-stats";

const LIMIT = 8;

/**
 * How people read each page: time spent per person and how far down they
 * scrolled. From the reading pings the tracking script already sends, so no
 * set-up. Two lines per row on phones; no sideways scrolling.
 */
export function ReadDepthPanel({
  params,
  scope,
  onFilterPage,
}: {
  params: StatsParams;
  scope: StatsScope;
  onFilterPage: (page: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: statsKeys.readDepth(scope, params, LIMIT),
    queryFn: () => getStatsReadDepth(scope, params, LIMIT),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];

  return (
    <Panel>
      <PanelHeader
        title={t("analytics.read.title", "How people read your pages")}
        hint={t("analytics.read.hint", "Time spent per person, and how far down they got")}
      />
      {isLoading ? (
        <Skeleton className="m-4 h-40 sm:m-5" />
      ) : isError || !data ? (
        <p className="px-4 py-5 text-[14px] text-muted-foreground sm:px-5">
          {t("analytics.loadFailed", "We couldn't load this right now. Try again in a minute.")}
        </p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-5 text-[14px] text-muted-foreground sm:px-5">
          {t("analytics.read.empty", "No reading data in this period yet. It appears as soon as people visit your pages.")}
        </p>
      ) : (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_9rem] gap-3 px-5 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
            <span>{t("analytics.dim.page", "Page")}</span>
            <span className="text-right">{t("analytics.metric.visitors", "People")}</span>
            <span className="text-right">{t("analytics.read.time", "Time spent")}</span>
            <span>{t("analytics.read.depth", "Read")}</span>
          </div>
          <ul className="divide-y divide-border/70">
            {rows.map((r) => {
              const depth = r.scroll_depth;
              return (
                <li key={r.page}>
                  <button
                    type="button"
                    onClick={() => onFilterPage(r.page)}
                    title={t("analytics.rowFilterTip", "Click a row to filter")}
                    className="press grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-left hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-foreground/20 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_9rem] sm:px-5"
                  >
                    <span className="truncate font-mono text-[13px] text-foreground">{r.page}</span>
                    <span className="num text-right text-[13.5px] font-semibold sm:order-none">
                      {formatNumber(r.visitors)}
                      <span className="ml-1 font-normal text-muted-foreground sm:hidden">
                        {t("analytics.goals.people", "people", { count: r.visitors })}
                      </span>
                    </span>
                    <span className="num text-[13px] text-muted-foreground sm:text-right sm:text-foreground">
                      <span className="sm:hidden">{t("analytics.read.time", "Time spent")}: </span>
                      {secondsToWords(r.time_on_page, i18n.language)}
                    </span>
                    <span className="flex items-center gap-2 max-sm:w-36 max-sm:justify-self-end">
                      <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]" aria-hidden>
                        <span className="block h-full rounded-full bg-foreground" style={{ width: `${depth ?? 0}%` }} />
                      </span>
                      <span className="num w-10 shrink-0 text-right text-[13px]">
                        {depth == null ? "–" : `${depth}%`}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Panel>
  );
}
