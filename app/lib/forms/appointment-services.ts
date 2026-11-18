/**
 * The browser's rules for an appointment field's SERVICES.
 *
 * A field may offer several services, each booking its own calendar. The
 * server's authority on what a picked service means is
 * `nestjs-monolith/src/modules/forms/appointment-services.ts`; this file only
 * decides what the BUILDER may write.
 *
 * ── The one invariant ──────────────────────────────────────────────────────
 *
 *   field-level `targetKey` / `hosts` (and the legacy Google pair)
 *   mirror `services[0]`
 *
 * A runtime that predates services — a pasted snippet, a cached embed.js —
 * sends no service id and draws its times from the field-level calendar. The
 * server books `services[0]` for it. The mirror is what makes those two the
 * same calendar. Never write `services` except through `servicesPatch`.
 */

import {
  hostsPatch,
  primaryTargetKeyOf,
  type AppointmentTargetish,
} from "~/lib/forms/appointment-hosts";
import type {
  AppointmentHost,
  AppointmentService,
  FormField,
} from "~/lib/forms/schema";

type Appointment = NonNullable<FormField["appointment"]>;

/** "sv_" + 8 hex. Stable for the life of the service: content keys hang off it. */
export function newServiceId(): string {
  let hex = "";
  for (let i = 0; i < 8; i++) hex += Math.floor(Math.random() * 16).toString(16);
  return `sv_${hex}`;
}

/** The field's current calendar (and hosts) as its first service. */
export function serviceFromField(ap: AppointmentTargetish): AppointmentService {
  return {
    id: newServiceId(),
    targetKey: primaryTargetKeyOf(ap) ?? "",
    ...(ap.hosts && ap.hosts.length > 0 ? { hosts: ap.hosts } : {}),
  };
}

/** The hosts a service books, `[primary, …]`; empty when it has no calendar. */
export function serviceHosts(service: AppointmentService): AppointmentHost[] {
  if (service.hosts && service.hosts.length > 0) return service.hosts;
  return service.targetKey ? [{ targetKey: service.targetKey }] : [];
}

/**
 * THE only shape allowed to be written to `appointment.services`.
 *
 * `[]` switches services off: the list is dropped and the field keeps the
 * calendar it was mirroring, so nothing a visitor could book changes.
 */
export function servicesPatch(next: AppointmentService[]): Partial<Appointment> {
  if (next.length === 0) return { services: undefined };
  const clean = next.map((service) => {
    // `rules` is render-time data from the server; never written back.
    const { rules: _rules, ...rest } = service;
    void _rules;
    return rest;
  });
  return { services: clean, ...hostsPatch(serviceHosts(clean[0])) };
}

/**
 * The field as ONE service's calendar editor should see it: the field's
 * shared settings, with that service's calendar and hosts.
 */
export function fieldForService(
  field: FormField,
  ap: Appointment,
  service: AppointmentService,
): FormField {
  const { services: _services, display: _display, ...rest } = ap;
  void _services;
  void _display;
  return {
    ...field,
    appointment: { ...rest, ...hostsPatch(serviceHosts(service)) },
  };
}

/** A service with the calendar an editor just wrote for it. */
export function withServiceTarget(
  service: AppointmentService,
  edited: AppointmentTargetish,
): AppointmentService {
  const hosts = edited.hosts && edited.hosts.length > 0 ? edited.hosts : undefined;
  return {
    id: service.id,
    targetKey: hosts?.[0]?.targetKey ?? edited.targetKey ?? "",
    ...(hosts ? { hosts } : {}),
  };
}

/**
 * The settings every CONNECTED-calendar service shares, kept on the field. A
 * Repraesent calendar ignores them: its own hours and length rule.
 */
export const SHARED_RULE_KEYS = [
  "busyCalendarKeys",
  "durationMinutes",
  "window",
  "weekdays",
  "timezone",
  "minNoticeHours",
  "maxDaysAhead",
  "hostPolicy",
] as const;

export function pickSharedRules(ap: Partial<Appointment>): Partial<Appointment> {
  const out: Record<string, unknown> = {};
  for (const key of SHARED_RULE_KEYS) {
    if (key in ap) out[key] = ap[key];
  }
  return out as Partial<Appointment>;
}
