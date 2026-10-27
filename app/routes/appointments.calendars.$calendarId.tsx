import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useTabBarHeight } from "~/components/notebook/deal-action-bar";
import { usePilotFeatures } from "~/lib/feature-flags";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  appointmentKeys,
  deleteAppointmentCalendar,
  getCalendarClosures,
  makeDefaultAppointmentCalendar,
  saveCalendarClosures,
  setAppointmentCalendarEnabled,
  updateAppointmentCalendar,
  type AppointmentCalendar,
  type Closure,
} from "~/lib/api/appointment-book";
import { useAppointmentCalendars, useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel } from "~/components/notebook/panel";
import { PageSkeleton } from "~/components/notebook/page-skeleton";
import { LoadError } from "~/components/notebook/load-error";
import { Button } from "~/components/ui/button";
import { CalendarForm, draftOf, type CalendarDraft } from "~/components/appointment-book/calendar-form";
import { CalendarWorkflowsPanel } from "~/components/appointment-book/calendar-workflows-panel";
import { cn } from "~/lib/utils";
import { useAppointmentBookGate } from "~/components/appointment-book/use-appointment-book-gate";

export function meta() {
  return [{ title: `${i18n.t("appointmentBook.settings.metaTitle", "Calendar settings")} - Repraesent` }];
}

