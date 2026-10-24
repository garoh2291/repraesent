import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { fromZonedTime } from "date-fns-tz";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  cancelAppointment,
  moveAppointment,
  type Appointment,
  type AppointmentCalendar,
} from "~/lib/api/appointment-book";
import { useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { SlotPicker, type PickedTime } from "./slot-picker";
import { dayOf, longDate, timeOf } from "./format";

/** Move to another time: the calendar's free times, or any time you write in. */
export function MoveDialog({
  appointment,
  calendar,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  /** Null for a booking that lives in a connected calendar. */
  calendar: AppointmentCalendar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const invalidate = useInvalidateAppointments();
  const a = appointment;
  const [day, setDay] = useState(dayOf(a.starts_at, a.timezone));
  const [time, setTime] = useState<PickedTime | null>(null);
  const [freeTime, setFreeTime] = useState(timeOf(a.starts_at, a.timezone, "en-GB"));
  const [notify, setNotify] = useState(true);
  const [confirmOverride, setConfirmOverride] = useState(false);
  const length = Date.parse(a.ends_at) - Date.parse(a.starts_at);
  // Only offered when it will actually happen: an address, and change notices on.
  const hasEmail = !!a.customer_email && !!calendar?.customer_messages.changes;

  const pick = (): PickedTime | null => {
    if (calendar) return time;
    if (!/^\d{2}:\d{2}$/.test(freeTime)) return null;
    const start = fromZonedTime(`${day}T${freeTime}:00`, a.timezone);
    return { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + length).toISOString(), override: true };
  };

  const move = useMutation({
    mutationFn: (override: boolean) => {
      const p = pick();
      if (!p) throw new Error(t("appointmentBook.form.pickTime", "Pick a time first."));
      return moveAppointment(a.id, {
        starts_at: p.starts_at,
        ends_at: p.ends_at,
        override: override || p.override,
        notify_customer: hasEmail && notify,
      });
    },
    onSuccess: (updated) => {
      invalidate();
      toast.success(t("appointmentBook.toast.moved", "Moved"), {
        description: `${longDate(updated.starts_at, updated.timezone, i18n.language)}${updated.all_day ? "" : `, ${timeOf(updated.starts_at, updated.timezone, i18n.language)}`}`,
      });
      onOpenChange(false);
    },
    onError: (e) => {
      if (isAxiosError(e) && e.response?.status === 409 && (e.response.data as { code?: string })?.code === "SLOT_TAKEN") {
        setConfirmOverride(true);
        return;
      }
      toast.error(extractErrorMessage(e));
    },
  });

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("appointmentBook.move.title", "Move appointment")}
      description={t("appointmentBook.move.now", "Now: {{when}}", {
        when: `${longDate(a.starts_at, a.timezone, i18n.language)}${a.all_day ? "" : `, ${timeOf(a.starts_at, a.timezone, i18n.language)}`}`,
      })}
      footer={
        confirmOverride ? (
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <p className="text-[13px] text-muted-foreground sm:mr-auto">
              {t("appointmentBook.form.notFree", "That time is not free in this calendar.")}
            </p>
            <Button variant="outline" onClick={() => setConfirmOverride(false)} className="max-sm:h-11">
              {t("appointmentBook.form.pickAnother", "Pick another time")}
            </Button>
            <Button onClick={() => move.mutate(true)} disabled={move.isPending} className="max-sm:h-11">
              {t("appointmentBook.move.anyway", "Move anyway")}
            </Button>
          </div>
        ) : (
          <Button className="w-full sm:w-auto max-sm:h-11" disabled={!pick() || move.isPending} onClick={() => move.mutate(false)}>
            {move.isPending ? t("common.saving", "Saving…") : t("appointmentBook.move.save", "Move it")}
          </Button>
        )
      }
    >
      <div className="space-y-5">
        {calendar ? (
          <SlotPicker
            calendar={calendar}
            day={day}
            onDayChange={setDay}
            value={time}
            onChange={setTime}
            excludeAppointmentId={a.id}
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="h-10 max-sm:h-11" />
            <Input type="time" value={freeTime} onChange={(e) => setFreeTime(e.target.value)} className="h-10 max-sm:h-11" />
            <p className="col-span-2 text-[12.5px] text-muted-foreground">
              {t("appointmentBook.move.connectedHint", "This appointment lives in a connected calendar; the event there moves with it.")}
            </p>
          </div>
        )}
        {hasEmail ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
            <span>{t("appointmentBook.move.tell", "Tell {{email}} about the new time", { email: a.customer_email })}</span>
          </label>
        ) : null}
      </div>
    </BottomSheet>
  );
}

export function CancelDialog({
  appointment,
  calendar,
  open,
  onOpenChange,
}: {
  appointment: Appointment;
  calendar: AppointmentCalendar | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateAppointments();
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  const hasEmail =
    !!appointment.customer_email &&
    !!calendar?.customer_messages.changes &&
    Date.parse(appointment.starts_at) > Date.now();
  const cancel = useMutation({
    mutationFn: () => cancelAppointment(appointment.id, { reason: reason.trim() || null, notify_customer: hasEmail && notify }),
    onSuccess: () => {
      invalidate();
      toast.success(t("appointmentBook.toast.cancelled", "Appointment cancelled"));
      onOpenChange(false);
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("appointmentBook.cancel.title", "Cancel appointment?")}
      description={t("appointmentBook.cancel.sub", "It stays in the history as cancelled. The time becomes free again.")}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="max-sm:h-11">
            {t("appointmentBook.cancel.keep", "Keep it")}
          </Button>
          <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending} className="max-sm:h-11">
            {t("appointmentBook.cancel.confirm", "Cancel appointment")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={2}
          placeholder={t("appointmentBook.cancel.reason", "Why? (only you see this)")}
        />
        {hasEmail ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
            <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} />
            <span>{t("appointmentBook.cancel.tell", "Tell {{email}} it's cancelled", { email: appointment.customer_email })}</span>
          </label>
        ) : null}
      </div>
    </BottomSheet>
  );
}
