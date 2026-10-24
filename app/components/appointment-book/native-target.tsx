import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Segmented } from "~/components/notebook/segmented";
import { WEEKDAYS, type AppointmentCalendar } from "~/lib/api/appointment-book";
import { useAppointmentCalendars } from "~/lib/hooks/useAppointmentBook";
import { CalendarDot } from "./appointment-bits";

/**
 * Where a form field or a chat booking action books into: one of your
 * Repraesent calendars, or a connected Google / Microsoft / CalDAV one.
 * Shared by the form builder and the AI assistant's booking action, which
 * write the same settings shape.
 */

export function isNativeKey(key: string | undefined | null): boolean {
  return !!key && key.startsWith("repraesent:");
}

/**
 * The settings a Repraesent calendar decides, copied onto the field so the
 * builder's preview looks right. The live form reads them from the calendar
 * at request time (nestjs-monolith forms/native-appointment-rules.ts), so a
 * calendar edited later can never be contradicted by this copy.
 */
export function nativeTargetPatch(calendar: AppointmentCalendar) {
  const open = WEEKDAYS.filter((d) => (calendar.weekly_hours[d] ?? []).length > 0);
  const starts = open.flatMap((d) => calendar.weekly_hours[d].map((r) => r.start)).sort();
  const ends = open.flatMap((d) => calendar.weekly_hours[d].map((r) => r.end)).sort();
  return {
    // A single host is stored as a bare targetKey (lib/forms/appointment-hosts.ts).
    hosts: undefined,
    targetKey: calendar.key,
    accountId: "",
    calendarId: "",
    // A Repraesent calendar already blocks its own appointments; its other
    // busy sources live on the calendar, not on the field.
    busyCalendarKeys: [] as string[],
    timezone: calendar.timezone,
    durationMinutes: calendar.booking_unit === "day" ? 1440 : calendar.duration_minutes,
    weekdays: [...open],
    window: { start: starts[0] ?? "09:00", end: ends[ends.length - 1] ?? "17:00" },
    minNoticeHours: calendar.min_notice_hours,
    maxDaysAhead: calendar.max_days_ahead,
  };
}

export function TargetKindSwitch({
  native,
  onChange,
  disabled,
}: {
  native: boolean;
  onChange: (native: boolean) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{t("appointmentBook.target.label", "Where bookings go")}</p>
      <Segmented
        label={t("appointmentBook.target.label", "Where bookings go")}
        value={native ? "native" : "connected"}
        onChange={(v) => !disabled && onChange(v === "native")}
        stretch
        // Long German labels wrap on phones instead of running off the sheet.
        className="max-sm:[&>button]:whitespace-normal max-sm:[&>button]:py-1.5 max-sm:[&>button]:leading-tight"
        options={[
          { value: "native", label: t("appointmentBook.target.native", "Repraesent calendar") },
          { value: "connected", label: t("appointmentBook.target.connected", "Connected calendar") },
        ]}
      />
    </div>
  );
}

export function NativeCalendarPicker({
  targetKey,
  onPick,
  disabled,
}: {
  targetKey: string | undefined;
  onPick: (calendar: AppointmentCalendar) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const calendars = useAppointmentCalendars();
  const list = calendars.data ?? [];
  const current = list.find((c) => c.key === targetKey) ?? null;
  return (
    <div className="space-y-2">
      <Select
        disabled={disabled || calendars.isLoading}
        value={current?.key ?? ""}
        onValueChange={(key) => {
          const picked = list.find((c) => c.key === key);
          if (picked) onPick(picked);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={t("appointmentBook.target.pick", "Pick a calendar")} />
        </SelectTrigger>
        <SelectContent>
          {list.map((c) => (
            <SelectItem key={c.key} value={c.key}>
              <span className="inline-flex items-center gap-2">
                <CalendarDot color={c.color} />
                {c.name}
                {c.status === "disabled" ? (
                  <span className="text-muted-foreground">· {t("appointmentBook.calendars.off", "Turned off")}</span>
                ) : null}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {current ? (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t("appointmentBook.target.rulesFrom", "Days, hours, length and rules come from “{{name}}”.", { name: current.name })}{" "}
          <Link
            to={`/appointments/calendars/${current.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
          >
            {t("appointmentBook.target.edit", "Change them")}
            <ExternalLink className="size-3" aria-hidden />
          </Link>
          {current.status === "disabled" ? (
            <span className="block text-overdue">
              {t("appointmentBook.target.off", "This calendar is turned off, so visitors will see no times.")}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {t("appointmentBook.target.hint", "Bookings land in Appointments, linked to the inquiry.")}
        </p>
      )}
    </div>
  );
}
