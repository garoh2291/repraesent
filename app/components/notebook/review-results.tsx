import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Star } from "lucide-react";
import { getReviewSummary, reviewSummaryKey } from "~/lib/api/google-reviews";
import { getStoredWorkspaceId } from "~/lib/api/axios-instance";
import { formatNumber } from "~/lib/utils/format";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { useReviewStatus } from "~/components/notebook/review-ask";

/**
 * Results → Google reviews (GOOGLE_REVIEWS_PLAN.md, pilot). The rating, the
 * count, the change this month and how many customers were asked. Never who
 * wrote a review — Google does not say. Hidden until there is a number.
 */
export function ReviewResultsCard() {
  const { t, i18n } = useTranslation();
  const { on, canAsk, status } = useReviewStatus();
  const workspaceId = getStoredWorkspaceId();
  const { data } = useQuery({
    queryKey: reviewSummaryKey(workspaceId),
    queryFn: getReviewSummary,
    enabled: canAsk && !!workspaceId,
    staleTime: 10 * 60_000,
  });
  if (!on) return null;

  const link =
    "inline-flex items-center gap-1 text-[13px] font-medium text-foreground underline decoration-foreground/30 underline-offset-4";

  // No Google listing yet: one line to connect it, nothing else.
  if (!status?.place_id) {
    return (
      <Panel>
        <PanelHeader title={t("reviews.resultsTitle")} />
        <div className="space-y-2 px-4 py-4 sm:px-5">
          <p className="text-[14px] text-muted-foreground">{t("reviews.resultsNoListing")}</p>
          <Link to="/settings/business-profile#google-reviews" className={link}>
            {t("reviews.findTitle")}
          </Link>
        </div>
      </Panel>
    );
  }
  if (!data || data.total == null) return null;

  const since = data.since
    ? new Date(`${data.since}T12:00:00`).toLocaleDateString(i18n.language, { day: "numeric", month: "short" })
    : null;

  return (
    <Panel>
      <PanelHeader title={t("reviews.resultsTitle")} />
      <div className="space-y-1.5 px-4 py-4 sm:px-5">
        <p className="title-display flex flex-wrap items-baseline gap-x-2 text-[18px] font-medium leading-snug text-foreground sm:text-[20px]">
          {data.rating != null ? (
            <span className="inline-flex items-center gap-1">
              <Star className="size-[18px] fill-secondary text-secondary" aria-hidden />
              {data.rating.toFixed(1)}
            </span>
          ) : null}
          <span>
            {t("reviews.resultsCount", { count: data.total, formattedCount: formatNumber(data.total) })}
          </span>
        </p>
        {data.new_since != null && since ? (
          <p className="text-[13.5px] text-foreground">
            {data.new_since > 0
              ? t("reviews.resultsNewSince", { count: data.new_since, date: since })
              : t("reviews.resultsNoneSince", { date: since })}
          </p>
        ) : null}
        <p className="text-[13.5px] text-muted-foreground">
          {data.asked_this_month > 0
            ? t("reviews.resultsAsked", { count: data.asked_this_month })
            : t("reviews.resultsAskedNone")}
        </p>
      </div>
    </Panel>
  );
}
