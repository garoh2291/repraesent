import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, CalendarDays, CalendarPlus, ChevronRight, Globe, MapPin, Plus, Sun, Video } from "lucide-react";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { WEEKDAYS, type AppointmentCalendar } from "~/lib/api/appointment-book";
import { zoneCity } from "~/lib/time/zones";
import { NewCalendarFields, NewCalendarSheet, useCreateCalendar, useNewCalendarDraft } from "~/components/appointment-book/new-calendar-fields";
import { useAppointmentCalendars } from "~/lib/hooks/useAppointmentBook";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel } from "~/components/notebook/panel";
import { LoadError } from "~/components/notebook/load-error";
import { Button } from "~/components/ui/button";
import { CalendarDot } from "~/components/appointment-book/appointment-bits";
import { useAppointmentBookGate } from "~/components/appointment-book/use-appointment-book-gate";
import { cn } from "~/lib/utils";
import { ConnectedCalendarHandlers } from "~/components/appointment-book/connected-calendar-handlers";
import { useWorkspaceMembers } from "~/lib/hooks/useWorkspaceMembers";

export function meta() {
  return [{ title: `${i18n.t("appointmentBook.calendars.metaTitle", "Your calendars")} - Repraesent` }];
}

/**
 * The places appointments arrive in. Setup, so it sits one layer down from
 * the appointment book; each one opens its own page of rules.
 */
export default function AppointmentCalendarsPage() {
  const allowed = useAppointmentBookGate();
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "appointmentBook.calendars.metaTitle", titleSuffix: " - Repraesent" });
  const calendars = useAppointmentCalendars(allowed);
  const [creating, setCreating] = useState(false);
  if (!allowed) return null;

  return (
    <PageContainer className="app-fade-in space-y-5">
      <Link
        to="/appointments"
        className="press -ml-2 inline-flex h-10 items-center gap-1.5 rounded-full px-2 text-[14px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("appointmentBook.title", "Appointments")}
      </Link>
      <PageHeader
        title={t("appointmentBook.calendars.title", "Your calendars")}
        subtitle={t(
          "appointmentBook.calendars.subtitle",
          "Each calendar has its own hours and rules. Your website forms and chat book into the one you pick.",
        )}
        actions={
          calendars.data?.length === 0 ? undefined : (
          <Button size="sm" className="h-9 gap-1.5 max-sm:h-11 max-sm:w-full" disabled={!calendars.data} onClick={() => setCreating(true)}>
            <Plus className="size-3.5" aria-hidden />
            {t("appointmentBook.calendars.new", "New calendar")}
          </Button>
          )
        }
      />
      {calendars.isError && !calendars.data ? (
        <LoadError what={t("appointmentBook.calendars.what", "your calendars")} onRetry={() => void calendars.refetch()} />
      ) : calendars.data && calendars.data.length === 0 ? (
        <FirstCalendarPanel />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(calendars.data ?? []).map((c) => (
            <CalendarCard key={c.id} calendar={c} />
          ))}
          {calendars.isLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> : null}
        </div>
      )}
      <ConnectedCalendarHandlers />
      {creating ? <NewCalendarSheet onOpenChange={setCreating} calendars={calendars.data} /> : null}
    </PageContainer>
  );
}

function hoursSummary(c: AppointmentCalendar, locale: string, closed: string): string {
  const open = WEEKDAYS.filter((d) => (c.weekly_hours[d] ?? []).length > 0);
  if (open.length === 0) return closed;
  const name = (d: (typeof WEEKDAYS)[number]) =>
    new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(Date.UTC(2030, 0, 7 + WEEKDAYS.indexOf(d))));
  const first = c.weekly_hours[open[0]];
  const span = c.booking_unit === "day" ? "" : ` ${first[0].start}–${first[first.length - 1].end}`;
  const days =
    open.length > 2 && WEEKDAYS.indexOf(open[open.length - 1]) - WEEKDAYS.indexOf(open[0]) === open.length - 1
      ? `${name(open[0])}–${name(open[open.length - 1])}`
      : open.map(name).join(", ");
  return `${days}${span}`;
}

