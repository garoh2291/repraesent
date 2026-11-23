import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { AtSign, Check, ChevronRight, Globe, Handshake, Mail, MoreHorizontal } from "lucide-react";
import { cn } from "~/lib/utils";
import type { SetupReport, SetupReportItem } from "~/lib/api/support-tickets";

const ICON: Record<SetupReportItem["kind"], typeof Globe> = {
  website: Globe,
  email: Mail,
  domain: AtSign,
  other: MoreHorizontal,
};

/**
 * The checklist under a set-up report: what the agency asked re:praesent to
 * set up for a new business, one row per item with where it stands. On
 * re:praesent's side it also links the deal this report moves (done → won).
 * Plain card on paper; done items get the ink tick, open ones say so in
 * words — no marker here, the report's own status says who's waiting.
 */
export function SetupReportCard({ setup, side, className }: { setup: SetupReport; side: "client" | "team"; className?: string }) {
  const { t } = useTranslation();
  const itemTitle = (i: SetupReportItem) => {
    switch (i.kind) {
      case "website":
        return i.label ? t("setupReport.item.websiteExisting", "Website: {{url}}", { url: i.label }) : t("setupReport.item.websiteNew", "A new website");
      case "email":
        return i.label ? t("setupReport.item.emailBoxes", "Email: {{boxes}}", { boxes: i.label }) : t("setupReport.item.email", "Email mailboxes");
      case "domain":
        return i.label ? t("setupReport.item.domainName", "Domain: {{name}}", { name: i.label }) : t("setupReport.item.domain", "A domain");
      default:
        return i.label ?? t("setupReport.item.other", "Something else");
    }
  };
  const done = setup.items.filter((i) => i.status === "done").length;

  return (
    <section aria-label={t("setupReport.title", "What was asked")} className={cn("overflow-hidden rounded-xl border border-border bg-card", className)}>
      <div className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2.5">
        <p className="min-w-0 truncate text-[13px] font-medium text-muted-foreground">
          {t("setupReport.titleFor", "Set-up for {{business}}", { business: setup.business.name })}
        </p>
        {setup.items.length ? (
          <span className="num shrink-0 text-[12px] text-muted-foreground">
            {t("setupReport.progress", "{{done}} of {{total}} done", { done, total: setup.items.length })}
          </span>
        ) : null}
      </div>

      {setup.items.length ? (
        <ul className="divide-y divide-border">
          {setup.items.map((i) => {
            const Icon = ICON[i.kind];
            const isDone = i.status === "done";
            return (
              <li key={i.id} className="flex min-h-12 items-start gap-3 px-4 py-2.5">
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className={cn("break-words text-[14px] text-foreground", isDone && "text-muted-foreground line-through decoration-foreground/30")}>
                    {itemTitle(i)}
                  </p>
                  {i.note ? <p className="mt-0.5 whitespace-pre-line break-words text-[13px] text-muted-foreground">{i.note}</p> : null}
                </div>
                {isDone ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-foreground">
                    <Check className="size-3.5" aria-hidden />
                    {t("setupReport.done", "Done")}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[12px] text-muted-foreground">
                    {t("setupReport.toDo", "To do")}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-4 py-3 text-[14px] text-muted-foreground">
          {t("setupReport.nothing", "Nothing extra asked: the business and its team are in.")}
        </p>
      )}

      {side === "team" && setup.website_unlinked ? (
        <p className="border-t border-border px-4 py-2.5 text-[13px] text-muted-foreground">
          {t("setupReport.websiteUnlinked", "The website isn't linked yet. It closes by itself once you link it in the admin.")}
        </p>
      ) : null}

      {side === "team" && setup.deal ? (
        <Link
          to={`/pipeline/${setup.deal.id}`}
          className="press flex min-h-12 touch-manipulation select-none items-center gap-2.5 border-t border-border px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none"
        >
          <Handshake className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{setup.deal.title}</span>
          <span className="shrink-0 text-[12px] text-muted-foreground">
            {setup.deal.status === "won"
              ? t("setupReport.dealWon", "New customer")
              : setup.deal.status === "lost"
                ? t("setupReport.dealLost", "Didn't happen")
                : t("setupReport.dealOpen", "Deal open")}
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
        </Link>
      ) : null}
    </section>
  );
}

/** "Set-up" chip on list rows (queue and Help list). */
export function SetupChip({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <span className={cn("inline-flex shrink-0 items-center rounded-full border border-foreground/20 px-1.5 py-px text-[11px] font-semibold uppercase tracking-[0.04em] text-foreground/80", className)}>
      {t("setupReport.chip", "Set-up")}
    </span>
  );
}
