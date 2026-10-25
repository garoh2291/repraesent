import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "~/components/ui/button";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { importMeeting } from "~/lib/api/appointment-book";
import { useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { EntityPicker, type PickedEntity } from "./entity-picker";
import { longDate, timeOf } from "./format";

/** A meeting read from a connected calendar (team calendar / "my other calendars"). */
export interface CalendarMeeting {
  /** As the calendars list hands it out: "<calendarKey>:<eventId>". */
  id: string;
  calendarKey: string;
  title: string | null;
  start: string;
  end: string;
  allDay: boolean;
}

/** Only Google and Outlook meetings can be followed event by event. */
export function canImportMeeting(calendarKey: string): boolean {
  return calendarKey.startsWith("google:") || calendarKey.startsWith("microsoft:");
}

/**
 * "Add to appointments": the meeting stays in the calendar it lives in, and
 * the appointment follows it there (moved or deleted → updated here within
 * 10 minutes). Nobody is emailed — the calendar already invited them.
 */
export function ImportMeetingSheet({
  meeting,
  timezone,
  onOpenChange,
}: {
  meeting: CalendarMeeting | null;
  timezone: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const invalidate = useInvalidateAppointments();
  const [contact, setContact] = useState<PickedEntity | null>(null);
  const [deal, setDeal] = useState<PickedEntity | null>(null);
  useEffect(() => {
    setContact(null);
    setDeal(null);
  }, [meeting?.id]);

  const add = useMutation({
    mutationFn: () =>
      importMeeting({
        calendar_key: meeting!.calendarKey,
        event_id: meeting!.id,
        contact_id: contact?.id ?? null,
        deal_id: deal?.id ?? null,
      }),
    onSuccess: (appointment) => {
      invalidate();
      toast.success(t("appointmentBook.import.added", "Added to appointments"));
      onOpenChange(false);
      navigate(`/appointments/${appointment.id}`);
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  const when = meeting
    ? meeting.allDay
      ? longDate(meeting.start, timezone, i18n.language)
      : `${longDate(meeting.start, timezone, i18n.language)}, ${timeOf(meeting.start, timezone, i18n.language)}–${timeOf(meeting.end, timezone, i18n.language)}`
    : "";

  return (
    <BottomSheet
      open={!!meeting}
      onOpenChange={onOpenChange}
      title={t("appointmentBook.import.title", "Add to appointments")}
      description={t(
        "appointmentBook.import.sub",
        "It stays in your calendar. Move or delete it there, and it updates here. Nobody gets an email from us.",
      )}
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="max-sm:h-11">
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending || !meeting} className="max-sm:h-11">
            {t("appointmentBook.import.confirm", "Add to appointments")}
          </Button>
        </div>
      }
    >
      {meeting ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
            <p className="text-[15px] font-medium text-foreground">
              {meeting.title || t("appointmentBook.import.untitled", "Meeting")}
            </p>
            <p className="num text-[13.5px] text-muted-foreground">{when}</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-foreground">{t("appointmentBook.form.with", "With")}</p>
            <EntityPicker
              type="contact"
              value={contact}
              onChange={setContact}
              placeholder={t("appointmentBook.form.searchCustomer", "Search customers…")}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[13px] font-medium text-foreground">{t("appointmentBook.form.dealOptional", "Deal (optional)")}</p>
            <EntityPicker
              type="deal"
              value={deal}
              onChange={setDeal}
              placeholder={t("appointmentBook.form.searchDeal", "Search deals…")}
            />
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
