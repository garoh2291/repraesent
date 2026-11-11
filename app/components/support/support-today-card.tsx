import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, LifeBuoy } from "lucide-react";
import { useSupportBadges } from "./use-support-badges";

/**
 * One line on Today when Help & changes needs you: open tickets for the root
 * team, reports waiting for the customer's reply for everyone else. Nothing
 * when nothing waits.
 */
export function SupportTodayCard() {
  const { t } = useTranslation();
  const b = useSupportBadges();
  const n = b.isRoot ? b.queueOpen : b.helpWaiting;
  if (!n) return null;
  const to = b.isRoot ? "/support" : "/help";
  const text = b.isRoot
    ? t("support.today", { count: n, defaultValue: n === 1 ? "1 support ticket needs a reply" : "{{count}} support tickets need a reply" })
    : t("help.today", { count: n, defaultValue: n === 1 ? "re:praesent needs your answer on 1 report" : "re:praesent needs your answer on {{count}} reports" });
  return (
    <Link
      to={to}
      className="press group flex min-h-14 items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/30"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-marker">
        <LifeBuoy className="size-[18px] text-foreground" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">{text}</span>
      <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
