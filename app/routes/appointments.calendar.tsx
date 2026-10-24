import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import moment from "moment-timezone";
import type { View } from "react-big-calendar";
import { Plus, Settings2 } from "lucide-react";
import i18n from "~/i18n";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useAppointmentCalendars, useAppointments } from "~/lib/hooks/useAppointmentBook";
import { calendarKeyFor, getCalendarEvents, listCalendarAccounts, type UnifiedCalendarEvent } from "~/lib/api/calendar";
import { CalendarView } from "~/components/calendar/CalendarView";
import { PageContainer, PageHeader } from "~/components/notebook/page-header";
import { useQuickCreate } from "~/components/notebook/quick-create";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { CalendarDot } from "~/components/appointment-book/appointment-bits";
import { canImportMeeting, ImportMeetingSheet, type CalendarMeeting } from "~/components/appointment-book/import-meeting-sheet";
import { useAppointmentBookGate } from "~/components/appointment-book/use-appointment-book-gate";
import { cn } from "~/lib/utils";

export function meta() {
  return [{ title: `${i18n.t("appointmentBook.calendarView.metaTitle", "Appointments calendar")} - Repraesent` }];
}

/** Same windows as the team calendar: the visible grid, padded at month edges. */
function rangeFor(date: Date, view: View, timezone: string) {
  const m = moment.tz(date, timezone);
  if (view === "month") {
    return {
      start: m.clone().startOf("month").subtract(7, "days").startOf("day").toISOString(),
      end: m.clone().endOf("month").add(7, "days").endOf("day").toISOString(),
    };
  }
  // A day either side: the grid starts the week on Sunday or Monday by language.
  if (view === "week") {
    return {
      start: m.clone().startOf("week").subtract(1, "day").toISOString(),
      end: m.clone().endOf("week").add(1, "day").toISOString(),
    };
  }
  if (view === "agenda") return { start: m.clone().startOf("day").toISOString(), end: m.clone().add(30, "days").endOf("day").toISOString() };
  return { start: m.clone().startOf("day").toISOString(), end: m.clone().endOf("day").toISOString() };
}

const OTHER_COLOR = "#b8b5ae";

/**
 * The appointments on a calendar grid, coloured by calendar. Click an empty
 * time to book it. "Show my other calendars" lays your connected Google /
 * Microsoft events underneath in grey, so you can see what else is on.
 */
