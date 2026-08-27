import type { Lead } from "~/lib/api/leads";
import { formatDateIntl } from "~/lib/utils/format";

/**
 * Appointment info extracted from a lead's metadata.
 *
 * Two shapes exist in the wild:
 * - Form appointment fields: `metadata[key]` = "<startISO>--<endISO>" plus
 *   companion keys `${key}_event_id`, `${key}_meet_link`, `${key}_provider`
 *   merged in after the calendar event is created (best-effort — a failed
 *   booking leaves only the raw slot string).
 * - Standalone Baikal booking-page leads (source_table === "appointment_booking"):
 *   `metadata.appointment_uid` / `.start` / `.end` / `.config_id`.
 */
export type AppointmentProvider =
  | "google"
  | "microsoft"
  | "caldav"
  | "baikal"
  | "unknown";

export interface LeadAppointment {
  /** Metadata key carrying the slot ("appointment", "appointment_2", …). */
  key: string;
  start: Date;
  end: Date | null;
  provider: AppointmentProvider;
  eventId: string | null;
  meetLink: string | null;
  /** false = slot string exists but no calendar event was confirmed. */
  booked: boolean;
  /** Metadata keys this appointment accounts for — hidden from "Additional info". */
  claimedKeys: string[];
}

/** Minimal lead shape so brand-view row types can use these helpers too. */
export type AppointmentLeadLike = Pick<Lead, "id" | "metadata" | "source_table">;

const PROVIDERS: readonly AppointmentProvider[] = [
  "google",
  "microsoft",
  "caldav",
  "baikal",
];

const COMPANION_SUFFIXES = ["_event_id", "_meet_link", "_provider"] as const;

function parseIso(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : new Date(ms);
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function inferProvider(
  lead: AppointmentLeadLike,
  stamped: string | null,
  meetLink: string | null,
  eventId: string | null,
): AppointmentProvider {
  if (stamped && (PROVIDERS as readonly string[]).includes(stamped)) {
    return stamped as AppointmentProvider;
  }
  if (meetLink) {
    if (meetLink.includes("meet.google.com")) return "google";
    if (meetLink.includes("teams.microsoft") || meetLink.includes("teams.live.com")) {
      return "microsoft";
    }
  }
  // CalDAV/Baikal bookings use the lead id as the event UID; Google/Microsoft
  // ids are provider-issued and never equal it.
  if (eventId != null && eventId === lead.id) return "caldav";
  return "unknown";
}

/** All appointments on a lead, sorted by start ascending. [] when none. */
export function extractLeadAppointments(
  lead: AppointmentLeadLike,
): LeadAppointment[] {
  const metadata = lead.metadata;
  if (!metadata || typeof metadata !== "object") return [];
  const meta = metadata as Record<string, unknown>;

  const appointments: LeadAppointment[] = [];

  // Standalone Baikal booking-page leads. Claim start/end/config_id only in
  // this branch — a form field the user happened to name "start" must not
  // get hidden on ordinary form leads.
  if (lead.source_table === "appointment_booking") {
    const start = parseIso(meta.start);
    if (start) {
      appointments.push({
        key: "appointment_uid",
        start,
        end: parseIso(meta.end),
        provider: "baikal",
        eventId: asString(meta.appointment_uid),
        meetLink: null,
        booked: asString(meta.appointment_uid) != null,
        claimedKeys: ["appointment_uid", "start", "end", "config_id"],
      });
    }
  }

  // Form appointment fields — detected by value shape ("ISO--ISO"), so
  // renamed or numbered keys ("appointment_2") are still found while free
  // text containing "--" is rejected by the double-ISO guard.
  for (const [key, value] of Object.entries(meta)) {
    if (typeof value !== "string") continue;
    if (COMPANION_SUFFIXES.some((suffix) => key.endsWith(suffix))) continue;
    const idx = value.indexOf("--");
    if (idx <= 0) continue;
    const start = parseIso(value.slice(0, idx));
    const end = parseIso(value.slice(idx + 2));
    if (!start || !end) continue;

    const eventId = asString(meta[`${key}_event_id`]);
    const meetLink = asString(meta[`${key}_meet_link`]);
    appointments.push({
      key,
      start,
      end,
      provider: inferProvider(lead, asString(meta[`${key}_provider`]), meetLink, eventId),
      eventId,
      meetLink,
      booked: eventId != null,
      claimedKeys: [key, `${key}_event_id`, `${key}_meet_link`, `${key}_provider`],
    });
  }

  return appointments.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** First upcoming appointment, else the most recent past one, else null. */
export function nextLeadAppointment(
  lead: AppointmentLeadLike,
): LeadAppointment | null {
  const appointments = extractLeadAppointments(lead);
  return (
    appointments.find((appt) => !isAppointmentPast(appt)) ??
    appointments.at(-1) ??
    null
  );
}

/** Union of every claimedKeys set — for filtering "Additional info" rows. */
export function appointmentClaimedMetaKeys(
  lead: AppointmentLeadLike,
): Set<string> {
  const keys = new Set<string>();
  for (const appt of extractLeadAppointments(lead)) {
    for (const key of appt.claimedKeys) keys.add(key);
  }
  return keys;
}

export function isAppointmentPast(
  appt: LeadAppointment,
  now: Date = new Date(),
): boolean {
  return (appt.end ?? appt.start).getTime() < now.getTime();
}

/** "Mar 31, 2026, 2:30 PM – 3:00 PM" — locale-aware, viewer's timezone. */
export function formatAppointmentRange(appt: LeadAppointment): string {
  const start = formatDateIntl(appt.start, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  if (!appt.end) return start;
  return `${start} – ${formatDateIntl(appt.end, { timeStyle: "short" })}`;
}
