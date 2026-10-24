import { useState } from "react";
import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  ExternalLink,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  RotateCcw,
  Video,
} from "lucide-react";
import i18n from "~/i18n";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import {
  appointmentKeys,
  getAppointment,
  CALENDAR_SYNCED_SOURCES,
  getAppointmentEvents,
  getAppointmentMessages,
  setAppointmentOutcome,
  updateAppointment,
  type Appointment,
  type AppointmentEvent,
  type AppointmentMessage,
  type UpdateAppointmentInput,
} from "~/lib/api/appointment-book";
import { useAppointmentCalendars, useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { contactPath } from "~/lib/contacts/contact-path";
import { PageContainer } from "~/components/notebook/page-header";
import { Panel, PanelHeader } from "~/components/notebook/panel";
import { LeadNotesSection } from "~/components/organism/lead-notes-section";
import { LoadError } from "~/components/notebook/load-error";
import { PageSkeleton } from "~/components/notebook/page-skeleton";
import { Button } from "~/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { CalendarDot, OutcomeButtons, StatusPill } from "~/components/appointment-book/appointment-bits";
import { CancelDialog, MoveDialog } from "~/components/appointment-book/change-dialogs";
import { EntityPicker, type PickedEntity } from "~/components/appointment-book/entity-picker";
import { longDateYear, timeRange, whoOf } from "~/components/appointment-book/format";
import { PhoneBar } from "~/components/appointment-book/phone-bar";
import { useAppointmentBookGate } from "~/components/appointment-book/use-appointment-book-gate";
import { cn } from "~/lib/utils";

export function meta() {
  return [{ title: `${i18n.t("appointmentBook.detail.metaTitle", "Appointment")} - Repraesent` }];
}

export default function AppointmentDetailPage() {
  const allowed = useAppointmentBookGate();
  const { appointmentId = "" } = useParams();
  const { t, i18n: i } = useTranslation();
  useDocumentMeta({ titleKey: "appointmentBook.detail.metaTitle", titleSuffix: " - Repraesent" });
  const { currentWorkspace } = useAuthContext();
  const ws = currentWorkspace?.id;
  const query = useQuery({
    queryKey: appointmentKeys.one(ws, appointmentId),
    queryFn: () => getAppointment(appointmentId),
    enabled: allowed && !!appointmentId,
  });
  const calendars = useAppointmentCalendars(allowed);
  const [moveOpen, setMoveOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!allowed) return null;
  if (query.isLoading) return <PageSkeleton />;
  if (query.isError || !query.data) {
    return (
      <PageContainer>
        <LoadError what={t("appointmentBook.detail.what", "this appointment")} onRetry={() => void query.refetch()} />
      </PageContainer>
    );
  }
  const a = query.data;
  const calendar = calendars.data?.find((c) => c.id === a.calendar_id) ?? null;
  const locale = i.language;
  const when = `${longDateYear(a.starts_at, a.timezone, locale)} · ${timeRange(a, locale, t("appointmentBook.wholeDay", "Whole day"))}`;
  const open = a.status === "scheduled";
  // Lives in a connected calendar (onboarding call, added meeting): it is
  // moved or cancelled there, and this page follows.
  const synced = CALENDAR_SYNCED_SOURCES.includes(a.source);
  const changeable = open && !synced;

  return (
    <PageContainer className="app-fade-in space-y-5 pb-7">
      <Link
        to="/appointments"
        className="press -ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[14px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("appointmentBook.title", "Appointments")}
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
          {a.calendar ? (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDot color={a.calendar.color} />
              {a.calendar.name}
            </span>
          ) : (
            <span>{t("appointmentBook.connectedCalendar", "Connected calendar")}</span>
          )}
          <span aria-hidden>·</span>
          <span>{t(`appointmentBook.source.${a.source}`, sourceLabel(a.source))}</span>
          <StatusPill appointment={a} />
        </div>
        <h1 className="title-display text-[26px] font-semibold text-foreground sm:text-[32px]">
          {whoOf(a, t("appointmentBook.someone", "Someone"))}
        </h1>
        <p className={cn("num text-[16px] text-foreground", a.status === "cancelled" && "text-muted-foreground line-through")}>{when}</p>
        {a.title && a.title !== a.calendar?.name ? <p className="text-[14px] text-muted-foreground">{a.title}</p> : null}
        {a.host_label ? (
          <p className="text-[14px] text-muted-foreground">{t("appointmentBook.detail.host", "With {{name}}", { name: a.host_label })}</p>
        ) : null}
        {synced && open ? (
          <p className="text-[13px] text-muted-foreground">
            {t("appointmentBook.detail.syncedHint", "This meeting lives in your calendar. Move or cancel it there — it updates here within 10 minutes.")}
          </p>
        ) : null}
      </header>

      {/* What this appointment needs from you now. On phones it rides above the tab bar. */}
      {a.needs_outcome || changeable || a.status === "completed" || a.status === "no_show" ? (
      <PhoneBar>
        {a.needs_outcome ? <OutcomeButtons appointment={a} /> : null}
        {changeable ? (
          <>
            <Button variant="outline" className="h-11 rounded-full px-4" onClick={() => setMoveOpen(true)}>
              <CalendarClock className="size-4" aria-hidden />
              {t("appointmentBook.detail.move", "Move")}
            </Button>
            <Button variant="outline" className="h-11 rounded-full px-4" onClick={() => setCancelOpen(true)}>
              {t("appointmentBook.detail.cancel", "Cancel")}
            </Button>
          </>
        ) : null}
        {a.status === "completed" || a.status === "no_show" ? <UndoOutcome appointment={a} /> : null}
      </PhoneBar>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <WherePanel appointment={a} />
          <DetailsPanel appointment={a} />
          {/* The shared notes block brings its own "Notes (n)" heading. */}
          <Panel>
            <div className="px-4 py-3 sm:px-5">
              <LeadNotesSection appointmentId={a.id} />
            </div>
          </Panel>
          <HistoryPanel appointmentId={a.id} timezone={a.timezone} />
        </div>
        <div className="space-y-5">
          <PeoplePanel appointment={a} />
          <MessagesPanel appointment={a} />
        </div>
      </div>

      {moveOpen ? <MoveDialog appointment={a} calendar={calendar} open onOpenChange={setMoveOpen} /> : null}
      {cancelOpen ? <CancelDialog appointment={a} calendar={calendar} open onOpenChange={setCancelOpen} /> : null}
    </PageContainer>
  );
}

function sourceLabel(source: Appointment["source"]): string {
  return (
    {
      manual: "Booked by your team",
      form: "Booked on your website form",
      ai_assistant: "Booked in your website chat",
      customer_page: "Booked by the customer",
      api: "Booked through an app",
      import: "From your calendar",
      legacy_booking: "Booked on your booking page",
      onboarding: "Onboarding call",
    } as Record<string, string>
  )[source];
}

function UndoOutcome({ appointment }: { appointment: Appointment }) {
  const { t } = useTranslation();
  const invalidate = useInvalidateAppointments();
  const undo = useMutation({
    mutationFn: () => setAppointmentOutcome(appointment.id, { status: "scheduled" }),
    onSuccess: invalidate,
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  return (
    <Button variant="ghost" className="h-11 rounded-full px-4" disabled={undo.isPending} onClick={() => undo.mutate()}>
      <RotateCcw className="size-4" aria-hidden />
      {t("appointmentBook.detail.undoOutcome", "Undo")}
    </Button>
  );
}

function WherePanel({ appointment: a }: { appointment: Appointment }) {
  const { t } = useTranslation();
  const map = a.location ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.location)}` : null;
  return (
    <Panel>
      <PanelHeader title={t("appointmentBook.detail.where", "Where")} />
      <div className="px-4 py-3 sm:px-5">
        {a.mode === "online" ? (
          a.meeting_url ? (
            <a href={a.meeting_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-[15px] font-medium underline underline-offset-4">
              <Video className="size-4" aria-hidden />
              {t("appointmentBook.detail.joinOnline", "Join online")}
            </a>
          ) : (
            <p className="text-[14px] text-muted-foreground">{t("appointmentBook.detail.onlineNoLink", "Online — no link yet. Add one in the calendar's settings.")}</p>
          )
        ) : a.location ? (
          <a href={map!} target="_blank" rel="noreferrer" className="inline-flex items-start gap-2 text-[15px] text-foreground hover:underline">
            <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{a.location}</span>
            <ExternalLink className="mt-1 size-3 shrink-0 text-muted-foreground" aria-hidden />
          </a>
        ) : (
          <p className="text-[14px] text-muted-foreground">{t("appointmentBook.detail.noPlace", "In person — no address set on the calendar.")}</p>
        )}
      </div>
    </Panel>
  );
}

/**
 * What came with the booking — the customer's message, what the chat noted,
 * the form's text — plus what happened to it. Facts, so nobody edits them:
 * the team writes its own notes below.
 */
function DetailsPanel({ appointment: a }: { appointment: Appointment }) {
  const { t } = useTranslation();
  if (!a.notes && !a.outcome_note && !a.cancel_reason) return null;
  return (
    <Panel>
      <PanelHeader title={t("appointmentBook.detail.details", "Details")} />
      <div className="space-y-3 px-4 py-3 sm:px-5">
        {a.notes ? (
          <div className="space-y-1">
            <p className="whitespace-pre-wrap text-[14.5px] text-foreground">{a.notes}</p>
            <p className="text-[12.5px] text-muted-foreground">
              {t(`appointmentBook.detail.detailsFrom.${a.source}`, "Came with the booking")}
            </p>
          </div>
        ) : null}
        {a.outcome_note ? (
          <p className="text-[13.5px] text-muted-foreground">
            <span className="font-medium text-foreground">{t("appointmentBook.detail.outcomeNote", "After the visit:")}</span> {a.outcome_note}
          </p>
        ) : null}
        {a.cancel_reason ? (
          <p className="text-[13.5px] text-muted-foreground">
            <span className="font-medium text-foreground">{t("appointmentBook.detail.cancelReason", "Why it was cancelled:")}</span> {a.cancel_reason}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}

function PeoplePanel({ appointment: a }: { appointment: Appointment }) {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const invalidate = useInvalidateAppointments();
  const members = useQuery({ queryKey: ["workspace-detail"], queryFn: () => getWorkspaceDetail(), enabled: !!currentWorkspace });
  const patch = useMutation({
    mutationFn: (input: UpdateAppointmentInput) => updateAppointment(a.id, input),
    onSuccess: () => {
      invalidate();
      toast.success(t("common.saved", "Saved"));
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  const person: PickedEntity | null = a.contact
    ? { id: a.contact.id, label: a.contact.name || "—", kind: "person" }
    : a.company
      ? { id: a.company.id, label: a.company.name || "—", kind: "company" }
      : null;
  const deal: PickedEntity | null = a.deal ? { id: a.deal.id, label: a.deal.title || t("appointmentBook.deal", "Deal") } : null;

  const row = "space-y-1.5";
  const label = "text-[12.5px] font-medium text-muted-foreground";
  return (
    <Panel>
      <PanelHeader title={t("appointmentBook.detail.who", "Who")} />
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className={row}>
          <p className={label}>{t("appointmentBook.detail.customer", "Customer")}</p>
          <EntityPicker
            type="contact"
            value={person}
            onChange={(p) =>
              patch.mutate(
                p?.kind === "company"
                  ? { company_id: p.id, contact_id: null }
                  : { contact_id: p?.id ?? null, company_id: p ? undefined : null },
              )
            }
            placeholder={t("appointmentBook.form.searchCustomer", "Search your customers…")}
          />
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
            {a.contact ? <Link className="underline underline-offset-4" to={contactPath({ id: a.contact.id, kind: "person" })}>{t("appointmentBook.detail.openContact", "Open contact")}</Link> : null}
            {a.company ? <Link className="underline underline-offset-4" to={contactPath({ id: a.company.id, kind: "company" })}>{a.company.name || t("appointmentBook.form.company", "Company")}</Link> : null}
            {a.lead ? <Link className="underline underline-offset-4" to={`/lead-form/${a.lead.id}`}>{t("appointmentBook.detail.openInquiry", "The inquiry")}</Link> : null}
          </div>
          {a.customer_email || a.customer_phone ? (
            <div className="space-y-1 pt-1 text-[13.5px]">
              {a.customer_email ? (
                <a href={`mailto:${a.customer_email}`} className="flex items-center gap-2 text-foreground hover:underline">
                  <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                  {a.customer_email}
                </a>
              ) : null}
              {a.customer_phone ? (
                <a href={`tel:${a.customer_phone}`} className="flex items-center gap-2 text-foreground hover:underline">
                  <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                  {a.customer_phone}
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className={row}>
          <p className={label}>{t("appointmentBook.detail.deal", "Deal")}</p>
          <EntityPicker
            type="deal"
            value={deal}
            onChange={(d) => patch.mutate({ deal_id: d?.id ?? null })}
            placeholder={t("appointmentBook.form.searchDeal", "Search deals…")}
          />
          {a.deal ? (
            <Link to={`/pipeline/${a.deal.id}`} className="text-[13px] underline underline-offset-4">
              {t("appointmentBook.detail.openDeal", "Open deal")}
            </Link>
          ) : null}
        </div>
        <div className={row}>
          <p className={label}>{t("appointmentBook.detail.handledBy", "Who handles it")}</p>
          <Select
            value={a.assigned_user?.id ?? "nobody"}
            onValueChange={(v) => patch.mutate({ assigned_user_id: v === "nobody" ? null : v })}
          >
            <SelectTrigger className="h-10 w-full max-sm:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nobody">{t("appointmentBook.detail.nobody", "Nobody yet")}</SelectItem>
              {(members.data?.members ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {[m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || m.user_email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Panel>
  );
}

function MessagesPanel({ appointment: a }: { appointment: Appointment }) {
  const { t, i18n: i } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const q = useQuery({
    queryKey: appointmentKeys.messages(currentWorkspace?.id, a.id),
    queryFn: () => getAppointmentMessages(a.id),
  });
  const items = (q.data ?? []).filter((m) => m.status !== "cancelled" && m.status !== "skipped");
  const kind = (m: AppointmentMessage) =>
    t(`appointmentBook.messages.kind.${m.kind}`, { confirmation: "Confirmation", reminder: "Reminder", changed: "New time", cancelled: "Cancellation", custom: "Message" }[m.kind] ?? m.kind);
  const state = (m: AppointmentMessage) =>
    m.status === "sent"
      ? t("appointmentBook.messages.sent", "Sent {{when}}", { when: shortWhen(m.sent_at ?? m.scheduled_for, i.language, a.timezone) })
      : m.status === "failed"
        ? t("appointmentBook.messages.failed", "Could not be sent")
        : t("appointmentBook.messages.planned", "Goes out {{when}}", { when: shortWhen(m.scheduled_for, i.language, a.timezone) });
  return (
    <Panel>
      <PanelHeader title={t("appointmentBook.detail.messages", "Messages")} />
      <div className="px-4 py-3 sm:px-5">
        {items.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">
            {a.customer_email
              ? t("appointmentBook.messages.none", "Nothing sent or planned. The calendar's settings decide which messages go out.")
              : t("appointmentBook.messages.noAddress", "No email address, so no messages. Add one to the customer to send a confirmation and reminders.")}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((m) => (
              <li key={m.id} className="flex items-start gap-2.5 text-[13.5px]">
                <MessageSquareText className={cn("mt-0.5 size-4 shrink-0", m.status === "failed" ? "text-overdue" : "text-muted-foreground")} aria-hidden />
                <span className="min-w-0">
                  <span className="font-medium text-foreground">{kind(m)}</span>
                  <span className="text-muted-foreground"> · {m.channel === "sms" ? t("appointmentBook.messages.sms", "Text") : t("appointmentBook.messages.email", "Email")}</span>
                  <span className="block text-muted-foreground">{state(m)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}

/** In the appointment's own zone, like the header — never the viewer's. */
function shortWhen(iso: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }).format(
    new Date(iso),
  );
}

function HistoryPanel({ appointmentId, timezone }: { appointmentId: string; timezone: string }) {
  const { t, i18n: i } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const q = useQuery({
    queryKey: appointmentKeys.events(currentWorkspace?.id, appointmentId),
    queryFn: () => getAppointmentEvents(appointmentId),
  });
  const items = (q.data ?? []).filter((e) => e.kind !== "message_sent");
  const describe = (e: AppointmentEvent) => {
    const who =
      e.actor === "customer"
        ? t("appointmentBook.history.byCustomer", "the customer")
        : e.actor_name || (e.actor === "system" ? t("appointmentBook.history.bySystem", "Repraesent") : t("appointmentBook.history.byTeam", "your team"));
    const to = e.to_starts_at ? shortWhen(e.to_starts_at, i.language, timezone) : "";
    const map: Record<string, string> = {
      created: t("appointmentBook.history.created", "Booked by {{who}}", { who }),
      rescheduled: t("appointmentBook.history.moved", "Moved to {{to}} by {{who}}", { to, who }),
      customer_rescheduled: t("appointmentBook.history.moved", "Moved to {{to}} by {{who}}", { to, who }),
      cancelled: t("appointmentBook.history.cancelled", "Cancelled by {{who}}", { who }),
      customer_cancelled: t("appointmentBook.history.cancelled", "Cancelled by {{who}}", { who }),
      customer_confirmed: t("appointmentBook.history.confirmed", "The customer said they'll come"),
      status_changed: t("appointmentBook.history.outcome", "Outcome noted by {{who}}", { who }),
      linked: t("appointmentBook.history.linked", "People or deal changed by {{who}}", { who }),
      updated: t("appointmentBook.history.updated", "Details changed by {{who}}", { who }),
      copy_failed: t("appointmentBook.history.copyFailed", "Could not put it in the connected calendar"),
      message_failed: t("appointmentBook.history.messageFailed", "A message could not be sent"),
    };
    return map[e.kind] ?? e.kind;
  };
  return (
    <Panel>
      <PanelHeader title={t("appointmentBook.detail.history", "History")} />
      <ol className="space-y-2.5 px-4 py-3 sm:px-5">
        {items.map((e) => (
          <li key={e.id} className="flex items-baseline justify-between gap-3 text-[13.5px]">
            <span className={cn("text-foreground", e.kind.endsWith("failed") && "text-overdue")}>{describe(e)}</span>
            <span className="num shrink-0 text-[12px] text-muted-foreground">{shortWhen(e.created_at, i.language, timezone)}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
