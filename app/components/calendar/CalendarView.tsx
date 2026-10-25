import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar, momentLocalizer } from "react-big-calendar";
import type { Event, Formats, View } from "react-big-calendar";
import moment from "moment-timezone";
import { normalizeLocale } from "~/i18n/locales";
import { CalDavIcon } from "~/components/icons/CalDavIcon";
import { GoogleIcon } from "~/components/icons/GoogleIcon";
import type { UnifiedCalendarEvent } from "~/lib/api/calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

/** Events without a color mapping still need to look like events. */
const FALLBACK_EVENT_COLOR = "#64748b";

type RbcEvent = Event & { resource: UnifiedCalendarEvent };

/**
 * Event content with a provider marker: Google events carry the "G" and
 * CalDAV events the CalDAV calendar mark, so same-coloured calendars from
 * different providers stay tellable. One component serves month, week, day
 * and agenda alike.
 */
function EventContent({ event }: { event: RbcEvent }) {
  const key = event.resource.calendarKey;
  return (
    <span className="inline-flex max-w-full items-center gap-1 align-middle">
      {key.startsWith("google:") && (
        <GoogleIcon className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-white/90 p-px" />
      )}
      {/* Baikal is CalDAV under the hood — same mark for both. */}
      {(key.startsWith("caldav:") || key.startsWith("baikal:")) && (
        <CalDavIcon className="h-2.5 w-2.5 shrink-0 rounded-[2px] bg-white/90 p-px" />
      )}
      <span className="min-w-0 truncate">{event.title}</span>
    </span>
  );
}

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
  /**
   * Click or drag on an empty time to create something there (the
   * appointments calendar). Omitted = read-only, as on the team calendar.
   */
  onSelectSlot?: (start: Date) => void;
}

/**
 * Day names, month names and times in the app language, in the display zone.
 * Done with Intl instead of moment's locale files: Vite bundles those against
 * a different moment copy than moment-timezone, so they never take effect.
 */
function calendarFormats(culture: string, timezone: string, compact: boolean): Formats {
  const tag = culture === "en" ? "en-US" : culture;
  const fmt = (options: Intl.DateTimeFormatOptions) => {
    const f = new Intl.DateTimeFormat(tag, { timeZone: timezone, ...options });
    return (d: Date) => f.format(d);
  };
  const time = fmt({ hour: culture === "en" ? "numeric" : "2-digit", minute: "2-digit" });
  const range = ({ start, end }: { start: Date; end: Date }) => `${time(start)} – ${time(end)}`;
  const dayMonth = fmt({ day: "numeric", month: "short" });
  return {
    // Phones: the hour column stays narrow — "10 AM" / "10:00".
    timeGutterFormat: compact
      ? fmt(culture === "en" ? { hour: "numeric" } : { hour: "2-digit", minute: "2-digit" })
      : time,
    eventTimeRangeFormat: range,
    eventTimeRangeStartFormat: ({ start }) => `${time(start)} –`,
    eventTimeRangeEndFormat: ({ end }) => `– ${time(end)}`,
    selectRangeFormat: range,
    agendaTimeFormat: time,
    agendaTimeRangeFormat: range,
    dayFormat: fmt({ weekday: "short", day: "numeric" }),
    weekdayFormat: fmt({ weekday: "short" }),
    dateFormat: fmt({ day: "numeric" }),
    dayHeaderFormat: fmt({ weekday: "long", day: "numeric", month: "long" }),
    dayRangeHeaderFormat: ({ start, end }) => `${dayMonth(start)} – ${dayMonth(end)}`,
    monthHeaderFormat: fmt({ month: "long", year: "numeric" }),
    agendaHeaderFormat: ({ start, end }) => `${dayMonth(start)} – ${dayMonth(end)}`,
    agendaDateFormat: fmt({ weekday: "short", day: "numeric", month: "short" }),
  };
}

