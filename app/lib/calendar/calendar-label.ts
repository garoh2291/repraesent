import type { CalendarAccount } from "~/lib/api/calendar";

/**
 * How one connected calendar is named everywhere you pick or see it.
 *
 * The calendar's own name first. A CalDAV server often calls its only
 * calendar "Default calendar" (or has no name at all, and we fall back to the
 * last part of its address) — then the account's name says which one it is:
 * "The Amara Estate", not the name of whoever connected it.
 *
 * `detail` says where it lives: the account's name or address, plus the team
 * member only when it is someone else's calendar.
 */
export function calendarLabel(
  account: Pick<CalendarAccount, "display_name" | "google_email" | "user_name" | "is_own"> & {
    provider?: CalendarAccount["provider"];
  },
  calendar: { id: string; summary?: string | null },
): { name: string; detail: string; full: string } {
  // Google / Microsoft: the address IS the account (display_name is just the
  // person's profile name). CalDAV: the name typed when connecting it.
  const email = account.google_email?.trim() || "";
  const accountName =
    account.provider === "caldav" ? account.display_name?.trim() || email : email || account.display_name?.trim() || "";
  const summary = calendar.summary?.trim() || "";
  const name = isGenericCalendarName(summary, calendar.id) ? accountName || summary || calendar.id : summary;

  const where: string[] = [];
  if (accountName && accountName !== name) where.push(accountName);
  if (email && email !== accountName && email !== name) where.push(email);
  if (!account.is_own && account.user_name) where.push(account.user_name);
  const detail = where.join(" · ");
  return { name, detail, full: detail ? `${name} · ${detail}` : name };
}

const GENERIC = new Set(["default calendar", "default", "calendar", "kalender", "standardkalender", "personal", "home"]);

/** A name that tells nobody which calendar this is. */
export function isGenericCalendarName(summary: string, id: string): boolean {
  const s = summary.trim().toLowerCase();
  if (!s) return true;
  if (GENERIC.has(s)) return true;
  // The last path segment of a CalDAV address, used when the server has no name.
  const tail = decodeURIComponent(id.replace(/\/+$/, "").split("/").pop() ?? "").toLowerCase();
  return !!tail && s === tail && /^https?:/i.test(id);
}
