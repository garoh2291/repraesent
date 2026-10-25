import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fromZonedTime } from "date-fns-tz";
import { cn } from "~/lib/utils";
import { DayField } from "~/components/notebook/day-field";
import { Input } from "~/components/ui/input";
import { useAuthContext } from "~/providers/auth-provider";
import {
  appointmentKeys,
  getCalendarSlots,
  type AppointmentCalendar,
} from "~/lib/api/appointment-book";
import { timeOf } from "./format";

export interface PickedTime {
  starts_at: string;
  ends_at: string;
  /** Picked outside the calendar's free times: staff only, the API asks to confirm. */
  override: boolean;
}

/**
 * Day, then a free time from the calendar — the same answer the website form
 * and the chat get. "Other time…" lets the team write in any time (a visit
 * agreed on the phone), which then books past the hours on purpose.
 */
export function SlotPicker({
  calendar,
  day,
  onDayChange,
  value,
  onChange,
  fetchSlots,
  excludeAppointmentId,
}: {
  calendar: AppointmentCalendar;
  /** yyyy-MM-dd */
  day: string;
  onDayChange: (day: string) => void;
  value: PickedTime | null;
  onChange: (value: PickedTime | null) => void;
  /** Override the slot source (the customer's public page). */
  fetchSlots?: (date: string) => Promise<{ slots: string[]; unavailable: boolean }>;
  /** Moving an appointment: it must not block its own new time. */
  excludeAppointmentId?: string;
}) {
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [manual, setManual] = useState(false);
  const [manualTime, setManualTime] = useState("10:00");
  const wholeDay = calendar.booking_unit === "day";

  const slots = useQuery({
    queryKey: fetchSlots
      ? ["appointment-public-slots", calendar.id, day]
      : [...appointmentKeys.slots(currentWorkspace?.id, calendar.id, day), excludeAppointmentId ?? ""],
    queryFn: () => (fetchSlots ? fetchSlots(day) : getCalendarSlots(calendar.id, day, excludeAppointmentId)),
    enabled: !!day,
  });

  const applyManual = (time: string) => {
    setManualTime(time);
    if (!/^\d{2}:\d{2}$/.test(time)) return onChange(null);
    const start = fromZonedTime(`${day}T${time}:00`, calendar.timezone);
    const end = new Date(start.getTime() + calendar.duration_minutes * 60_000);
    onChange({ starts_at: start.toISOString(), ends_at: end.toISOString(), override: true });
  };

  const list = slots.data?.slots ?? [];
  return (
    <div className="space-y-3">
      <DayField
        value={day}
        onChange={(d) => {
          onDayChange(d);
          onChange(null);
          setManual(false);
        }}
        label={t("appointmentBook.form.day", "Day")}
      />
      <div className="space-y-2">
        <p className="text-[12.5px] font-medium text-muted-foreground">
          {wholeDay ? t("appointmentBook.form.wholeDayLabel", "Whole day") : t("appointmentBook.form.time", "Time")}
        </p>
        {slots.isLoading ? (
          <div className="flex flex-wrap gap-1.5" aria-busy>
            {Array.from({ length: 6 }).map((_, i) => (
              <span key={i} className="h-10 w-[72px] animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : slots.data?.unavailable ? (
          <p className="text-[13.5px] text-muted-foreground">
            {t("appointmentBook.form.calendarOff", "This calendar is turned off, so it offers no times. Turn it on, or pick another time below.")}
          </p>
        ) : list.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">
            {t("appointmentBook.form.noTimes", "No free time on this day. Pick another day, or write in a time.")}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("appointmentBook.form.time", "Time")}>
            {list.map((slot) => {
              const [start, end] = slot.split("--");
              const on = !manual && value?.starts_at === start;
              return (
                <button
                  key={slot}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setManual(false);
                    onChange({ starts_at: start, ends_at: end, override: false });
                  }}
                  className={cn(
                    "press num h-10 min-w-[72px] rounded-lg border px-3 text-[14px] font-medium transition-colors max-sm:h-11",
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-card text-foreground hover:bg-muted",
                  )}
                >
                  {wholeDay ? t("appointmentBook.wholeDay", "Whole day") : timeOf(start, calendar.timezone, i18n.language)}
                </button>
              );
            })}
          </div>
        )}
        {!fetchSlots && !wholeDay ? (
          manual ? (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={manualTime}
                onChange={(e) => applyManual(e.target.value)}
                className="h-10 w-[130px] max-sm:h-11"
                aria-label={t("appointmentBook.form.otherTime", "Other time")}
              />
              <span className="text-[12.5px] text-muted-foreground">
                {t("appointmentBook.form.otherTimeHint", "Outside the free times — you'll be asked to confirm.")}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setManual(true);
                applyManual(manualTime);
              }}
              className="text-[13px] font-medium text-foreground underline underline-offset-4 hover:no-underline"
            >
              {t("appointmentBook.form.otherTime", "Other time…")}
            </button>
          )
        ) : null}
      </div>
    </div>
  );
}