/** Weeks start on Monday outside English; only the week rule is needed. */
for (const code of ["de", "fr", "nl"]) {
  if (!moment.locales().includes(code)) {
    moment.defineLocale(code, { parentLocale: "en", week: { dow: 1, doy: 4 } });
  }
}
moment.locale("en");

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
  onSelectSlot,
}: CalendarViewProps) {
  const { t, i18n } = useTranslation();
  // Day and month names, the week start and 24h times follow the app language.
  const culture = normalizeLocale(i18n.language);

  // momentLocalizer reads moment's global default at format time, so the
  // default must be set before rbc renders — and re-set whenever the viewer
  // picks another zone. The `key` on <Calendar> below forces the remount that
  // makes rbc recompute every day/hour boundary under the new zone.
  // Measured once after mount (SSR renders the wide labels); the `key` below
  // remounts rbc so it re-measures the gutter for the shorter labels.
  const [compact, setCompact] = useState(false);
  useEffect(() => setCompact(window.matchMedia("(max-width: 639px)").matches), []);
  const formats = useMemo(() => calendarFormats(culture, timezone, compact), [culture, timezone, compact]);
  const localizer = useMemo(() => {
    moment.tz.setDefault(timezone);
    // rbc's week view reads the week start from moment's global locale; ours
    // only differ from English in that rule, so nothing else is reformatted.
    moment.locale(culture);
    return momentLocalizer(moment);
  }, [timezone, culture]);

  // Leaving the page restores moment's browser-local default so this page
  // doesn't become the next global-leak offender.
  useEffect(() => {
    moment.tz.setDefault(timezone);
    moment.locale(culture);
    return () => {
      moment.tz.setDefault();
      moment.locale("en");
    };
  }, [timezone, culture]);

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
      key={`${timezone}:${culture}:${compact ? "c" : "w"}`}
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
      selectable={onSelectSlot ? true : undefined}
      onSelectSlot={onSelectSlot ? (slot: { start: Date }) => onSelectSlot(slot.start) : undefined}
      eventPropGetter={(event: RbcEvent) => {
        const color =
          colorByKey[event.resource.calendarKey] ?? FALLBACK_EVENT_COLOR;
        const rsvp = event.resource.rsvp;
        const pending = rsvp === "needsAction" || rsvp === "tentative";

        return {
          // Google-style RSVP looks, styled in app.css: pending = outlined,
          // declined = faded + struck. Class-based so the 4-class selectors
          // out-specify the theme's 3-class !important rules in every view.
          className:
            rsvp === "declined"
              ? "cal-rsvp-declined"
              : pending
                ? "cal-rsvp-pending"
                : undefined,
          // The custom property is what actually colors the event: the
          // `.team-calendar` css overrides read it with !important, which is
          // the only way past the appointment theme's !important black in the
          // week/day time grid. The plain properties cover month cells, which
          // have no !important rule. Record type because CSSProperties has no
          // index signature for custom properties.
          style: Object.assign(
            { "--cal-event-color": color, borderColor: color },
            pending
              ? {
                  backgroundColor: "var(--background)",
                  color,
                  boxShadow: `inset 0 0 0 1.5px ${color}`,
                }
              : { backgroundColor: color, color: "#fff" },
          ) as React.CSSProperties,
        };
      }}
      components={{ event: EventContent }}
      scrollToTime={scrollToTime}
      culture={culture}
      formats={formats}
      messages={{
        noEventsInRange: t("calendar.noEvents"),
        today: t("calendarView.today", "Today"),
        previous: t("calendarView.previous", "Back"),
        next: t("calendarView.next", "Next"),
        month: t("calendarView.month", "Month"),
        week: t("calendarView.week", "Week"),
        day: t("calendarView.day", "Day"),
        agenda: t("calendarView.agenda", "List"),
        date: t("calendarView.date", "Date"),
        time: t("calendarView.time", "Time"),
        event: t("calendarView.event", "What"),
        allDay: t("calendarView.allDay", "All day"),
        showMore: (count: number) => t("calendarView.showMore", "+{{count}} more", { count }),
      }}
      popup
      toolbar
    />
  );
}
