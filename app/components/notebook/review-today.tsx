import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { getReviewCandidates, reviewCandidatesKey } from "~/lib/api/google-reviews";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { useReviewAsk, useReviewStatus } from "~/components/notebook/review-ask";
import { cn } from "~/lib/utils";

const VISIBLE_ROWS = 6;

/**
 * Today → "Ask for a review" (GOOGLE_REVIEWS_PLAN.md, pilot). Customers whose
 * job just finished and who were never asked. Shows nothing when the list is
 * empty. The marker only for jobs finished in the last 3 days.
 */
export function ReviewsToAsk() {
  const { t, i18n } = useTranslation();
  const { canAsk } = useReviewStatus();
  const reviewAsk = useReviewAsk();
  const workspaceId = getStoredWorkspaceId();
  const { data } = useQuery({
    queryKey: reviewCandidatesKey(workspaceId),
    queryFn: getReviewCandidates,
    enabled: canAsk && !!workspaceId,
    staleTime: 30_000,
  });
  if (!canAsk || !data || data.total === 0) return null;
  const anyFresh = data.items.some((c) => c.fresh);

  return (
    <Panel>
      <PanelHeader title={t("reviews.todayTitle")} count={data.total} marker={anyFresh} />
      <p className="px-4 pb-1 text-[13px] text-muted-foreground sm:px-5">{t("reviews.todaySub")}</p>
      <ul className="divide-y divide-border">
        {data.items.slice(0, VISIBLE_ROWS).map((c) => (
          <li key={c.contact_id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium text-foreground">
                {c.name || t("reviews.thisCustomer", "this customer")}
              </p>
              <p className="truncate text-[12.5px] text-muted-foreground">
                {[
                  c.deal_title,
                  t("reviews.finishedOn", {
                    date: new Date(c.done_at).toLocaleDateString(i18n.language, { day: "numeric", month: "short" }),
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => reviewAsk.ask(c)}
              className={cn(
                "press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3.5 text-[13.5px] font-medium transition-colors",
                c.fresh
                  ? "border-foreground bg-foreground text-background hover:bg-foreground/90"
                  : "border-border bg-card text-foreground hover:border-foreground/30",
              )}
            >
              <Star className="size-4" aria-hidden />
              {t("reviews.ask")}
            </button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