function CalendarCard({ calendar: c }: { calendar: AppointmentCalendar }) {
  const { t, i18n: i } = useTranslation();
  const off = c.status === "disabled";
  const members = useWorkspaceMembers();
  const owner = (members.data?.members ?? []).find((m) => m.user_id === c.owner_user_id);
  const ownerName = owner ? [owner.user_first_name, owner.user_last_name].filter(Boolean).join(" ") || owner.user_email : null;
  const length =
    c.booking_unit === "day"
      ? t("appointmentBook.wholeDay", "Whole day")
      : t("appointmentBook.settings.minutes", "{{count}} min", { count: c.duration_minutes });
  return (
    <Link to={`/appointments/calendars/${c.id}`} prefetch="intent" className="press group block">
      <Panel className={cn("flex h-full items-start gap-3 p-4 transition-colors group-hover:border-foreground/30 sm:p-5", off && "opacity-70")}>
        <CalendarDot color={c.color} className="mt-2 size-3" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[16px] font-semibold text-foreground">{c.name}</span>
            {c.is_default ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                {t("appointmentBook.calendars.fallback", "Used when nothing else is picked")}
              </span>
            ) : null}
            {off ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11.5px] font-medium text-muted-foreground">
                {t("appointmentBook.calendars.off", "Turned off")}
              </span>
            ) : null}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              {c.mode === "online" ? <Video className="size-3.5" aria-hidden /> : <MapPin className="size-3.5" aria-hidden />}
              {c.mode === "online" ? t("appointmentBook.settings.online", "Online") : c.location || t("appointmentBook.settings.inPerson", "In person")}
            </span>
            <span className="inline-flex items-center gap-1">
              {c.booking_unit === "day" ? <Sun className="size-3.5" aria-hidden /> : <CalendarDays className="size-3.5" aria-hidden />}
              {length}
            </span>
            <span className="inline-flex items-center gap-1" title={c.timezone}>
              <Globe className="size-3.5" aria-hidden />
              {t("appointmentBook.calendars.zone", "{{city}} time", { city: zoneCity(c.timezone) })}
            </span>
          </p>
          <p className="text-[13px] text-muted-foreground">{hoursSummary(c, i.language, t("appointmentBook.settings.closed", "Closed"))}</p>
          <p className="num text-[13px] text-foreground">
            {t("appointmentBook.calendars.upcoming", "{{count}} coming up", { count: c.upcoming_count })}
            <span className="text-muted-foreground">
              {" · "}
              {ownerName
                ? t("appointmentBook.calendars.handledBy", "handled by {{name}}", { name: ownerName })
                : t("appointmentBook.calendars.nobodyHandles", "nobody handles it yet")}
            </span>
          </p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Panel>
    </Link>
  );
}

/** "Set up your appointment calendar": a workspace starts with none. */
function FirstCalendarPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useNewCalendarDraft([]);
  const create = useCreateCalendar((c) => navigate(`/appointments/calendars/${c.id}`));
  const submit = () => draft.name.trim() && !create.isPending && create.mutate(draft);
  return (
    <Panel className="app-fade-up space-y-5 px-4 py-5 sm:px-6 sm:py-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground" aria-hidden>
          <CalendarPlus className="size-5" />
        </span>
        <div className="min-w-0 space-y-1">
          <h2 className="text-[17px] font-semibold text-foreground">{t("appointmentBook.setup.title", "Set up your appointment calendar")}</h2>
          <p className="max-w-xl text-[13.5px] leading-relaxed text-muted-foreground">
            {t("appointmentBook.setup.body", "You don't have one yet. Give it a name and a time zone — opening hours and messages come right after.")}
          </p>
        </div>
      </div>
      <NewCalendarFields draft={draft} onChange={setDraft} onSubmit={submit} />
      <Button className="w-full sm:w-auto max-sm:h-11" disabled={!draft.name.trim() || create.isPending} onClick={submit}>
        {create.isPending ? t("common.saving", "Saving…") : t("appointmentBook.setup.create", "Create calendar")}
      </Button>
    </Panel>
  );
}
