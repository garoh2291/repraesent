import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowRight, Search } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatNumber } from "~/lib/utils/format";
import { secondsToWords } from "~/lib/analytics/website-stats";
import { Panel } from "~/components/notebook/panel";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Skeleton } from "~/components/ui/skeleton";
import {
  getStatsBreakdown,
  statsKeys,
  type BreakdownRow,
  type StatsDimension,
  type StatsParams,
  type StatsScope,
} from "~/lib/api/website-stats";
import { dimensionLabel, valueLabel } from "./labels";

type RowDim = Exclude<StatsDimension, "goal">;

export interface PanelTab {
  key: string;
  label: string;
  /** One dimension, or several shown as small switches (the UTM fields). */
  dims: { dim: RowDim; label: string }[];
}

function Value({ dim, value }: { dim: RowDim; value: string }) {
  const { t, i18n } = useTranslation();
  const v = valueLabel(dim, value, t, i18n.language);
  return (
    <>
      {v.prefix ? <span className="mr-1.5">{v.prefix}</span> : null}
      <span className={cn(v.mono && "font-mono text-[13px]")}>{v.text}</span>
      {v.hint ? <span className="ml-1.5 text-[11.5px] text-muted-foreground">{v.hint}</span> : null}
    </>
  );
}

export function BreakdownPanel({
  title,
  hint,
  tabs,
  params,
  scope,
  enabled,
  onFilter,
}: {
  title: string;
  hint?: string;
  tabs: PanelTab[];
  params: StatsParams;
  scope: StatsScope;
  enabled: boolean;
  onFilter: (dim: RowDim, value: string) => void;
}) {
  const { t } = useTranslation();
  const [tabKey, setTabKey] = useState(tabs[0].key);
  const tab = tabs.find((x) => x.key === tabKey) ?? tabs[0];
  const [subDim, setSubDim] = useState<RowDim>(tab.dims[0].dim);
  const dim = tab.dims.some((d) => d.dim === subDim) ? subDim : tab.dims[0].dim;
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: statsKeys.breakdown(scope, params, dim, { limit: 8 }),
    queryFn: () => getStatsBreakdown(scope, params, dim, { limit: 8 }),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });

  const rows = data?.rows ?? [];
  const max = Math.max(1, ...rows.map((r) => r.visitors));

  return (
    <Panel className="flex min-w-0 flex-col">
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 sm:px-5">
        <h2 className="truncate text-[15px] font-semibold text-foreground">{title}</h2>
        {hint ? <span className="hidden truncate text-[12px] text-muted-foreground sm:inline">{hint}</span> : null}
      </div>
      <div role="tablist" className="scrollbar-hide flex overflow-x-auto border-b border-border px-4 sm:px-5">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={x.key === tab.key}
            onClick={() => {
              setTabKey(x.key);
              setSubDim(x.dims[0].dim);
            }}
            className={cn(
              "mr-4 min-h-11 shrink-0 whitespace-nowrap border-b-2 px-0.5 text-[13.5px] font-semibold transition-colors",
              x.key === tab.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab.dims.length > 1 ? (
        <div className="scrollbar-hide flex gap-1.5 overflow-x-auto px-4 pt-2.5 sm:px-5">
          {tab.dims.map((d) => (
            <button
              key={d.dim}
              type="button"
              aria-pressed={d.dim === dim}
              onClick={() => setSubDim(d.dim)}
              className={cn(
                "shrink-0 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors max-sm:min-h-10 sm:py-1",
                d.dim === dim ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex justify-between px-6 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-7">
        <span>{dimensionLabel(dim, t)}</span>
        <span>{t("analytics.metric.visitors", "People")}</span>
      </div>
      <div className="flex-1 px-2 pb-2 sm:px-3">
        {isLoading ? (
          <div className="space-y-1.5 px-2 py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError || data === null ? (
          <p className="px-3 py-5 text-[14px] text-muted-foreground">{t("analytics.loadFailed", "We couldn't load this right now. Try again in a minute.")}</p>
        ) : rows.length === 0 ? (
          <p className="px-3 py-5 text-[14px] text-muted-foreground">{t("analytics.listEmpty", "Nothing in this period yet.")}</p>
        ) : (
          <ul className="space-y-0.5">
            {rows.map((r) => (
              <li key={r.value}>
                <button
                  type="button"
                  onClick={() => onFilter(dim, r.value)}
                  title={t("analytics.rowFilterHint", "Show only these visitors")}
                  className="group relative flex min-h-10 w-full items-center gap-3 rounded-md px-2.5 text-left max-sm:min-h-11"
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-1 left-0 rounded-md bg-foreground/[0.06] transition-colors group-hover:bg-foreground/[0.1]"
                    style={{ width: `${Math.max(2, (r.visitors / max) * 100)}%` }}
                  />
                  <span className="relative min-w-0 flex-1 truncate text-[14px] text-foreground group-hover:underline group-hover:underline-offset-4">
                    <Value dim={dim} value={r.value} />
                  </span>
                  <span className="num relative text-[14px] font-semibold text-foreground">{formatNumber(r.visitors)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {rows.length > 0 ? (
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          className="flex min-h-11 items-center justify-center gap-1.5 border-t border-border text-[13px] font-semibold text-foreground hover:bg-muted/40"
        >
          {t("analytics.details", "Details")}
          <ArrowRight className="size-3.5" aria-hidden />
        </button>
      ) : null}
      {detailsOpen ? (
        <DetailsSheet
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          title={`${title} · ${tab.dims.length > 1 ? dimensionLabel(dim, t) : tab.label}`}
          dim={dim}
          params={params}
          scope={scope}
          onFilter={(d, v) => {
            setDetailsOpen(false);
            onFilter(d, v);
          }}
        />
      ) : null}
    </Panel>
  );
}

const PAGE_SIZE = 25;

function DetailsSheet({
  open,
  onOpenChange,
  title,
  dim,
  params,
  scope,
  onFilter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  dim: RowDim;
  params: StatsParams;
  scope: StatsScope;
  onFilter: (dim: RowDim, value: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typed, setTyped] = useState("");
  const opts = { limit: PAGE_SIZE, page, search };
  const { data, isFetching } = useQuery({
    queryKey: statsKeys.breakdown(scope, params, dim, opts),
    queryFn: () => getStatsBreakdown(scope, params, dim, opts),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const sessionCols = dim !== "page";
  const rows: BreakdownRow[] = data?.rows ?? [];
  const first = (page - 1) * PAGE_SIZE + 1;

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} className="sm:max-w-3xl">
      <div className="flex flex-col gap-3">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setSearch(typed.trim());
          }}
          className="flex items-center gap-2"
        >
          <label className="flex min-h-10 flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3">
            <Search className="size-4 text-muted-foreground" aria-hidden />
            <span className="sr-only">{t("analytics.search", "Search")}</span>
            <input
              type="search"
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t("analytics.searchPlaceholder", "Search…")}
              className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none max-sm:text-[16px]"
            />
          </label>
          <button type="submit" className="h-10 rounded-lg bg-foreground px-3.5 text-[13.5px] font-semibold text-background">
            {t("analytics.search", "Search")}
          </button>
        </form>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-3 py-2 text-left font-semibold">{dimensionLabel(dim, t)}</th>
                <th className="px-2 py-2 text-right font-semibold">{t("analytics.metric.visitors", "People")}</th>
                <th className="px-2 py-2 text-right font-semibold">{t("analytics.metric.visits", "Visits")}</th>
                {sessionCols ? (
                  <>
                    <th className="px-2 py-2 text-right font-semibold">{t("analytics.metric.bounceRate", "Left after one page")}</th>
                    <th className="px-3 py-2 text-right font-semibold">{t("analytics.metric.visitDuration", "Time per visit")}</th>
                  </>
                ) : (
                  <th className="px-3 py-2 text-right font-semibold">{t("analytics.metric.pageviews", "Pages viewed")}</th>
                )}
              </tr>
            </thead>
            <tbody className={cn(isFetching && "opacity-60")}>
              {rows.map((r) => (
                <tr key={r.value} className="border-t border-border/70">
                  <td className="max-w-[260px] px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onFilter(dim, r.value)}
                      title={t("analytics.rowFilterHint", "Show only these visitors")}
                      className="block max-w-full truncate text-left font-medium text-foreground hover:underline hover:underline-offset-4"
                    >
                      <Value dim={dim} value={r.value} />
                    </button>
                  </td>
                  <td className="num px-2 py-2.5 text-right font-semibold">{formatNumber(r.visitors)}</td>
                  <td className="num px-2 py-2.5 text-right">{formatNumber(r.visits)}</td>
                  {sessionCols ? (
                    <>
                      <td className="num px-2 py-2.5 text-right">{r.bounce_rate ?? 0}%</td>
                      <td className="num px-3 py-2.5 text-right">{secondsToWords(r.visit_duration ?? 0, i18n.language)}</td>
                    </>
                  ) : (
                    <td className="num px-3 py-2.5 text-right">{formatNumber(r.pageviews)}</td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && !isFetching ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    {search ? t("analytics.searchEmpty", "Nothing matches “{{q}}”.", { q: search }) : t("analytics.listEmpty", "Nothing in this period yet.")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12.5px] text-muted-foreground">
            {rows.length > 0
              ? t("analytics.showingRows", "Showing {{from}}–{{to}}", { from: first, to: first + rows.length - 1 })
              : ""}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-10 rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium text-foreground disabled:opacity-40"
            >
              {t("analytics.earlierRows", "Earlier")}
            </button>
            <button
              type="button"
              disabled={!data?.has_more}
              onClick={() => setPage((p) => p + 1)}
              className="h-10 rounded-lg bg-foreground px-3.5 text-[13px] font-semibold text-background disabled:opacity-40"
            >
              {t("analytics.moreRows", "More")}
            </button>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