export default function AppointmentsCalendarPage() {
  const allowed = useAppointmentBookGate();
  const { t } = useTranslation();
  useDocumentMeta({ titleKey: "appointmentBook.calendarView.metaTitle", titleSuffix: " - Repraesent" });
  const navigate = useNavigate();
  const quick = useQuickCreate();
  const calendars = useAppointmentCalendars(allowed);
  // Touch screens book a free time with a long press (a tap scrolls the grid).
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(window.matchMedia("(pointer: coarse)").matches), []);
  const [date, setDate] = useState(() => new Date());
  const [view, setView] = useState<View>(() =>
    typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches ? "day" : "week",
  );
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [showOther, setShowOther] = useState(false);
  // A grey "other calendar" meeting picked to add to Appointments.
  const [meeting, setMeeting] = useState<CalendarMeeting | null>(null);

  const timezone =
    calendars.data?.find((c) => c.is_default)?.timezone ??
    calendars.data?.[0]?.timezone ??
    (typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC");
  const range = useMemo(() => rangeFor(date, view, timezone), [date, view, timezone]);
  const list = useAppointments({ from: range.start, to: range.end, limit: 500 }, allowed);

  const accounts = useQuery({ queryKey: ["calendar-accounts"], queryFn: listCalendarAccounts, enabled: allowed && showOther });
  const ownKeys = useMemo(
    () =>
      (accounts.data?.accounts ?? [])
        .filter((a) => a.is_own && !a.auth_failed)
        .flatMap((a) => a.calendars.map((c) => calendarKeyFor(a, c.id))),
    [accounts.data],
  );
  const other = useQuery({
    queryKey: ["calendar-events", range.start, range.end, ownKeys],
    queryFn: () => getCalendarEvents(range.start, range.end, ownKeys),
    enabled: allowed && showOther && ownKeys.length > 0,
  });

  const colorByKey: Record<string, string> = {};
  for (const c of calendars.data ?? []) colorByKey[c.key] = c.color || "#141516";
  const events: UnifiedCalendarEvent[] = useMemo(() => {
    const mine = (list.data ?? [])
      .filter((a) => a.status !== "cancelled")
      .filter((a) => !a.calendar_id || !hidden.has(a.calendar_id))
      .map((a) => ({
        id: `appt:${a.id}`,
        calendarKey: a.calendar_key,
        title: a.display_name || a.customer_email || t("appointmentBook.someone", "Someone"),
        start: a.starts_at,
        end: a.ends_at,
        allDay: a.all_day,
        meetLink: a.meeting_url,
        rsvp: null,
      }));
    // A meeting already added to Appointments shows once, as the appointment.
    const added = new Set(
      (list.data ?? []).filter((a) => a.provider_event_id).map((a) => `${a.calendar_key}:${a.provider_event_id}`),
    );
    const theirs = showOther
      ? (other.data?.events ?? [])
          .filter((e) => !added.has(e.id))
          .map((e) => ({ ...e, id: `ext:${e.id}`, calendarKey: `other:${e.calendarKey}` }))
      : [];
    return [...theirs, ...mine];
  }, [list.data, hidden, other.data, showOther, t]);
  for (const e of events) if (e.calendarKey.startsWith("other:")) colorByKey[e.calendarKey] = OTHER_COLOR;

  if (!allowed) return null;

  return (
    <PageContainer wide className="app-fade-in space-y-4">
      <PageHeader
        title={t("appointmentBook.calendarView.title", "Calendar")}
        subtitle={
          touch
            ? t("appointmentBook.calendarView.subtitleTouch", "Touch and hold a free time to book it.")
            : t("appointmentBook.calendarView.subtitle", "Click a free time to book it.")
        }
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 max-sm:h-11 max-sm:flex-1">
              <Link to="/appointments/calendars">
                <Settings2 className="size-3.5" aria-hidden />
                {t("appointmentBook.calendarsButton", "Calendars")}
              </Link>
            </Button>
            <Button size="sm" className="h-9 gap-1.5 max-sm:h-11 max-sm:flex-1" onClick={() => quick.open("appointment")}>
              <Plus className="size-3.5" aria-hidden />
              {t("appointmentBook.new", "New appointment")}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {(calendars.data ?? []).map((c) => {
          const off = hidden.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={!off}
              onClick={() =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (next.has(c.id)) next.delete(c.id);
                  else next.add(c.id);
                  return next;
                })
              }
              className={cn(
                "press inline-flex h-9 items-center gap-2 rounded-full border px-3 text-[13px] font-medium transition-colors max-sm:h-11",
                off ? "border-dashed border-border text-muted-foreground" : "border-border bg-card text-foreground",
              )}
            >
              <CalendarDot color={off ? "transparent" : c.color} className={off ? "border border-muted-foreground" : undefined} />
              {c.name}
            </button>
          );
        })}
        <label className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 text-[13px] text-muted-foreground">
          <Switch checked={showOther} onCheckedChange={setShowOther} />
          {t("appointmentBook.calendarView.showOther", "Show my other calendars")}
        </label>
      </div>

      <div
        className={cn(
          "appointments-calendar team-calendar h-[640px] overflow-hidden rounded-2xl border border-border transition-opacity duration-150 max-sm:h-[max(420px,calc(100dvh-18rem))]",
          list.isFetching ? "opacity-70" : "opacity-100",
        )}
      >
        <CalendarView
          events={events}
          colorByKey={colorByKey}
          date={date}
          view={view}
          timezone={timezone}
          onNavigate={setDate}
          onView={setView}
          onSelectEvent={(e) => {
            if (e.id.startsWith("appt:")) navigate(`/appointments/${e.id.slice(5)}`);
            else if (e.id.startsWith("ext:")) {
              const calendarKey = e.calendarKey.replace(/^other:/, "");
              if (canImportMeeting(calendarKey)) {
                setMeeting({ id: e.id.slice(4), calendarKey, title: e.title, start: e.start, end: e.end, allDay: e.allDay });
              }
            }
          }}
          onSelectSlot={(start) =>
            quick.open("appointment", { appointment: { startsAt: start.toISOString(), dayOnly: view === "month" } })
          }
        />
      </div>
      <ImportMeetingSheet meeting={meeting} timezone={timezone} onOpenChange={(o) => !o && setMeeting(null)} />
    </PageContainer>
  );
}
