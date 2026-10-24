import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Bell, Globe, Workflow } from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useTabBarHeight } from "~/components/notebook/deal-action-bar";
import { usePilotFeatures } from "~/lib/feature-flags";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { createWorkflow } from "~/lib/api/workflows";
import {
  appointmentKeys,
  deleteAppointmentCalendar,
  getCalendarClosures,
  makeDefaultAppointmentCalendar,
  saveCalendarClosures,
  setAppointmentCalendarEnabled,
  updateAppointmentCalendar,
  type Closure,
} from "~/lib/api/appointment-book";
import { useAppointmentCalendars, useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel } from "~/components/notebook/panel";
import { PageSkeleton } from "~/components/notebook/page-skeleton";
import { LoadError } from "~/components/notebook/load-error";
import { Button } from "~/components/ui/button";
import { CalendarForm, draftOf, type CalendarDraft } from "~/components/appointment-book/calendar-form";
import { reminderWorkflowGraph } from "~/components/appointment-book/reminder-workflow";
import { useAppointmentBookGate } from "~/components/appointment-book/use-appointment-book-gate";

export function meta() {
  return [{ title: `${i18n.t("appointmentBook.settings.metaTitle", "Calendar settings")} - Repraesent` }];
}

export default function CalendarSettingsPage() {
  const allowed = useAppointmentBookGate();
  const { calendarId = "" } = useParams();
  const { t, i18n: i } = useTranslation();
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
      JSON.stringify(draftOf(calendar)) !== JSON.stringify(draft) ||
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
      toast.success(t("appointmentBook.settings.nowDefault", "New appointments start in this calendar"));
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
  const reminder = useMutation({
    mutationFn: () =>
      createWorkflow({
        name: t("appointmentBook.settings.reminderWorkflowName", "Reminder 1 day before — {{name}}", { name: calendar?.name ?? "" }),
        graph: reminderWorkflowGraph(calendarId),
        default_locale: i.language?.slice(0, 2),
      }),
    onSuccess: (w) => navigate(`/workflows/${w.id}`),
    onError: (e) => toast.error(extractErrorMessage(e)),
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

      <Panel className="flex items-start gap-3 px-4 py-4 sm:px-5">
        <Globe className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          {t(
            "appointmentBook.settings.useOnWebsite",
            "To let people book it on your website, add an appointment field to a form (Website → Forms) or a booking action to your chat, and pick “{{name}}”.",
            { name: calendar.name },
          )}
        </p>
      </Panel>

      <CalendarForm
        calendarId={calendar.id}
        draft={draft}
        onChange={setDraft}
        closures={closures}
        onClosuresChange={setClosures}
        otherCalendars={calendars.data ?? []}
      />

      {pilot.workflows ? (
        <Panel className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
          <Workflow className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-foreground">{t("appointmentBook.settings.ownReminders", "Your own reminders")}</p>
            <p className="text-[13.5px] text-muted-foreground">
              {t(
                "appointmentBook.settings.ownRemindersHint",
                "Want different words, a second reminder, or a message after the visit? Start from a ready-made workflow and change it.",
              )}
            </p>
            {draft.customer_messages.reminder.enabled ? (
              <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-marker-ink">
                <Bell className="size-3.5" aria-hidden />
                {t("appointmentBook.settings.doubleReminder", "The reminder above is on too — turn one off so nobody gets two.")}
              </p>
            ) : null}
          </div>
          <Button variant="outline" className="max-sm:h-11" disabled={reminder.isPending} onClick={() => reminder.mutate()}>
            {t("appointmentBook.settings.startWorkflow", "Start a reminder workflow")}
          </Button>
        </Panel>
      ) : null}

      <Panel className="space-y-3 px-4 py-5 sm:px-6">
        <h2 className="text-[16px] font-semibold text-foreground">{t("appointmentBook.settings.manage", "This calendar")}</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="max-sm:h-11" disabled={toggle.isPending} onClick={() => toggle.mutate(off)}>
            {off ? t("appointmentBook.settings.turnOn", "Turn on") : t("appointmentBook.settings.turnOff", "Turn off")}
          </Button>
          {!calendar.is_default ? (
            <Button variant="outline" className="max-sm:h-11" disabled={makeDefault.isPending} onClick={() => makeDefault.mutate()}>
              {t("appointmentBook.settings.makeDefault", "Use for new appointments")}
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
