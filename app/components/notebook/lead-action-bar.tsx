import { useTranslation } from "react-i18next";
import { Briefcase, MessageSquareText } from "lucide-react";
import { Button } from "~/components/ui/button";
import { ContactActions } from "~/components/notebook/contact-actions";
import { OutcomeBadge, useLeadFlow } from "~/components/notebook/lead-flow";
import { personNameOr } from "~/lib/contacts/display-name";
import type { Lead } from "~/lib/api/leads";
import { waitingFor } from "~/lib/leads/source-label";

/**
 * The top of every lead view — sheet and full page alike (NOTEBOOK_UX_PLAN.md
 * D19): reach them, say how it went, make it a deal.
 */
export function LeadActionBar({ lead, className }: { lead: Lead; className?: string }) {
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
        emailInApp={flow.emailInApp}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => flow.recordOutcome(fl)} className="gap-1.5">
          <MessageSquareText className="size-3.5" />
          {t("leadBar.howDidItGo", "How did it go?")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => flow.makeDeal(fl)} className="gap-1.5">
          <Briefcase className="size-3.5" />
          {t("makeDeal.cta", "Make a deal")}
        </Button>
        {state ? (
          <OutcomeBadge outcome={state.outcome} attempts={state.attempts} />
        ) : (
          <span className="text-[12px] text-muted-foreground">
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
