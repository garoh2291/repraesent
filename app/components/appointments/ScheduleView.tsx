import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import moment from "moment-timezone";
import { Trash2, Clock, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "~/components/ui/hover-card";
import { Button } from "~/components/ui/button";
import { getAppointmentsByConfigId } from "~/lib/api/appointments";
import { getIntlLocale, formatTime } from "~/lib/utils/format";

/* ── Helpers ────────────────────────────────────────────────────── */

const NEWLINE_REGEX = /\\n|\r?\n/;

function parseBookingNotes(notes: string): Record<string, string> {
  if (!notes?.trim()) return {};
  const lines = notes
    .split(NEWLINE_REGEX)
    .map((s) => s.trim())
    .filter(Boolean);
  const result: Record<string, string> = {};
  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (key && value) result[key] = value;
  }
  return result;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

function formatTimeRange(
  start: Date,
  end: Date,
  timezone: string,
  timeFormat: string,
): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  };
  const s = start.toLocaleTimeString(getIntlLocale(), opts);
  const e = end.toLocaleTimeString(getIntlLocale(), opts);
  return `${s} – ${e}`;
}

function getMonthName(monthIndex: number, style: "long" | "short" = "long"): string {
  const d = new Date(2000, monthIndex, 1);
  return d.toLocaleString(getIntlLocale(), { month: style });
}

const DAY_ABBR = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/* ── Types ──────────────────────────────────────────────────────── */

export interface ScheduleEvent {
  start: Date;
  end: Date;
  title: string;
  notes?: string;
  eventId?: string;
  eventUrl?: string;
}

interface DayGroup {
  date: Date;
  events: ScheduleEvent[];
}

interface MonthGroup {
  year: number;
  month: number;
  label: string;
  days: DayGroup[];
}

const SCHEDULE_MONTH_SPAN = 3;

interface ScheduleViewProps {
  configId: string;
  timezone: string;
  timeFormat: string;
  onDelete?: (event: ScheduleEvent) => void;
}

/* ── Component ──────────────────────────────────────────────────── */

