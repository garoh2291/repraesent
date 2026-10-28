import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "~/lib/utils";
import { formatNumber } from "~/lib/utils/format";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { Skeleton } from "~/components/ui/skeleton";
import {
  getStatsGoalProps,
  getStatsGoals,
  statsKeys,
  type StatsParams,
  type StatsScope,
} from "~/lib/api/website-stats";

/** Plain names for the events the Plausible script sends by itself. */
function goalName(goal: string, t: (k: string, f: string) => string): string {
  if (goal === "Outbound Link: Click") return t("analytics.goal.outbound", "Clicked a link to another site");
  if (goal === "File Download") return t("analytics.goal.download", "Downloaded a file");
  if (goal === "404") return t("analytics.goal.notFound", "Opened a page that doesn't exist");
  return goal;
}

function Props({ goal, params, scope }: { goal: string; params: StatsParams; scope: StatsScope }) {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: statsKeys.goalProps(scope, params, goal),
    queryFn: () => getStatsGoalProps(scope, params, goal),
    staleTime: 60_000,
  });
  if (isLoading) return <Skeleton className="m-3 h-16" />;
  const rows = data?.rows ?? [];
  if (rows.length === 0) {
    return <p className="px-4 py-3 text-[13px] text-muted-foreground">{t("analytics.noProps", "No extra details were sent with this goal.")}</p>;
  }
  return (
    <ul className="divide-y divide-border/60 px-4 pb-2">
      {rows.map((r) => (
        <li key={`${r.key}:${r.value}`} className="flex items-center gap-3 py-2 text-[13px]">
          <span className="shrink-0 rounded border border-border px-1.5 text-[11px] font-semibold text-muted-foreground">{r.key}</span>
          <span className="min-w-0 flex-1 truncate text-foreground" title={r.value}>
            {r.value}
          </span>
          <span className="num font-semibold">{formatNumber(r.visitors)}</span>
        </li>
      ))}
    </ul>
  );
}

export function GoalsPanel({
  params,
  scope,
  enabled,
  onFilter,
}: {
  params: StatsParams;
  scope: StatsScope;
  enabled: boolean;
  onFilter: (goal: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: statsKeys.goals(scope, params),
    queryFn: () => getStatsGoals(scope, params),
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const rows = data?.rows ?? [];

  return (
    <Panel>
      <PanelHeader
        title={t("analytics.goalsTitle", "Goals — things people did on your site")}
        hint={t("analytics.goalsHint", "Open a goal to see its details")}
      />
      {isLoading ? (
        <Skeleton className="m-4 h-20" />
      ) : rows.length === 0 ? (
        <p className="px-4 py-5 text-[14px] text-muted-foreground sm:px-5">
          {t("analytics.goalsEmpty", "No goals in this period. Clicks on links to other sites, file downloads and your own events show up here.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-[14px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2 text-left font-semibold sm:px-5">{t("analytics.dim.goal", "Goal")}</th>
                <th className="px-3 py-2 text-right font-semibold">{t("analytics.metric.visitors", "People")}</th>
                <th className="px-3 py-2 text-right font-semibold">{t("analytics.goalTimes", "Times")}</th>
                <th className="px-3 py-2 text-right font-semibold">{t("analytics.goalRate", "Of all people")}</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <GoalRow
                  key={r.goal}
                  name={goalName(r.goal, t)}
                  open={open === r.goal}
                  onToggle={() => setOpen(open === r.goal ? null : r.goal)}
                  onFilter={() => onFilter(r.goal)}
                  visitors={r.visitors}
                  events={r.events}
                  rate={r.conversion_rate}
                >
                  <Props goal={r.goal} params={params} scope={scope} />
                </GoalRow>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function GoalRow({
  name,
  open,
  onToggle,
  onFilter,
  visitors,
  events,
  rate,
  children,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  onFilter: () => void;
  visitors: number;
  events: number;
  rate: number;
  children: React.ReactNode;
}) {
  const { t, i18n } = useTranslation();
  return (
    <>
      <tr className="border-t border-border/70">
        <td className="px-4 py-1 sm:px-5">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex min-h-10 items-center gap-2 text-left font-semibold text-foreground"
          >
            <ChevronDown className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
            {name}
          </button>
        </td>
        <td className="num px-3 text-right">{formatNumber(visitors)}</td>
        <td className="num px-3 text-right">{formatNumber(events)}</td>
        <td className="num px-3 text-right font-semibold">
          {rate.toLocaleString(i18n.language, { maximumFractionDigits: 1 })}%
        </td>
        <td className="px-2 text-right">
          <button
            type="button"
            onClick={onFilter}
            aria-label={t("analytics.goalFilter", "Show only people who did this")}
            title={t("analytics.goalFilter", "Show only people who did this")}
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Filter className="size-4" aria-hidden />
          </button>
        </td>
      </tr>
      {open ? (
        <tr>
          <td colSpan={5} className="bg-muted/30">
            {children}
          </td>
        </tr>
      ) : null}
    </>
  );
}
