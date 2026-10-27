import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, CalendarDays, ChevronRight, MapPin, Plus, Sun, Video } from "lucide-react";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { createAppointmentCalendar, WEEKDAYS, type AppointmentCalendar } from "~/lib/api/appointment-book";
import { useAppointmentCalendars, useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { Panel } from "~/components/notebook/panel";
import { LoadError } from "~/components/notebook/load-error";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Segmented } from "~/components/notebook/segmented";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { CalendarDot } from "~/components/appointment-book/appointment-bits";
import { useAppointmentBookGate } from "~/components/appointment-book/use-appointment-book-gate";
import { cn } from "~/lib/utils";

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
          <Button size="sm" className="h-9 gap-1.5 max-sm:h-11 max-sm:w-full" onClick={() => setCreating(true)}>
            <Plus className="size-3.5" aria-hidden />
            {t("appointmentBook.calendars.new", "New calendar")}
          </Button>
        }
      />
      {calendars.isError && !calendars.data ? (
        <LoadError what={t("appointmentBook.calendars.what", "your calendars")} onRetry={() => void calendars.refetch()} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {(calendars.data ?? []).map((c) => (
            <CalendarCard key={c.id} calendar={c} />
          ))}
          {calendars.isLoading ? <div className="h-32 animate-pulse rounded-xl bg-muted" /> : null}
        </div>
      )}
      {creating ? <NewCalendarSheet onOpenChange={setCreating} /> : null}
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
          </p>
          <p className="text-[13px] text-muted-foreground">{hoursSummary(c, i.language, t("appointmentBook.settings.closed", "Closed"))}</p>
          <p className="num text-[13px] text-foreground">
            {t("appointmentBook.calendars.upcoming", "{{count}} coming up", { count: c.upcoming_count })}
          </p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Panel>
    </Link>
  );
}

function NewCalendarSheet({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateAppointments();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"in_person" | "online" | "day">("in_person");
  const create = useMutation({
    mutationFn: () =>
      createAppointmentCalendar({
        name: name.trim(),
        mode: kind === "online" ? "online" : "in_person",
        booking_unit: kind === "day" ? "day" : "slot",
        duration_minutes: kind === "day" ? 1440 : 60,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...(kind === "day"
          ? {
              weekly_hours: {
                mon: [{ start: "00:00", end: "23:59" }],
                tue: [{ start: "00:00", end: "23:59" }],
                wed: [{ start: "00:00", end: "23:59" }],
                thu: [{ start: "00:00", end: "23:59" }],
                fri: [{ start: "00:00", end: "23:59" }],
                sat: [{ start: "00:00", end: "23:59" }],
                sun: [{ start: "00:00", end: "23:59" }],
              },
              max_days_ahead: 730,
              min_notice_hours: 24,
            }
          : {}),
      }),
    onSuccess: (c) => {
      invalidate();
      toast.success(t("appointmentBook.calendars.created", "Calendar added"));
      onOpenChange(false);
      navigate(`/appointments/calendars/${c.id}`);
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  return (
    <BottomSheet
      open
      onOpenChange={onOpenChange}
      title={t("appointmentBook.calendars.new", "New calendar")}
      description={t("appointmentBook.calendars.newSub", "Give it a name now; hours and rules come next.")}
      footer={
        <Button className="w-full sm:w-auto max-sm:h-11" disabled={!name.trim() || create.isPending} onClick={() => create.mutate()}>
          {t("appointmentBook.calendars.create", "Add calendar")}
        </Button>
      }
    >
      <div className="space-y-4">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("appointmentBook.calendars.namePlaceholder", "e.g. Viewings")}
          className="h-10 max-sm:h-11"
          onKeyDown={(e) => e.key === "Enter" && name.trim() && create.mutate()}
        />
        <Segmented
          label={t("appointmentBook.calendars.kind", "What kind")}
          value={kind}
          onChange={setKind}
          stretch
          options={[
            { value: "in_person", label: t("appointmentBook.settings.inPerson", "In person") },
            { value: "online", label: t("appointmentBook.settings.online", "Online") },
            { value: "day", label: t("appointmentBook.settings.unitDay", "A whole day") },
          ]}
        />
      </div>
    </BottomSheet>
  );
}