export function ScheduleView({
  configId,
  timezone,
  timeFormat,
  onDelete,
}: ScheduleViewProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Start month of the 3-month window (navigates by 1 month)
  const [startMonth, setStartMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  // Compute the 3-month window boundaries
  const { endMonth, rangeStart, rangeEnd } = useMemo(() => {
    // End month = startMonth + 2
    let eMonth = startMonth.month + SCHEDULE_MONTH_SPAN - 1;
    let eYear = startMonth.year;
    if (eMonth > 11) {
      eYear += Math.floor(eMonth / 12);
      eMonth = eMonth % 12;
    }

    const mStart = moment.tz
      ? moment.tz([startMonth.year, startMonth.month, 1], timezone).subtract(1, "day").startOf("day")
      : moment([startMonth.year, startMonth.month, 1]).subtract(1, "day").startOf("day");
    const mEnd = moment.tz
      ? moment.tz([eYear, eMonth, 1], timezone).endOf("month").add(1, "day").endOf("day")
      : moment([eYear, eMonth, 1]).endOf("month").add(1, "day").endOf("day");

    return {
      endMonth: { year: eYear, month: eMonth },
      rangeStart: mStart.toISOString(),
      rangeEnd: mEnd.toISOString(),
    };
  }, [startMonth, timezone]);

  // Fetch appointments for the 3-month window
  const { data: rawAppointments = [], isLoading, isFetching } = useQuery({
    queryKey: ["schedule-appointments", configId, startMonth.year, startMonth.month, SCHEDULE_MONTH_SPAN],
    queryFn: () => getAppointmentsByConfigId(configId, rangeStart, rangeEnd),
    placeholderData: (prev) => prev,
  });

  // Parse raw appointments into ScheduleEvent[]
  const events: ScheduleEvent[] = useMemo(() => {
    return rawAppointments
      .map((apt: unknown) => {
        const a = apt as Record<string, unknown>;
        const start = new Date(a.start as string);
        const end = new Date(a.end as string);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) return null;
        return {
          start,
          end,
          title: ((a.summary ?? a.notes ?? "Appointment") as string),
          notes: ((a.notes ?? a.description ?? "") as string) || undefined,
          eventId: (a.id as string) || undefined,
          eventUrl: (a.url as string) || undefined,
        };
      })
      .filter(Boolean) as ScheduleEvent[];
  }, [rawAppointments]);

  // Group events by day, then by month
  const monthGroups = useMemo(() => {
    if (events.length === 0) return [];

    const sorted = [...events].sort(
      (a, b) => a.start.getTime() - b.start.getTime(),
    );

    // Group by day
    const dayMap = new Map<string, DayGroup>();
    for (const evt of sorted) {
      const key = `${evt.start.getFullYear()}-${evt.start.getMonth()}-${evt.start.getDate()}`;
      if (!dayMap.has(key)) {
        dayMap.set(key, {
          date: new Date(
            evt.start.getFullYear(),
            evt.start.getMonth(),
            evt.start.getDate(),
          ),
          events: [],
        });
      }
      dayMap.get(key)!.events.push(evt);
    }

    // Group days by month
    const mMap = new Map<string, MonthGroup>();
    for (const day of dayMap.values()) {
      const mKey = `${day.date.getFullYear()}-${day.date.getMonth()}`;
      if (!mMap.has(mKey)) {
        mMap.set(mKey, {
          year: day.date.getFullYear(),
          month: day.date.getMonth(),
          label: getMonthName(day.date.getMonth()),
          days: [],
        });
      }
      mMap.get(mKey)!.days.push(day);
    }

    const result = Array.from(mMap.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.month - b.month;
    });
    for (const mg of result) {
      mg.days.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    return result;
  }, [events]);

  const navigatePrev = useCallback(() => {
    setStartMonth((prev) => {
      const m = prev.month - 1;
      return m < 0
        ? { year: prev.year - 1, month: 11 }
        : { year: prev.year, month: m };
    });
  }, []);

  const navigateNext = useCallback(() => {
    setStartMonth((prev) => {
      const m = prev.month + 1;
      return m > 11
        ? { year: prev.year + 1, month: 0 }
        : { year: prev.year, month: m };
    });
  }, []);

  const navigateToday = useCallback(() => {
    const now = new Date();
    setStartMonth({ year: now.getFullYear(), month: now.getMonth() });
  }, []);

  // Header label: "Mar – May 2026" or "Nov 2025 – Jan 2026"
  const headerLabel = useMemo(() => {
    const sAbbr = getMonthName(startMonth.month, "short");
    const eAbbr = getMonthName(endMonth.month, "short");
    if (startMonth.year === endMonth.year) {
      return `${sAbbr} – ${eAbbr} ${startMonth.year}`;
    }
    return `${sAbbr} ${startMonth.year} – ${eAbbr} ${endMonth.year}`;
  }, [startMonth, endMonth]);

  const now = new Date();
  const isCurrentMonth =
    startMonth.year === now.getFullYear() &&
    startMonth.month === now.getMonth();

  const hasEvents = monthGroups.length > 0;

  return (
    <div className="schedule-view bg-card rounded-2xl border border-border overflow-hidden">
      {/* ── Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-border bg-card">
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={navigateToday}
            className={`text-xs font-medium h-7 px-2.5 ${isCurrentMonth ? "opacity-40 pointer-events-none" : ""}`}
          >
            {t("appointments.schedule.today", "Today")}
          </Button>
          <button
            type="button"
            onClick={navigatePrev}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={navigateNext}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <span className="text-sm sm:text-[0.9375rem] font-semibold text-foreground tracking-tight">
          {headerLabel}
        </span>
        <div className="w-8 sm:w-20" />
      </div>

      {/* ── Event List ───────────────────────────────────────── */}
      <div ref={scrollRef} className="relative">
        {/* Subtle loading bar */}
        {isFetching && (
          <div className="absolute top-0 left-0 right-0 z-20 h-0.5 overflow-hidden">
            <div className="h-full w-full bg-primary/40 animate-pulse" />
          </div>
        )}
        {isLoading && !hasEvents ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("appointments.schedule.loading", "Loading appointments...")}
          </div>
        ) : !hasEvents ? (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
            {t(
              "appointments.schedule.noEventsMonth",
              "No appointments this month",
            )}
          </div>
        ) : (
          <div className={`transition-opacity duration-150 ${isFetching ? "opacity-60" : "opacity-100"}`}>
            {monthGroups.map((mg) => (
              <div key={`${mg.year}-${mg.month}`}>
                {/* Month header */}
                <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/50">
                  <div className="px-3 sm:px-4 py-1.5">
                    <span className="text-[0.6875rem] font-bold text-muted-foreground uppercase tracking-widest">
                      {mg.label}
                    </span>
                  </div>
                </div>

                {mg.days.map((day) => {
                  const today = isToday(day.date);
                  return (
                    <div
                      key={day.date.toISOString()}
                      className="schedule-day-row"
                    >
                      <div className="border-b border-border/40" />

                      <div className="flex min-h-[40px]">
                        {/* ── Day gutter ─────────────────────── */}
                        <div className="shrink-0 w-[60px] sm:w-[72px] flex items-start pt-2 pb-2 pl-3 sm:pl-4">
                          <div className="flex flex-col items-center">
                            <span
                              className={`
                                text-base sm:text-lg leading-none font-semibold tabular-nums
                                ${today ? "schedule-today-number" : "text-foreground"}
                              `}
                            >
                              {day.date.getDate()}
                            </span>
                            <span
                              className={`
                                text-[0.5625rem] sm:text-[0.625rem] font-bold uppercase tracking-wider mt-0.5
                                ${today ? "text-primary" : "text-muted-foreground/60"}
                              `}
                            >
                              {DAY_ABBR[day.date.getDay()]}
                            </span>
                          </div>
                        </div>

                        {/* ── Events column ───────────────────── */}
                        <div className="flex-1 py-1.5 pr-3 sm:pr-4 space-y-0">
                          {day.events.map((evt, i) => (
                            <ScheduleEventRow
                              key={evt.eventId ?? `${evt.start.toISOString()}-${i}`}
                              event={evt}
                              timezone={timezone}
                              timeFormat={timeFormat}
                              onDelete={onDelete}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  );
}

/* ── Single Event Row ───────────────────────────────────────────── */

function ScheduleEventRow({
  event,
  timezone,
  timeFormat,
  onDelete,
}: {
  event: ScheduleEvent;
  timezone: string;
  timeFormat: string;
  onDelete?: (event: ScheduleEvent) => void;
}) {
  const { t } = useTranslation();
  const parsed = event.notes ? parseBookingNotes(event.notes) : {};
  const timeRange = formatTimeRange(event.start, event.end, timezone, timeFormat);

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div
          className="
            group
            flex items-center gap-2.5 px-2 py-1.5 -mx-1 rounded-md
            cursor-default
            transition-colors duration-100
            hover:bg-muted/50
          "
        >
          {/* Dot indicator */}
          <div className="shrink-0 w-2 h-2 rounded-full bg-primary" />

          {/* Time */}
          <span className="shrink-0 text-xs sm:text-[0.8125rem] text-muted-foreground font-medium tabular-nums min-w-[100px] sm:min-w-[120px]">
            {timeRange}
          </span>

          {/* Title */}
          <span className="text-sm sm:text-[0.8125rem] font-medium text-foreground truncate">
            {event.title || t("appointments.calendar.appointment")}
          </span>

          {/* Delete button (visible on hover) */}
          {event.eventUrl && onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(event);
              }}
              className="
                shrink-0 ml-auto rounded-md p-1.5
                text-muted-foreground/0 group-hover:text-muted-foreground
                hover:!text-destructive hover:bg-destructive/10
                transition-colors
              "
              title={t(
                "appointments.calendar.deleteAppointment",
                "Delete appointment",
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </HoverCardTrigger>

      <HoverCardContent side="top" className="w-80">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium">
              {event.title || t("appointments.calendar.appointment")}
            </p>
            {event.eventUrl && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(event);
                }}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title={t(
                  "appointments.calendar.deleteAppointment",
                  "Delete appointment",
                )}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            {timeRange}
          </div>
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
          ) : event.notes ? (
            <p className="text-sm text-muted-foreground border-t pt-3">
              {event.notes}
            </p>
          ) : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
