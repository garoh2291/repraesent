import { useMemo } from "react";
import { nativeTargetPatch } from "~/components/appointment-book/native-target";
import { useAppointmentCalendars } from "~/lib/hooks/useAppointmentBook";
import type { FormDefinition } from "~/lib/forms/schema";

/**
 * The builder's stand-in for what the server does for a visitor: give every
 * service of an appointment field the picker rules of ITS calendar.
 *
 * `services[].rules` is never stored (the live form reads the calendar at
 * request time), so without this every service card in the preview would show
 * the first calendar's length. Only Repraesent calendars are filled in; a
 * connected calendar's service reads the field's own settings, as it does live.
 *
 * Preview only: what comes out of here is never saved.
 */
export function usePreviewServiceRules(definition: FormDefinition): FormDefinition {
  const needed = (definition.sections ?? []).some((s) =>
    (s.fields ?? []).some((f) =>
      (f.appointment?.services ?? []).some((svc) =>
        svc.targetKey.startsWith("repraesent:"),
      ),
    ),
  );
  const calendars = useAppointmentCalendars(needed).data;

  return useMemo(() => {
    if (!needed || !calendars || calendars.length === 0) return definition;
    const byKey = new Map(calendars.map((c) => [c.key, c]));
    return {
      ...definition,
      sections: (definition.sections ?? []).map((section) => ({
        ...section,
        fields: (section.fields ?? []).map((field) => {
          const ap = field.appointment;
          if (!ap?.services?.length) return field;
          return {
            ...field,
            appointment: {
              ...ap,
              services: ap.services.map((service) => {
                const calendar = byKey.get(service.targetKey);
                if (!calendar) return service;
                const rules = nativeTargetPatch(calendar);
                return {
                  ...service,
                  rules: {
                    durationMinutes: rules.durationMinutes,
                    window: rules.window,
                    weekdays: rules.weekdays,
                    timezone: rules.timezone,
                    minNoticeHours: rules.minNoticeHours,
                    maxDaysAhead: rules.maxDaysAhead,
                    ...(calendar.booking_unit === "day" ? { wholeDay: true } : {}),
                  },
                };
              }),
            },
          };
        }),
      })),
    };
  }, [definition, calendars, needed]);
}
