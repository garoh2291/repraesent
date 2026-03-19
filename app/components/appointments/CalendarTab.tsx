import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, momentLocalizer } from "react-big-calendar";
import moment from "moment-timezone";
import { formatInTimeZone } from "date-fns-tz";
import {
  getAppointments,
  getAppointmentsByConfigId,
} from "~/lib/api/appointments";
import type { AppointmentConfig } from "~/lib/api/appointments";
import type { Event, View } from "react-big-calendar";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import "react-big-calendar/lib/css/react-big-calendar.css";

const localizer = momentLocalizer(moment);

function formatInTimezone(
  date: Date,
  timezone: string,
  timeFormat: string,
): string {
  return date.toLocaleString(undefined, {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
    hour12: timeFormat === "12h",
  });
}

/** Generic key-value pairs parsed from notes (e.g. "Key: value" lines) */
type ParsedBookingInfo = Record<string, string>;

const NEWLINE_REGEX = /\\n|\r?\n/;

function parseBookingNotes(notes: string): ParsedBookingInfo {
  if (!notes?.trim()) return {};
  const lines = notes
    .split(NEWLINE_REGEX)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: ParsedBookingInfo = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

type CalendarEvent = Event & { notes?: string };

function AppointmentEventWrapper({
  event,
  children,
  timezone,
  timeFormat,
}: {
  event: CalendarEvent;
  children?: React.ReactNode;
  timezone: string;
  timeFormat: string;
}) {
  const title = event.title ?? "Appointment";
  const rawNotes = event.notes ?? "";
  const parsed = parseBookingNotes(rawNotes);
  const start =
    event.start instanceof Date
      ? event.start
      : new Date(event.start ?? Date.now());
  const end =
    event.end instanceof Date ? event.end : new Date(event.end ?? Date.now());

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent side="top" className="w-80">
        <div className="space-y-3">
          <p className="font-medium">{title}</p>
          <p className="text-sm text-muted-foreground">
            {formatInTimezone(start, timezone, timeFormat)} –{" "}
            {formatInTimezone(end, timezone, timeFormat)}
          </p>
          {Object.keys(parsed).length > 0 ? (
            <div className="space-y-1.5 border-t pt-3 text-sm">
              {Object.entries(parsed).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">{key}:</span>
                  {key.toLowerCase() === "email" ? (
                    <a
                      href={`mailto:${value}`}
                      className="text-primary hover:underline truncate"
                    >
                      {value}
                    </a>
                  ) : (
                    <span className="wrap-break-word">{value}</span>
                  )}
                </div>
              ))}
            </div>
          ) : rawNotes ? (
            <p className="text-sm text-muted-foreground border-t pt-3">
              {rawNotes}
            </p>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

/** Event content: show only duration (label), no title - avoids cropping. Full details in HoverCard. */
function AppointmentEvent() {
  return null;
}

const CALENDAR_MIN = new Date(2000, 0, 1, 7, 0, 0);
const CALENDAR_MAX = new Date(2000, 0, 1, 22, 0, 0);
const CALENDAR_SCROLL_TO = new Date(2000, 0, 1, 7, 0, 0);

interface CalendarTabProps {
  config: AppointmentConfig;
}

export function CalendarTab({ config }: CalendarTabProps) {
  const [view, setView] = useState<View>("week");
  const [date, setDate] = useState(new Date());
  const timezone = config.timezone ?? "UTC";
  const timeFormat = config.time_format ?? "24h";
  const firstWeekday = config.first_weekday ?? "monday";

  // Monday (1) or Sunday (0) as start of week
  useEffect(() => {
    const dow = firstWeekday === "sunday" ? 0 : 1;
    moment.updateLocale("en", { week: { dow } });
  }, [firstWeekday]);

  // Use config timezone for calendar display so appointments show on correct days
  useEffect(() => {
    if (!moment.tz) return;
    moment.tz.setDefault(timezone);
    return () => {
      moment.tz.setDefault();
    };
  }, [timezone]);

  const formats = useMemo(
    () => ({
      timeGutterFormat: timeFormat === "12h" ? "h:mm A" : "HH:mm",
      agendaTimeFormat: timeFormat === "12h" ? "h:mm A" : "HH:mm",
      agendaTimeRangeFormat: ({ start, end }: { start: Date; end: Date }) =>
        `${moment(start).format(timeFormat === "12h" ? "h:mm A" : "HH:mm")} – ${moment(end).format(timeFormat === "12h" ? "h:mm A" : "HH:mm")}`,
    }),
    [timeFormat],
  );

  const { data: appointments = [], isLoading } = useQuery({
    queryKey: ["appointments-list"],
    queryFn: getAppointments,
  });

  const events: CalendarEvent[] = appointments.map((apt: unknown) => {
    const a = apt as Record<string, unknown>;
    const start = a.start as string;
    const end = a.end as string;
    const summary = (a.summary ?? a.notes ?? "Appointment") as string;
    const notes = (a.notes ?? a.description ?? "") as string;
    return {
      start: new Date(start),
      end: new Date(end),
      title: summary,
      notes: notes || undefined,
    };
  });

  const onNavigate = useCallback((newDate: Date) => {
    setDate(newDate);
  }, []);

  const onView = useCallback((newView: View) => {
    setView(newView);
  }, []);

  if (isLoading) {
    return <div className="h-[520px] animate-pulse rounded-2xl bg-muted" />;
  }

  return (
    <div className="appointments-calendar h-[520px] rounded-2xl border border-border overflow-hidden">
      <Calendar
        localizer={localizer}
        formats={formats}
        events={events}
        startAccessor="start"
        endAccessor="end"
        titleAccessor="title"
        views={["month", "week", "day"]}
        view={view}
        date={date}
        onView={onView}
        onNavigate={onNavigate}
        min={CALENDAR_MIN}
        max={CALENDAR_MAX}
        scrollToTime={CALENDAR_SCROLL_TO}
        popup
        components={{
          event: AppointmentEvent,
          eventWrapper: (props) => (
            <AppointmentEventWrapper
              {...props}
              timezone={timezone}
              timeFormat={timeFormat}
            />
          ),
        }}
      />
    </div>
  );
}
