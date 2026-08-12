import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, momentLocalizer } from "react-big-calendar";
import type { Event, View } from "react-big-calendar";
import moment from "moment-timezone";
import type { UnifiedCalendarEvent } from "~/lib/api/calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

/** Events without a color mapping still need to look like events. */
const FALLBACK_EVENT_COLOR = "#64748b";

type RbcEvent = Event & { resource: UnifiedCalendarEvent };

interface CalendarViewProps {
  events: UnifiedCalendarEvent[];
  colorByKey: Record<string, string>;
  date: Date;
  view: View;
  /** IANA zone all event times are DISPLAYED in. */
  timezone: string;
  onNavigate: (date: Date) => void;
  onView: (view: View) => void;
  onSelectEvent: (event: UnifiedCalendarEvent) => void;
}

/**
 * Read-only react-big-calendar wrapper for the unified team calendar.
 *
 * The display timezone is pinned explicitly rather than left to moment's
 * global default: CalendarTab (appointments) calls `moment.tz.setDefault`
 * with the appointment config's timezone, and that global leaks into every
 * other momentLocalizer on the site. Without pinning, visiting Appointments
 * once would silently shift this whole page into e.g. GMT+4 for a viewer in
 * Sydney. Event timestamps are absolute ISO instants, so re-rendering under a
 * different zone is purely presentational.
 */
export function CalendarView({
  events,
  colorByKey,
  date,
  view,
  timezone,
  onNavigate,
  onView,
  onSelectEvent,
}: CalendarViewProps) {
  const { t } = useTranslation();

  // momentLocalizer reads moment's global default at format time, so the
  // default must be set before rbc renders — and re-set whenever the viewer
  // picks another zone. The `key` on <Calendar> below forces the remount that
  // makes rbc recompute every day/hour boundary under the new zone.
  const localizer = useMemo(() => {
    moment.tz.setDefault(timezone);
    return momentLocalizer(moment);
  }, [timezone]);

  // Leaving the page restores moment's browser-local default so this page
  // doesn't become the next global-leak offender.
  useEffect(() => {
    moment.tz.setDefault(timezone);
    return () => {
      moment.tz.setDefault();
    };
  }, [timezone]);

  const rbcEvents: RbcEvent[] = useMemo(
    () =>
      events.map((event) => ({
        title: event.title,
        start: new Date(event.start),
        end: new Date(event.end),
        allDay: event.allDay,
        resource: event,
      })),
    [events],
  );

  const scrollToTime = useMemo(() => new Date(2000, 0, 1, 7, 0, 0), []);

  return (
    <Calendar
      key={timezone}
      localizer={localizer}
      events={rbcEvents}
      startAccessor="start"
      endAccessor="end"
      titleAccessor="title"
      views={["month", "week", "day", "agenda"]}
      view={view}
      date={date}
      onView={onView}
      onNavigate={onNavigate}
      onSelectEvent={(event: RbcEvent) => onSelectEvent(event.resource)}
      eventPropGetter={(event: RbcEvent) => {
        const color =
          colorByKey[event.resource.calendarKey] ?? FALLBACK_EVENT_COLOR;
        return {
          style: {
            // The custom property is what actually colors the event: the
            // `.team-calendar` css overrides read it with !important, which
            // is the only way past the appointment theme's !important black
            // in the week/day time grid. The plain properties cover month
            // cells, which have no !important rule.
            "--cal-event-color": color,
            backgroundColor: color,
            borderColor: color,
            color: "#fff",
          } as React.CSSProperties,
        };
      }}
      scrollToTime={scrollToTime}
      messages={{ noEventsInRange: t("calendar.noEvents") }}
      popup
      toolbar
    />
  );
}
