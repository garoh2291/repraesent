import { useTranslation } from "react-i18next";
import type { CampaignStatus } from "~/lib/api/email-campaigns";

const STYLES: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  sending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  paused: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  sent: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const DEFAULT_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  sending: "Sending",
  paused: "Paused",
  sent: "Sent",
  cancelled: "Cancelled",
};

export function CampaignStatusBadge({ status }: { status: CampaignStatus }) {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STYLES[status]}`}
    >
      {status === "sending" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {t(`emailCampaigns.status.${status}`, {
        defaultValue: DEFAULT_LABELS[status],
      })}
    </span>
  );
}
