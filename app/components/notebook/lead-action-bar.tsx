import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { Briefcase, MessageSquareText, MoreHorizontal } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/utils";
import { ContactActions } from "~/components/notebook/contact-actions";
import { OutcomeBadge, useLeadFlow } from "~/components/notebook/lead-flow";
import { personNameOr } from "~/lib/contacts/display-name";
import type { Lead } from "~/lib/api/leads";
import { waitingFor } from "~/lib/leads/source-label";

/**
 * The top of every lead view — sheet and full page alike (NOTEBOOK_UX_PLAN.md
 * D19): reach them, say how it went, make it a deal.
 */
export function LeadActionBar({
  lead,
  className,
  phoneMenu,
}: {
  lead: Lead;
  className?: string;
  /**
   * Phones only: rarer actions (menu items) behind a ⋯ button at the end of
   * the next-actions row. Desktop shows them where the page puts them.
   */
  phoneMenu?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const flow = useLeadFlow();
  const name = personNameOr(lead, "");
  const fl = { id: lead.id, name, status: lead.status, phone: lead.phone, email: lead.email };
  const state = lead.contact_state ?? null;

  let firstContact: string | null = null;
  if (state?.first_contacted_at) {
    const ms = new Date(state.first_contacted_at).getTime() - new Date(lead.created_at).getTime();
    firstContact = t("leadBar.firstContact", "First contact {{time}} after it came in", {
      time: waitingFor(new Date(Date.now() - Math.max(ms, 60_000)).toISOString(), i18n.language),
    });
  }

  return (
    <div className={className}>
      <ContactActions
        target={{ phone: lead.phone, email: lead.email }}
        onContact={(ch) => flow.contact(fl, ch)}
        showEmpty
        even
        emailInApp={flow.emailInApp}
      />
      {/* Phones: one even row of 44px buttons (+ the ⋯), the outcome below. */}
      <div
        className={cn(
          "mt-3 flex flex-wrap items-center gap-2 max-sm:mt-2 max-sm:grid",
          phoneMenu ? "max-sm:grid-cols-[1fr_1fr_auto]" : "max-sm:grid-cols-2",
        )}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => flow.recordOutcome(fl)}
          className="gap-1.5 max-sm:h-11 max-sm:min-w-0 max-sm:px-2 max-sm:text-sm"
        >
          <MessageSquareText className="size-3.5 max-sm:size-4" />
          <span className="truncate">{t("leadBar.howDidItGo", "How did it go?")}</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => flow.makeDeal(fl)}
          className="gap-1.5 max-sm:h-11 max-sm:min-w-0 max-sm:px-2 max-sm:text-sm"
        >
          <Briefcase className="size-3.5 max-sm:size-4" />
          <span className="truncate">{t("makeDeal.cta", "Make a deal")}</span>
        </Button>
        {phoneMenu ? (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-11 sm:hidden"
                aria-label={t("mobile.more", "More")}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              {phoneMenu}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        {state ? (
          <OutcomeBadge
            outcome={state.outcome}
            attempts={state.attempts}
            className="max-sm:col-span-full max-sm:justify-self-start"
          />
        ) : (
          <span className="text-[12px] text-muted-foreground max-sm:col-span-full max-sm:text-[13px]">
            {t("leadBar.notContacted", "Not contacted yet")}
          </span>
        )}
      </div>
      {firstContact ? (
        <p className="mt-2 text-[12px] text-muted-foreground">{firstContact}</p>
      ) : null}
    </div>
  );
}
