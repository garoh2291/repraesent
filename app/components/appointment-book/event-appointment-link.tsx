import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarCheck2, ChevronRight, Link2, Loader2, UserRound } from "lucide-react";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Button } from "~/components/ui/button";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { getLinkCandidates, linkAppointmentToEvent, matchCalendarEvents } from "~/lib/api/appointment-book";
import { formatDateIntl } from "~/lib/utils/format";
import { cn } from "~/lib/utils";
import type { UnifiedCalendarEvent } from "~/lib/api/calendar";
import { canImportMeeting } from "./import-meeting-sheet";

const matchKey = (id: string) => ["calendar-event-match", id] as const;

/**
 * Inside the team calendar's event dialog: is this meeting one of our
 * appointments? Yes → open it (and who handles it). No → add it as a new
 * appointment, or say which existing appointment it is.
 */
export function EventAppointmentActions({
  event,
  timezone,
  onImport,
  onLink,
  onNavigate,
}: {
  event: UnifiedCalendarEvent;
  timezone: string;
  onImport: () => void;
  /** Close the event dialog and open the picker (one dialog at a time). */
  onLink: () => void;
  onNavigate: () => void;
}) {
  const { t } = useTranslation();
  const match = useQuery({
    queryKey: matchKey(event.id),
    queryFn: () => matchCalendarEvents([event.id]),
    staleTime: 60_000,
  });
  const found = match.data?.[event.id];

  if (match.isPending) {
    return <div className="h-11 w-48 animate-pulse rounded-lg bg-muted" aria-hidden />;
  }
  if (found) {
    return (
      <Link
        to={`/appointments/${found.id}`}
        onClick={onNavigate}
        className="press group flex items-center gap-3 rounded-xl border border-border bg-background px-3.5 py-3 transition-colors hover:border-foreground/30"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <CalendarCheck2 className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-foreground">
            {t("appointmentBook.match.isAppointment", "This is a re:praesent appointment")}
          </span>
          <span className="block truncate text-[12.5px] text-muted-foreground">
            {[found.customer_name, found.assigned_name ? t("appointmentBook.match.handledBy", "handled by {{name}}", { name: found.assigned_name }) : t("appointmentBook.match.nobody", "nobody handles it yet")]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-foreground">
          {t("appointmentBook.match.open", "Open")}
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    );
  }
  if (!canImportMeeting(event.calendarKey)) return null;
  void timezone;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" className="max-sm:h-11" onClick={onImport}>
        {t("appointmentBook.import.confirm", "Add to appointments")}
      </Button>
      <Button variant="ghost" size="sm" className="gap-1.5 max-sm:h-11" onClick={onLink}>
        <Link2 className="size-3.5" aria-hidden />
        {t("appointmentBook.match.linkExisting", "It's an existing appointment…")}
      </Button>
    </div>
  );
}

/** "Which appointment is this?" — opened by the team calendar after its event dialog closes. */
export function LinkSheet({ event, timezone, open, onOpenChange }: { event: UnifiedCalendarEvent; timezone: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const candidates = useQuery({
    queryKey: ["appointment-link-candidates", event.start],
    queryFn: () => getLinkCandidates(new Date(event.start).toISOString()),
    enabled: open,
  });
  const link = useMutation({
    mutationFn: (id: string) => linkAppointmentToEvent(id, event.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: matchKey(event.id) });
      void qc.invalidateQueries({ queryKey: ["appointments"] });
      toast.success(t("appointmentBook.match.linked", "Linked. This meeting now shows as that appointment."));
      onOpenChange(false);
    },
    onError: (err) => toast.error(extractErrorMessage(err) || t("appointmentBook.match.linkFailed", "That didn't link. Try again.")),
  });
  const when = (iso: string) => formatDateIntl(new Date(iso), { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone });

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("appointmentBook.match.linkTitle", "Which appointment is this?")}
      description={t("appointmentBook.match.linkSubtitle", "Appointments from a day before to a day after “{{title}}”.", { title: event.title })}
    >
      {candidates.isPending ? (
        <div className="space-y-2 pb-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : !candidates.data?.length ? (
        <p className="pb-4 text-[14px] text-muted-foreground">
          {t("appointmentBook.match.noCandidates", "No appointments around that time. Use “Add to appointments” to make this meeting one.")}
        </p>
      ) : (
        <ul className="space-y-2 pb-2">
          {candidates.data.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                disabled={link.isPending}
                onClick={() => link.mutate(a.id)}
                className={cn(
                  "press flex w-full min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-2.5 text-left transition-colors hover:border-foreground/40",
                  link.isPending && link.variables === a.id && "border-foreground",
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-foreground">
                    {a.customer_name || a.contact?.name || a.title || t("appointmentBook.match.untitled", "Appointment")}
                  </span>
                  <span className="block truncate text-[12.5px] text-muted-foreground">
                    <span className="num">{when(a.starts_at)}</span>
                    {a.assigned_user?.name ? (
                      <span>
                        {" · "}
                        <UserRound className="mb-0.5 inline size-3" aria-hidden /> {a.assigned_user.name}
                      </span>
                    ) : null}
                  </span>
                </span>
                {link.isPending && link.variables === a.id ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden /> : <Link2 className="size-4 text-muted-foreground" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </BottomSheet>
  );
}
