import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, Network } from "lucide-react";
import { useAgencyRequestCount } from "~/lib/hooks/use-agency-request-count";

/**
 * Root admins on Today: businesses that asked to manage several businesses
 * (agency mode) and wait for a decision. Same look as the support line;
 * nothing when nobody waits.
 */
export function AgencyRequestsTodayCard() {
  const { t } = useTranslation();
  const n = useAgencyRequestCount();
  if (!n) return null;
  return (
    <Link
      to="/settings/agencies"
      className="press group flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marker">
        <Network className="size-[18px] text-foreground" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">
        {t("agency.root.todayRequests", { count: n })}
      </span>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
