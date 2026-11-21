import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { ChevronRight, LifeBuoy } from "lucide-react";
import { listDealTickets } from "~/lib/api/support-tickets";
import { SetupChip } from "~/components/support/setup-report-card";
import { StatusPill, TicketStub } from "~/components/support/ticket-bits";

/**
 * Root workspace only: the support reports that belong to this deal — the
 * set-up report an agency's new business brings with it. The report moves
 * the deal (done → won), so the two sit side by side. Hidden when the deal
 * has none.
 */
export function DealSupportCard({ dealId }: { dealId: string }) {
  const { t } = useTranslation();
  const q = useQuery({
    queryKey: ["root-deal-support", dealId],
    queryFn: () => listDealTickets(dealId),
    staleTime: 30_000,
    retry: false,
  });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  return (
    <section aria-label={t("dealSupport.title", "Support reports")} className="overflow-hidden rounded-xl border border-border bg-card">
      <p className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
        <LifeBuoy className="size-4" aria-hidden />
        {t("dealSupport.title", "Support reports")}
      </p>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id}>
            <Link
              to={`/support/${r.id}`}
              className="press flex min-h-12 touch-manipulation select-none items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/50 focus-visible:outline-none"
            >
              <TicketStub number={r.number} />
              {r.kind === "setup" ? <SetupChip /> : null}
              <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{r.title}</span>
              <StatusPill status={r.status} side="team" className="h-5 shrink-0 px-2 text-[11px]" />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
        {t("dealSupport.hint", "Marking the set-up report done moves this deal to won.")}
      </p>
    </section>
  );
}
