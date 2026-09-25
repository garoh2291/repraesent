import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { getDeals } from "~/lib/api/deals";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { formatCurrencyTotals, sumByCurrency } from "~/lib/utils/format";
import { useWorkspaceCurrency } from "~/lib/hooks/useWorkspaceCurrency";
import { cn } from "~/lib/utils";

/**
 * The board in one plain line (NOTEBOOK_UX_PLAN.md §5): what is open and
 * worth, how many have no next step, and who became a customer this month.
 */
export function PipelineSummaryStrip({ pipelineId }: { pipelineId?: string }) {
  const { t } = useTranslation();
  const workspaceId = getStoredWorkspaceId();
  const { currency } = useWorkspaceCurrency();
  const q = useQuery({
    queryKey: ["deals", "summary-strip", workspaceId, pipelineId ?? null],
    queryFn: () => getDeals({ page: 1, limit: 500, pipeline_id: pipelineId }),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
  const deals = q.data?.data ?? [];
  if (!q.data) return null;

  const open = deals.filter((d) => !d.won_at && !d.lost_at && d.status !== "won" && d.status !== "lost");
  const noNext = open.filter((d) => d.tasks_summary && d.tasks_summary.open_count === 0).length;
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const wonThisMonth = deals.filter((d) => d.won_at && new Date(d.won_at) >= monthStart);
  const openValue = formatCurrencyTotals(
    sumByCurrency(open, (d) => ({ value: d.value, currency: d.currency })),
    currency,
  );
  const wonValue = formatCurrencyTotals(
    sumByCurrency(wonThisMonth, (d) => ({ value: d.value, currency: d.currency })),
    currency,
  );

  const item = "flex items-baseline gap-1.5 whitespace-nowrap";
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-border bg-card px-4 py-3 text-[13.5px] shadow-xs">
      <span className={item}>
        <span className="title-display num text-[18px] font-semibold text-foreground">
          {q.data.hasNext ? `${open.length}+` : open.length}
        </span>
        <span className="text-muted-foreground">{t("pipelineStrip.open", "open")}</span>
        {openValue ? <span className="num font-medium text-foreground">· {openValue}</span> : null}
      </span>
      <span className={item}>
        <span className={cn("title-display num text-[18px] font-semibold", noNext > 0 ? "marker text-foreground" : "text-foreground")}>
          {noNext}
        </span>
        <span className="text-muted-foreground">{t("pipelineStrip.noNext", "without a next step")}</span>
      </span>
      <span className={item}>
        <span className="title-display num text-[18px] font-semibold text-earned">{wonThisMonth.length}</span>
        <span className="text-muted-foreground">{t("pipelineStrip.won", "new customers this month")}</span>
        {wonValue && wonThisMonth.length ? <span className="num font-medium text-earned">· {wonValue}</span> : null}
      </span>
    </div>
  );
}
