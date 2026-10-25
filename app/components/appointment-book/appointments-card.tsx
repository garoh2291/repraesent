import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CalendarPlus } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { usePilotFeatures } from "~/lib/feature-flags";
import { appointmentKeys, getAppointmentsForDeal, listAppointments, type Appointment } from "~/lib/api/appointment-book";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { useQuickCreate } from "~/components/notebook/quick-create";
import { AppointmentRow } from "./appointment-bits";
import type { AppointmentPrefill } from "./appointment-dialog";
import { useAppointmentsToday } from "~/lib/hooks/useAppointmentBook";

/**
 * Visits of one customer, company, deal or inquiry: the next one first, the
 * rest below. "Book appointment" opens the dialog here, already filled in.
 * Renders nothing outside the `appointmentBook` pilot.
 */
export function AppointmentsCard({
  target,
  prefill,
  className,
}: {
  target: { dealId: string } | { contactId: string } | { leadId: string };
  prefill: AppointmentPrefill;
  className?: string;
}) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const pilot = usePilotFeatures();
  const quick = useQuickCreate();
  const [showAll, setShowAll] = useState(false);
  const key = "dealId" in target ? `deal:${target.dealId}` : "contactId" in target ? `contact:${target.contactId}` : `lead:${target.leadId}`;
  const q = useQuery({
    queryKey: [...appointmentKeys.all(currentWorkspace?.id), "entity", key],
    queryFn: (): Promise<Appointment[]> =>
      "dealId" in target
        ? getAppointmentsForDeal(target.dealId)
        : "contactId" in target
          ? listAppointments({ contact_id: target.contactId, limit: 100 })
          : listAppointments({ lead_id: target.leadId, limit: 100 }),
    enabled: pilot.appointmentBook && !!currentWorkspace?.id,
  });
  if (!pilot.appointmentBook) return null;

  const now = Date.now();
  const all = q.data ?? [];
  const upcoming = all
    .filter((a) => a.status === "scheduled" && Date.parse(a.ends_at) >= now)
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const rest = all
    .filter((a) => !upcoming.includes(a))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const shown = showAll ? rest : rest.slice(0, 3);

  return (
    <Panel className={className}>
      <PanelHeader
        title={t("appointmentBook.card.title", "Appointments")}
        count={all.length || null}
        action={
          <button
            type="button"
            onClick={() => quick.open("appointment", { appointment: prefill })}
            className="press inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-foreground hover:bg-muted max-sm:h-11"
          >
            <CalendarPlus className="size-4" aria-hidden />
            {t("appointmentBook.card.book", "Book")}
          </button>
        }
      />
      <div className="px-2 py-1 sm:px-3">
        {q.isLoading ? (
          <div className="m-2 h-12 animate-pulse rounded-lg bg-muted" />
        ) : all.length === 0 ? (
          <p className="px-2 py-3 text-[13.5px] text-muted-foreground">
            {t("appointmentBook.card.empty", "No appointments yet. Book the first visit with “Book”.")}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {upcoming.map((a) => (
              <AppointmentRow key={a.id} appointment={a} showDate hideDeal={"dealId" in target} className="py-1" />
            ))}
            {shown.map((a) => (
              <AppointmentRow key={a.id} appointment={a} showDate hideDeal={"dealId" in target} className="py-1 opacity-80" />
            ))}
            {rest.length > 3 && !showAll ? (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="w-full py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
              >
                {t("appointmentBook.card.showAll", "Show all {{count}}", { count: rest.length })}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * Today: who is coming today, and the visits still waiting for "did they
 * come?". Renders nothing when there is nothing — the Today screen only shows
 * what needs you.
 */
export function TodayAppointments() {
  const { t } = useTranslation();
  const pilot = usePilotFeatures();
  const q = useAppointmentsToday(pilot.appointmentBook);
  if (!pilot.appointmentBook || !q.data) return null;
  const { today, needs_outcome } = q.data;
  if (today.length === 0 && needs_outcome.length === 0) return null;
  return (
    <Panel className="app-fade-up">
      <PanelHeader
        title={t("appointmentBook.today.title", "Appointments today")}
        count={today.length}
        action={
          <Link to="/appointments" className="text-[13px] font-medium text-muted-foreground hover:text-foreground">
            {t("appointmentBook.today.all", "All")}
          </Link>
        }
      />
      <div className="divide-y divide-border px-2 py-1 sm:px-3">
        {needs_outcome.map((a) => (
          <AppointmentRow key={a.id} appointment={a} showDate className="py-1" />
        ))}
        {today
          .filter((a) => !needs_outcome.some((n) => n.id === a.id))
          .map((a) => (
            <AppointmentRow key={a.id} appointment={a} className="py-1" />
          ))}
        {today.length === 0 ? (
          <p className="px-2 py-3 text-[13.5px] text-muted-foreground">{t("appointmentBook.today.none", "Nobody is booked for today.")}</p>
        ) : null}
      </div>
    </Panel>
  );
}
