import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Panel } from "~/components/notebook/panel";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { calendarKeyFor, listCalendarAccounts } from "~/lib/api/calendar";
import { getCalendarHandlers, setCalendarHandler } from "~/lib/api/appointment-book";
import { useWorkspaceMembers } from "~/lib/hooks/useWorkspaceMembers";
import { useCanEditLeads } from "~/lib/hooks/useCanEditLeads";
import { CalendarDot } from "./appointment-bits";

const HANDLERS_KEY = ["calendar-default-handlers"] as const;

/**
 * Google / Outlook calendars the team connected: who handles an appointment
 * that lands in each one (a form or chat booking, "Add to appointments").
 * Repraesent calendars set this on their own page.
 */
export function ConnectedCalendarHandlers() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const canEdit = useCanEditLeads();
  const accounts = useQuery({ queryKey: ["calendar-accounts"], queryFn: listCalendarAccounts });
  const handlers = useQuery({ queryKey: HANDLERS_KEY, queryFn: getCalendarHandlers });
  const members = useWorkspaceMembers();
  const save = useMutation({
    mutationFn: (v: { key: string; userId: string | null }) => setCalendarHandler(v.key, v.userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: HANDLERS_KEY });
      toast.success(t("appointmentBook.handlers.saved", "Saved. New appointments in this calendar go to that person."));
    },
    onError: (e) => toast.error(extractErrorMessage(e) || t("appointmentBook.handlers.failed", "That didn't save. Try again.")),
  });

  const rows = (accounts.data?.accounts ?? [])
    .filter((a) => !a.auth_failed)
    .flatMap((a) =>
      a.calendars
        .filter((c) => c.accessRole === "owner" || c.accessRole === "writer")
        .map((c) => ({ key: calendarKeyFor(a, c.id), name: c.summary, color: c.backgroundColor, account: a.google_email || a.display_name, owner: a.user_name })),
    );
  if (!rows.length) return null;
  const byKey = new Map((handlers.data ?? []).map((h) => [h.calendar_key, h.user_id]));
  const memberName = (m: { user_first_name: string; user_last_name: string; user_email: string }) =>
    [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || m.user_email;

  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-[15px] font-semibold text-foreground">{t("appointmentBook.handlers.titleDirect", "Meetings booked straight into Google or Outlook")}</h2>
        <p className="text-[13px] text-muted-foreground">
          {t(
            "appointmentBook.handlers.subtitleDirect",
            "Only for meetings that live in these calendars: a form or the chat that books straight into Google or Outlook, or “Add to appointments” in the team calendar. Appointments in a re:praesent calendar above always go to the person set on that calendar.",
          )}
        </p>
      </div>
      <Panel className="divide-y divide-border p-0">
        {rows.map((r) => (
          <div key={r.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <CalendarDot color={r.color ?? "#9a9893"} className="size-3" />
              <div className="min-w-0">
                <p className="truncate text-[14px] font-medium text-foreground">{r.name}</p>
                <p className="truncate text-[12.5px] text-muted-foreground">{r.account}</p>
              </div>
            </div>
            <Select
              value={byKey.get(r.key) ?? "nobody"}
              disabled={!canEdit || save.isPending}
              onValueChange={(v) => save.mutate({ key: r.key, userId: v === "nobody" ? null : v })}
            >
              <SelectTrigger className="h-10 w-full max-sm:h-11 sm:w-[240px]" aria-label={t("appointmentBook.settings.owner", "Who handles it")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nobody">{t("appointmentBook.detail.nobody", "Nobody yet")}</SelectItem>
                {(members.data?.members ?? []).map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {memberName(m)}
                    {memberName(m) === r.owner ? ` · ${t("appointmentBook.handlers.connectedIt", "connected it")}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </Panel>
    </section>
  );
}
