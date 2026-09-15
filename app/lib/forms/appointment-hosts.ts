/**
 * The browser's rules for an appointment field's host list.
 *
 * This file exists because `patchHosts` used to live inline in BOTH builder
 * panels, identically — and so did the bug in it: a single host's details were
 * thrown away on every keystroke, in two places at once. Anything that decides
 * what a host list MEANS belongs here, so there is one copy to be wrong.
 *
 * The backend's authority on the same question is
 * `nestjs-monolith/src/modules/google-calendar/appointment-target.util.ts`.
 * This is deliberately NOT a port of it: that module parses keys (it has to,
 * for provider dispatch), and shipping a second key parser to the browser is
 * the exact drift it was created to end. Here we only ever compare and reorder
 * keys the browser itself produced via `calendarKeyFor`.
 *
 * ── The model ──────────────────────────────────────────────────────────────
 *
 * A host is a CALENDAR plus an optional PERSON.
 *
 *   calendar + member  → booked, and the visitor is told who they are meeting
 *   calendar, no member → booked, and the visitor is told nothing
 *
 * The second case is a meeting room, a shared inbox, a calendar that exists to
 * hold the slot. It must still block time and still receive the event; it just
 * has no name worth showing on a public page.
 */

import type { AppointmentHost } from "~/lib/forms/schema";

/**
 * The subset of an appointment config these rules read.
 *
 * Structural on purpose: `FormField["appointment"]` and the assistant's
 * `ActionAppointmentSettings` are separate declarations that both satisfy it,
 * so neither builder has to convert anything.
 */
export interface AppointmentTargetish {
  targetKey?: string;
  accountId?: string;
  calendarId?: string;
  hosts?: AppointmentHost[];
}

/**
 * The primary calendar: `hosts[0]`, else `targetKey`, else the legacy Google
 * pair. Same precedence the backend resolver applies.
 */
export function primaryTargetKeyOf(
  ap: AppointmentTargetish,
): string | undefined {
  const first = ap.hosts?.[0]?.targetKey;
  if (first) return first;
  if (ap.targetKey) return ap.targetKey;
  if (ap.accountId && ap.calendarId) {
    return `google:${ap.accountId}:${ap.calendarId}`;
  }
  return undefined;
}

/**
 * The rows the BUILDER shows.
 *
 * Derived rather than materialised: writing `hosts` onto a field the user has
 * merely opened would mark every old form dirty for nothing. `hosts` starts
 * existing only when an actual edit puts something in it.
 */
export function derivedHosts(ap: AppointmentTargetish): AppointmentHost[] {
  if (ap.hosts && ap.hosts.length > 0) return ap.hosts;
  const primary = primaryTargetKeyOf(ap);
  return primary ? [{ targetKey: primary }] : [];
}

/**
 * Does this list carry anything a plain `targetKey` cannot?
 *
 * If not, it is stored as a bare `targetKey` and a one-calendar field stays
 * byte-identical to what it was before co-booking existed.
 *
 * `label` counts as well as `userId`, so a name typed by hand before hosts
 * became member-backed is not silently dropped the next time the field is
 * touched.
 */
export function hostsCarryInfo(hosts: AppointmentHost[]): boolean {
  return (
    hosts.length > 1 || hosts.some((h) => !!h.userId || !!h.label || !!h.email)
  );
}

/**
 * The hosts the VISITOR sees: the ones with a name, deduped by person.
 *
 * Deduped because two calendars can belong to one human — booking both of
 * Vache's calendars is legitimate, rendering "Vache · Vache" is not.
 *
 * Order is preserved, and an unnamed host is skipped rather than suppressing
 * the others. That is what keeps this rule ADDITIVE: adding a room calendar to
 * a live two-host form must never make the two existing names disappear from a
 * page that was already published.
 */
export function visibleHosts(
  hosts: AppointmentHost[] | undefined,
): AppointmentHost[] {
  const out: AppointmentHost[] = [];
  const seen = new Set<string>();
  for (const host of hosts ?? []) {
    if (!host?.label?.trim()) continue;
    // Two rows for the same person collapse; two rows for two people with the
    // same typed name do not (they have different ids).
    const identity = host.userId ?? `label:${host.label.trim()}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    out.push(host);
  }
  return out;
}

/**
 * THE only shape allowed to be written to an appointment's host list.
 *
 * Two invariants live here and nowhere else:
 *
 *   `targetKey`            mirrors `hosts[0].targetKey`
 *   `accountId`/`calendarId` mirror `targetKey` when it is a Google key
 *
 * They are what lets a backend that predates co-booking read this definition
 * and book the primary instead of nothing.
 *
 * `accountId`/`calendarId` are REQUIRED in the return type, `""` for a
 * non-Google primary — that empty string is what clears a stale legacy pair
 * when a field moves to a Baikal or CalDAV target. A `Partial` here would let
 * a later edit quietly skip the reset and leave a form pointing at two
 * different calendars depending on which reader you ask.
 */
export function hostsPatch(next: AppointmentHost[]): {
  hosts: AppointmentHost[] | undefined;
  targetKey: string | undefined;
  accountId: string;
  calendarId: string;
} {
  const primary = next[0]?.targetKey ?? "";

  let accountId = "";
  let calendarId = "";
  if (primary.startsWith("google:")) {
    const rest = primary.slice("google:".length);
    const sep = rest.indexOf(":");
    if (sep > 0) {
      accountId = rest.slice(0, sep);
      calendarId = rest.slice(sep + 1);
    }
  }

  return {
    hosts: hostsCarryInfo(next) ? next : undefined,
    targetKey: primary || undefined,
    accountId,
    calendarId,
  };
}

/**
 * The singular host fields the AI assistant still writes, mirrored from
 * `hosts[0]` — the same trick `targetKey` plays.
 *
 * The assistant's widget card, its invite mail and its prompt all read
 * `hostName`/`hostEmail`/`hostAvatarUrl`, and none of them needs to learn what
 * a host list is. Keeping them in step here means the assistant needed no
 * second host control once every row gained a member picker.
 */
export function primaryHostMirror(next: AppointmentHost[]): {
  hostUserId: string | undefined;
  hostName: string | undefined;
  hostAvatarUrl: string | undefined;
  hostEmail: string | undefined;
} {
  const primary = next[0];
  return {
    hostUserId: primary?.userId,
    hostName: primary?.label,
    hostAvatarUrl: primary?.avatarUrl,
    hostEmail: primary?.email,
  };
}
