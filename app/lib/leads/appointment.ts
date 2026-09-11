import type { Lead } from "~/lib/api/leads";
import { formatDateIntl } from "~/lib/utils/format";

/**
 * Appointment info extracted from a lead's metadata.
 *
 * Three shapes exist in the wild:
 * - Form appointment fields: `metadata[key]` = "<startISO>--<endISO>" plus
 *   companion keys `${key}_event_id`, `${key}_meet_link`, `${key}_provider`
 *   merged in after the calendar event is created (best-effort — a failed
 *   booking leaves only the raw slot string).
 * - AI-assistant booking actions: the slot lives at `${actionId}_appointment`
 *   but the companions at `${actionId}_event_id` — one segment shorter than the
 *   slot key. See `companionBases`.
 * - Standalone Baikal booking-page leads (source_table === "appointment_booking"):
 *   `metadata.appointment_uid` / `.start` / `.end` / `.config_id`.
 */
export type AppointmentProvider =
  | "google"
  | "microsoft"
  | "caldav"
  | "baikal"
  | "unknown";

/** One co-host of a co-booked appointment. */
export interface LeadAppointmentHost {
  label: string | null;
  eventId: string | null;
}

export interface LeadAppointment {
  /** Metadata key carrying the slot ("appointment", "appointment_2", …). */
  key: string;
  start: Date;
  end: Date | null;
  provider: AppointmentProvider;
  /** The PRIMARY event. Co-hosts, when there are any, are in `hosts`. */
  eventId: string | null;
  /** The one meeting link, shared by every host's event. */
  meetLink: string | null;
  /** false = slot string exists but no calendar event was confirmed. */
  booked: boolean;
  /**
   * Every host's event when this was co-booked, else null. Co-booking is
   * all-or-nothing, so this is either complete or absent — never partial.
   */
  hosts: LeadAppointmentHost[] | null;
  /** A co-booking that was rolled back: the lead is real, no event exists. */
  bookingFailed: boolean;
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

const COMPANION_SUFFIXES = [
  "_event_id",
  "_meet_link",
  "_provider",
  // Co-booking. `_hosts` is a JSON array of every host's event refs; the three
  // keys above keep meaning the PRIMARY, which is why nothing downstream had to
  // change. `_booking_failed` / `_orphaned_events` mark a co-booking that was
  // rolled back — the lead is real and kept, but nothing was put in a calendar.
  "_hosts",
  "_booking_failed",
  "_orphaned_events",
  // AI-assistant bookings only (see companionBases below).
  "_booking_id",
  "_appointment_status",
] as const;

/**
 * The prefixes a slot key's companions may carry.
 *
 * A form appointment field stores the slot under the field key and its
 * companions under `<fieldKey>_event_id`. An AI-assistant booking action stores
 * the slot under `<actionId>_appointment` but its companions under
 * `<actionId>_event_id` — one segment shorter. Claiming only the first shape is
 * why `Abzju9jes Event Id` and friends used to leak into "Additional info".
 */
function companionBases(slotKey: string): string[] {
  const bases = [slotKey];
  const SUFFIX = "_appointment";
  if (slotKey.endsWith(SUFFIX) && slotKey.length > SUFFIX.length) {
    bases.push(slotKey.slice(0, -SUFFIX.length));
  }
  return bases;
}

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

/**
 * The co-host list, or null for a single-host booking.
 *
 * Tolerant on purpose: this is stored JSON written by an older or newer build,
 * and a lead's appointment badge must never be the thing that throws.
 */
function parseHosts(raw: unknown): LeadAppointmentHost[] | null {
  if (typeof raw !== "string" || raw === "") return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const hosts = parsed
      .filter((h): h is Record<string, unknown> => !!h && typeof h === "object")
      .map((h) => ({
        label: asString(h.label),
        eventId: asString(h.eventId),
      }));
    return hosts.length > 0 ? hosts : null;
  } catch {
    return null;
  }
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
        // The standalone booking page has always been one calendar.
        hosts: null,
        bookingFailed: false,
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

    const bases = companionBases(key);
    const companion = (suffix: string): unknown => {
      for (const base of bases) {
        const found = meta[`${base}${suffix}`];
        if (found !== undefined) return found;
      }
      return undefined;
    };

    const eventId = asString(companion("_event_id"));
    const meetLink = asString(companion("_meet_link"));
    const hosts = parseHosts(companion("_hosts"));
    appointments.push({
      key,
      start,
      end,
      provider: inferProvider(lead, asString(companion("_provider")), meetLink, eventId),
      eventId,
      meetLink,
      // Still "is there a primary event", NOT "did every host get one":
      // co-booking is all-or-nothing, so a primary event existing means every
      // host got theirs. A rolled-back co-booking leaves no _event_id at all.
      booked: eventId != null,
      hosts,
      bookingFailed: asString(companion("_booking_failed")) === "1",
      claimedKeys: [
        key,
        ...bases.flatMap((base) =>
          COMPANION_SUFFIXES.map((suffix) => `${base}${suffix}`),
        ),
      ],
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
