import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, MapPin, Video, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { setAppointmentOutcome, type Appointment } from "~/lib/api/appointment-book";
import { useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { timeParts, whoOf } from "./format";
import { useAfterVisit } from "./after-visit";

/** Status in the owner's words. Scheduled shows nothing: that is the normal case. */
export function StatusPill({ appointment, className }: { appointment: Appointment; className?: string }) {
  const { t } = useTranslation();
  const a = appointment;
  if (a.status === "scheduled" && !a.needs_outcome) {
    if (!a.confirmed_at) return null;
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-full bg-earned-soft px-2 py-0.5 text-[11.5px] font-medium text-earned", className)}>
        <Check className="size-3" aria-hidden />
        {t("appointmentBook.status.confirmed", "Confirmed")}
      </span>
    );
  }
  const map: Record<string, { label: string; cls: string }> = {
    needs: {
      label: t("appointmentBook.status.needsOutcome", "Did they come?"),
      cls: "bg-marker-soft text-marker-ink",
    },
    completed: { label: t("appointmentBook.status.completed", "Came"), cls: "bg-earned-soft text-earned" },
    no_show: { label: t("appointmentBook.status.noShow", "Didn't come"), cls: "bg-muted text-muted-foreground" },
    cancelled: { label: t("appointmentBook.status.cancelled", "Cancelled"), cls: "bg-muted text-muted-foreground line-through" },
  };
  const entry = a.needs_outcome ? map.needs : map[a.status];
  if (!entry) return null;
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11.5px] font-medium", entry.cls, className)}>
      {entry.label}
    </span>
  );
}

/** A calendar's colour dot. Ink when the calendar has none. */
export function CalendarDot({ color, className }: { color: string | null | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color || "var(--foreground)" }}
    />
  );
}

/**
 * One line of the appointment book: the time in the margin, the person, and
 * what they need from you. Whole-day bookings carry a "whole day" margin.
 */
export function AppointmentRow({
  appointment,
  showDate = false,
  showOutcome = true,
  hideDeal = false,
  className,
}: {
  appointment: Appointment;
  /** On the deal's own page its name would only repeat the page title. */
  hideDeal?: boolean;
  /** For lists that span several days without day headings (entity cards). */
  showDate?: boolean;
  showOutcome?: boolean;
  className?: string;
}) {
  const { t, i18n } = useTranslation();
  const a = appointment;
  const locale = i18n.language;
  const cancelled = a.status === "cancelled";
  const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: a.timezone }).format(
    new Date(a.starts_at),
  );
  const clock = timeParts(a.starts_at, a.timezone, locale);
  return (
    <div className={cn("group relative flex items-stretch", className)}>
      <Link
        to={`/appointments/${a.id}`}
        prefetch="intent"
        className="press flex min-h-[60px] min-w-0 flex-1 items-stretch gap-0 rounded-lg transition-colors hover:bg-muted/50"
      >
        {/* The margin: a ruled column, like the left edge of a paper diary. */}
        <span
          className={cn(
            "flex w-[72px] shrink-0 flex-col items-end justify-center border-r-2 pr-3 sm:w-[84px]",
            a.needs_outcome ? "border-marker" : "border-border",
          )}
        >
          {showDate ? <span className="text-[11.5px] text-muted-foreground">{date}</span> : null}
          {a.all_day ? (
            <span className={cn("text-right text-[13px] font-semibold leading-tight text-foreground", cancelled && "text-muted-foreground line-through")}>
              {t("appointmentBook.wholeDay", "Whole day")}
            </span>
          ) : (
            <>
              <span className={cn("num whitespace-nowrap text-[17px] font-semibold leading-tight text-foreground", cancelled && "text-muted-foreground line-through")}>
                {clock.time}
              </span>
              {clock.period ? <span className="text-[11px] font-medium uppercase text-muted-foreground">{clock.period}</span> : null}
            </>
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-3 py-2">
          <span className={cn("truncate text-[15px] font-medium text-foreground", cancelled && "text-muted-foreground")}>
            {whoOf(a, t("appointmentBook.someone", "Someone"))}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
            {a.calendar ? (
              <>
                <CalendarDot color={a.calendar.color} />
                <span className="max-w-[60%] shrink-0 truncate">{a.calendar.name}</span>
              </>
            ) : (
              <span className="truncate">{t("appointmentBook.connectedCalendar", "Connected calendar")}</span>
            )}
            {a.mode === "online" ? (
              <Video className="size-3.5 shrink-0" aria-label={t("appointmentBook.online", "Online")} />
            ) : a.location ? (
              <MapPin className="size-3.5 shrink-0" aria-label={t("appointmentBook.inPerson", "In person")} />
            ) : null}
            {a.deal && !hideDeal ? <span className="min-w-0 truncate">· {a.deal.title || t("appointmentBook.deal", "Deal")}</span> : null}
          </span>
        </span>
        <span className="flex shrink-0 items-center pr-2">
          <StatusPill appointment={a} />
        </span>
      </Link>
      {showOutcome && a.needs_outcome ? <OutcomeButtons appointment={a} compact className="ml-1 self-center" /> : null}
    </div>
  );
}

/**
 * "Did they come?" — the question every past visit asks. Came opens what's
 * next (the deal's next step, or book again / task / deal), so a visit feeds
 * the loop instead of ending in the book.
 */
export function OutcomeButtons({
  appointment,
  compact = false,
  className,
}: {
  appointment: Appointment;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const invalidate = useInvalidateAppointments();
  const afterVisit = useAfterVisit();
  const outcome = useMutation({
    mutationFn: (status: "completed" | "no_show") => setAppointmentOutcome(appointment.id, { status }),
    onSuccess: (updated, status) => {
      invalidate();
      if (status === "completed") afterVisit.open(updated);
      else
        toast.success(t("appointmentBook.toast.noShow", "Marked: didn't come"), {
          action: {
            label: t("common.undo", "Undo"),
            onClick: () => void setAppointmentOutcome(appointment.id, { status: "scheduled" }).then(invalidate),
          },
        });
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
  const btn = cn(
    "press inline-flex items-center justify-center gap-1 rounded-full border text-[13px] font-medium transition-colors disabled:opacity-50",
    compact ? "h-9 px-3 max-sm:h-11" : "h-11 px-4",
  );
  return (
    <div className={cn("flex shrink-0 items-center gap-1.5", className)}>
      <button
        type="button"
        disabled={outcome.isPending}
        onClick={() => outcome.mutate("completed")}
        className={cn(btn, "border-foreground bg-foreground text-background hover:bg-foreground/90")}
      >
        <Check className="size-3.5" aria-hidden />
        {t("appointmentBook.came", "Came")}
      </button>
      <button
        type="button"
        disabled={outcome.isPending}
        onClick={() => outcome.mutate("no_show")}
        className={cn(btn, "border-border bg-card text-foreground hover:bg-muted")}
      >
        <X className="size-3.5" aria-hidden />
        {compact ? <span className="max-sm:hidden">{t("appointmentBook.didntCome", "Didn't come")}</span> : t("appointmentBook.didntCome", "Didn't come")}
      </button>
    </div>
  );
}