export default function CalendarSettingsPage() {
  const allowed = useAppointmentBookGate();
  const { calendarId = "" } = useParams();
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "appointmentBook.settings.metaTitle", titleSuffix: " - Repraesent" });
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthContext();
  const pilot = usePilotFeatures();
  const invalidate = useInvalidateAppointments();
  const calendars = useAppointmentCalendars(allowed);
  const calendar = calendars.data?.find((c) => c.id === calendarId) ?? null;
  const closuresQuery = useQuery({
    queryKey: appointmentKeys.closures(currentWorkspace?.id, calendarId),
    queryFn: () => getCalendarClosures(calendarId),
    enabled: allowed && !!calendar,
  });

  const tabBar = useTabBarHeight();
  const [draft, setDraft] = useState<CalendarDraft | null>(null);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [deleteArmed, setDeleteArmed] = useState(false);
  useEffect(() => {
    if (calendar && !draft) setDraft(draftOf(calendar));
  }, [calendar, draft]);
  useEffect(() => {
    if (closuresQuery.data) setClosures(closuresQuery.data);
  }, [closuresQuery.data]);

  const dirty = useMemo(() => {
    if (!calendar || !draft) return false;
    return (
      JSON.stringify(comparable(draftOf(calendar))) !== JSON.stringify(comparable(draft)) ||
      JSON.stringify(closuresQuery.data ?? []) !== JSON.stringify(closures)
    );
  }, [calendar, draft, closures, closuresQuery.data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      await updateAppointmentCalendar(calendarId, draft);
      if (JSON.stringify(closuresQuery.data ?? []) !== JSON.stringify(closures)) {
        await saveCalendarClosures(calendarId, closures);
      }
    },
    onSuccess: async () => {
      invalidate();
      // Straight to the saved values — no skeleton flash in between.
      const fresh = (await calendars.refetch()).data?.find((c) => c.id === calendarId);
      if (fresh) setDraft(draftOf(fresh));
      const savedClosures = (await closuresQuery.refetch()).data;
      if (savedClosures) setClosures(savedClosures);
      toast.success(t("appointmentBook.settings.saved", "Changes saved"));
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (enabled: boolean) => setAppointmentCalendarEnabled(calendarId, enabled),
    onSuccess: (c) => {
      invalidate();
      toast.success(c.status === "active" ? t("appointmentBook.settings.turnedOn", "Calendar is on") : t("appointmentBook.settings.turnedOff", "Calendar is off — no new bookings"));
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  const makeDefault = useMutation({
    mutationFn: () => makeDefaultAppointmentCalendar(calendarId),
    onSuccess: () => {
      invalidate();
      toast.success(t("appointmentBook.settings.nowFallback", "Now used when nothing else is picked"));
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => deleteAppointmentCalendar(calendarId),
    onSuccess: () => {
      invalidate();
      toast.success(t("appointmentBook.settings.deleted", "Calendar deleted"));
      navigate("/appointments/calendars", { replace: true });
    },
    onError: (e) => {
      setDeleteArmed(false);
      toast.error(extractErrorMessage(e));
    },
  });
  if (!allowed) return null;
  if (calendars.isLoading || (calendar && !draft)) return <PageSkeleton />;
  if (!calendar || !draft) {
    return (
      <PageContainer>
        <LoadError what={t("appointmentBook.calendars.what", "your calendars")} onRetry={() => void calendars.refetch()} />
      </PageContainer>
    );
  }
  const off = calendar.status === "disabled";

  return (
    <PageContainer className="app-fade-in space-y-5 pb-24">
      <Link
        to="/appointments/calendars"
        className="press -ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[14px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("appointmentBook.calendars.title", "Your calendars")}
      </Link>
      <PageHeader
        title={calendar.name}
        subtitle={
          off
            ? t("appointmentBook.settings.offBanner", "Turned off: it offers no times, and forms or the chat that use it say so. Appointments already in it stay.")
            : t("appointmentBook.settings.subtitle", "The rules for this calendar. Forms, the chat and your team all follow them.")
        }
      />

      <HowBookingWorks calendar={calendar} />

      <CalendarForm
        calendarId={calendar.id}
        draft={draft}
        onChange={setDraft}
        closures={closures}
        onClosuresChange={setClosures}
        otherCalendars={calendars.data ?? []}
        afterMessages={
          pilot.workflows ? (
            <CalendarWorkflowsPanel
              calendarId={calendar.id}
              calendarName={calendar.name}
              builtInReminderOn={draft.customer_messages.reminder.enabled}
            />
          ) : null
        }
      />

      <Panel className="space-y-3 px-4 py-5 sm:px-6">
        <h2 className="text-[16px] font-semibold text-foreground">{t("appointmentBook.settings.manage", "This calendar")}</h2>
        {calendar.is_default ? (
          <p className="text-[13px] text-muted-foreground">
            {t("appointmentBook.settings.isFallback", "Used when nothing else is picked — new appointments start here.")}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="max-sm:h-11" disabled={toggle.isPending} onClick={() => toggle.mutate(off)}>
            {off ? t("appointmentBook.settings.turnOn", "Turn on") : t("appointmentBook.settings.turnOff", "Turn off")}
          </Button>
          {!calendar.is_default ? (
            <Button variant="outline" className="max-sm:h-11" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate()}>
              {t("appointmentBook.settings.makeFallback", "Use when nothing else is picked")}
            </Button>
          ) : null}
          {calendar.appointment_count === 0 ? (
            <Button
              variant={deleteArmed ? "destructive" : "ghost"}
              className="max-sm:h-11"
              disabled={remove.isPending}
              onClick={() => (deleteArmed ? remove.mutate() : setDeleteArmed(true))}
            >
              {deleteArmed ? t("appointmentBook.settings.deleteConfirm", "Tap again to delete") : t("appointmentBook.settings.delete", "Delete calendar")}
            </Button>
          ) : null}
        </div>
        {calendar.appointment_count > 0 ? (
          <p className="text-[13px] text-muted-foreground">
            {t("appointmentBook.settings.cantDelete", "It has {{count}} appointments, so it can't be deleted — turn it off instead.", {
              count: calendar.appointment_count,
            })}
          </p>
        ) : null}
      </Panel>

      {/* Save bar: only when something changed. Above the phone tab bar. */}
      {dirty ? (
        <div
          className="sticky bottom-[calc(var(--tab-bar-h)+8px)] z-30 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur lg:bottom-4"
          style={{ "--tab-bar-h": tabBar == null ? "calc(4rem + env(safe-area-inset-bottom))" : `${tabBar}px` } as CSSProperties}
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto text-[13px] text-muted-foreground">{t("appointmentBook.settings.unsaved", "You have changes that aren't saved.")}</span>
            <Button
              variant="ghost"
              className="max-sm:h-11"
              onClick={() => {
                setDraft(draftOf(calendar));
                setClosures(closuresQuery.data ?? []);
              }}
            >
              {t("common.discard", "Discard")}
            </Button>
            <Button className="max-sm:h-11" disabled={save.isPending || !draft.name?.trim()} onClick={() => save.mutate()}>
              {save.isPending ? t("common.saving", "Saving…") : t("common.saveChanges", "Save changes")}
            </Button>
          </div>
        </div>
      ) : null}
    </PageContainer>
  );
}

/** The custom-text map, left out when it says nothing — `{}` and absent mean the same. */
function comparable(d: CalendarDraft): CalendarDraft {
  const copy = d.customer_messages?.copy;
  if (copy && Object.keys(copy).length > 0) return d;
  const { copy: _drop, ...rest } = d.customer_messages;
  return { ...d, customer_messages: rest };
}

/**
 * The whole idea in three steps, each with its state where it is cheap to
 * know. The marker only lands on the step that needs the owner.
 */
function HowBookingWorks({ calendar }: { calendar: AppointmentCalendar }) {
  const { t } = useTranslation();
  const hasHours = Object.values(calendar.weekly_hours ?? {}).some((r) => (r ?? []).length > 0);
  const booked = calendar.appointment_count > 0;
  const steps: Array<{ n: number; title: string; hint: string; state: "done" | "needs" | "open"; to?: string; cta?: string }> = [
    {
      n: 1,
      title: t("appointmentBook.how.step1", "Set your hours"),
      hint: hasHours
        ? t("appointmentBook.how.step1Done", "Done — change them below whenever you like.")
        : t("appointmentBook.how.step1Needs", "No open days yet, so nobody can book. Add them below."),
      state: hasHours ? "done" : "needs",
    },
    {
      n: 2,
      title: t("appointmentBook.how.step2", "Add it to a form or your chat"),
      hint: t("appointmentBook.how.step2Hint", "Put an appointment field in a form, or a booking action in your chat, and pick “{{name}}”.", {
        name: calendar.name,
      }),
      state: "open",
      to: "/forms",
      cta: t("appointmentBook.how.step2Cta", "Go to your forms"),
    },
    {
      n: 3,
      title: t("appointmentBook.how.step3", "People book — you get an inquiry"),
      hint: booked
        ? t("appointmentBook.how.step3Done", "{{count}} booked so far.", { count: calendar.appointment_count })
        : t("appointmentBook.how.step3Waiting", "Each booking lands in your appointments and as a new inquiry."),
      state: booked ? "done" : "open",
    },
  ];
  return (
    <Panel className="px-4 py-4 sm:px-5" aria-label={t("appointmentBook.how.title", "How booking works")}>
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {t("appointmentBook.how.title", "How booking works")}
      </h2>
      <ol className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        {steps.map((s) => (
          <li key={s.n} className="flex items-start gap-3">
            <span
              className={cn(
                "num mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold",
                s.state === "done" && "bg-foreground text-background",
                s.state === "needs" && "bg-secondary text-secondary-foreground",
                s.state === "open" && "border border-border text-foreground",
              )}
              aria-hidden
            >
              {s.state === "done" ? <Check className="size-3.5" /> : s.n}
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-medium text-foreground">
                {s.title}
                {s.state === "done" ? <span className="sr-only"> — {t("appointmentBook.how.done", "done")}</span> : null}
              </span>
              <span className="block text-[12.5px] leading-relaxed text-muted-foreground">{s.hint}</span>
              {s.to ? (
                <Link
                  to={s.to}
                  className="mt-0.5 inline-flex min-h-11 items-center gap-1 text-[13px] font-medium text-foreground underline underline-offset-4 hover:no-underline sm:min-h-0"
                >
                  {s.cta}
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
