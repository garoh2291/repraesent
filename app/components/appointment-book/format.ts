import type { Appointment } from "~/lib/api/appointment-book";

/**
 * Times are shown in the appointment's own zone (the calendar's): a viewing at
 * the estate is at 10:00 there, whichever laptop the owner happens to open.
 */

export function timeOf(iso: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date(iso));
}

/** "4:00" + "PM" apart, so a 12-hour clock fits the book's narrow margin. */
export function timeParts(iso: string, timezone: string, locale: string): { time: string; period: string | null } {
  const parts = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit", timeZone: timezone }).formatToParts(
    new Date(iso),
  );
  const period = parts.find((p) => p.type === "dayPeriod")?.value ?? null;
  const time = parts
    .filter((p) => p.type !== "dayPeriod")
    .map((p) => p.value)
    .join("")
    .trim();
  return { time, period };
}

export function timeRange(a: Pick<Appointment, "starts_at" | "ends_at" | "timezone" | "all_day">, locale: string, wholeDay: string): string {
  if (a.all_day) return wholeDay;
  return `${timeOf(a.starts_at, a.timezone, locale)}–${timeOf(a.ends_at, a.timezone, locale)}`;
}

export function dayOf(iso: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function longDate(iso: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: timezone }).format(
    new Date(iso),
  );
}

export function longDateYear(iso: string, timezone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: timezone,
  }).format(new Date(iso));
}

/** Today / Tomorrow / This week / Later — the book's own page breaks. */
export type DayBucket = "today" | "tomorrow" | "week" | "later";

export function bucketOf(iso: string, timezone: string, now = new Date()): DayBucket {
  const day = dayOf(iso, timezone);
  const today = dayOf(now.toISOString(), timezone);
  const tomorrow = dayOf(new Date(now.getTime() + 86_400_000).toISOString(), timezone);
  if (day <= today) return "today";
  if (day === tomorrow) return "tomorrow";
  const weekEnd = dayOf(new Date(now.getTime() + 7 * 86_400_000).toISOString(), timezone);
  return day < weekEnd ? "week" : "later";
}

/** Who the appointment is with, never empty. */
export function whoOf(a: Appointment, fallback: string): string {
  return a.display_name || a.customer_email || a.customer_phone || fallback;
}

/** A `<startISO>--<endISO>` slot → its local start time. */
export function slotStart(slot: string): string {
  return slot.split("--")[0];
}

export function slotEnd(slot: string): string {
  return slot.split("--")[1];
}
