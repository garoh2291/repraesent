import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CalendarPlus, Loader2 } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useQuickCreate } from "~/components/notebook/quick-create";
import { bookRequestedTime, type Lead, type RequestedTimeResult } from "~/lib/api/leads";
import { refreshLeadViews } from "~/lib/leads/hide-choice";
import type { LeadAppointment } from "~/lib/leads/appointment";
import type { TFunction } from "i18next";

/**
 * A form inquiry asked for a time that is not in the calendar: the filter held
 * it back, or the time was gone by the time someone said "Not spam". Says which
 * in one line and offers the one next step — book that time, or another one.
 * Losing the time means losing the customer, so this wears the marker.
 */
export function RequestedTimeNotice({
  lead,
  appointment,
  hidden,
}: {
  lead: Pick<Lead, "id" | "full_name" | "email" | "phone">;
  appointment: LeadAppointment;
  /** Still in Hidden: "Not spam" does the booking, nothing to offer here. */
  hidden: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const quick = useQuickCreate();
  const past = appointment.start.getTime() <= Date.now();
  const gone = appointment.failReason === "taken" || appointment.failReason === "past" || past;

  const book = useMutation({
    mutationFn: () => bookRequestedTime(lead.id),
    onSuccess: (res) => {
      refreshLeadViews(queryClient, lead.id);
      const note = requestedTimeNote(t, res);
      if (res.booking === "booked") toast.success(note ?? t("leads.requestedTime.booked", "Appointment booked"));
      else toast.message(note ?? t("leads.requestedTime.notBooked", "Nothing was booked"));
    },
    onError: () => toast.error(t("leads.requestedTime.error", "Could not book it. Please try again.")),
  });

  if (appointment.booked || hidden) return null;

  const bookAnother = () =>
    quick.open("appointment", {
      appointment: {
        leadId: lead.id,
        leadLabel: lead.full_name || lead.email || null,
        customerName: lead.full_name ?? null,
        customerEmail: lead.email ?? null,
        customerPhone: lead.phone ?? null,
        startsAt: past ? undefined : appointment.start.toISOString(),
      },
    });

  const message =
    appointment.failReason === "taken"
      ? t("leads.requestedTime.taken", "Someone else took this time. Book them another one.")
      : appointment.failReason === "past" || past
        ? t("leads.requestedTime.past", "This time has passed. Book them a new one.")
        : t("leads.requestedTime.notYet", "This time is not in your calendar yet.");

  return (
    <div className="mt-2 rounded-md border-l-4 border-secondary bg-secondary/25 px-2.5 py-2">
      <p className="text-[12px] leading-5 text-foreground">{message}</p>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {!gone && (
          <Button size="sm" className="h-8 gap-1.5 text-xs max-sm:h-11" disabled={book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CalendarPlus className="size-3.5" />}
            {t("leads.requestedTime.bookThis", "Book this time")}
          </Button>
        )}
        <Button
          size="sm"
          variant={gone ? "default" : "outline"}
          className="h-8 gap-1.5 text-xs max-sm:h-11"
          onClick={bookAnother}
        >
          {gone && <CalendarPlus className="size-3.5" />}
          {t("leads.requestedTime.bookAnother", "Book another time")}
        </Button>
      </div>
    </div>
  );
}

/** One line for a toast: what happened to the time they asked for. null = nothing to say. */
export function requestedTimeNote(t: TFunction, res: Partial<RequestedTimeResult> | undefined): string | null {
  if (!res?.booking || !res.startsAt) return null;
  const when = new Date(res.startsAt).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  if (res.booking === "booked") return t("leads.requestedTime.toastBooked", { when, defaultValue: "Appointment booked for {{when}}." });
  if (res.booking === "taken")
    return t("leads.requestedTime.toastTaken", { when, defaultValue: "{{when}} is no longer free — book them another time." });
  return null;
}
