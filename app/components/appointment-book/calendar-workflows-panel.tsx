import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, ChevronRight, Plus, Workflow } from "lucide-react";
import { cn } from "~/lib/utils";
import { useAuthContext } from "~/providers/auth-provider";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { createWorkflow, listWorkflowsForCalendar, type WorkflowSummary } from "~/lib/api/workflows";
import { Panel } from "~/components/notebook/panel";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { Button } from "~/components/ui/button";
import {
  WORKFLOW_TEMPLATES,
  blankCalendarWorkflowGraph,
  type WorkflowTemplate,
} from "~/components/appointment-book/reminder-workflow";

/**
 * "Your own messages": the workflows that run for this calendar, as plain
 * sentences. Nothing is created without the owner picking it.
 */
export function CalendarWorkflowsPanel({
  calendarId,
  calendarName,
  builtInReminderOn,
}: {
  calendarId: string;
  calendarName: string;
  builtInReminderOn: boolean;
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { currentWorkspace } = useAuthContext();
  const [picking, setPicking] = useState(false);

  const flows = useQuery({
    queryKey: ["workflows", currentWorkspace?.id, "calendar", calendarId],
    queryFn: () => listWorkflowsForCalendar(calendarId),
    enabled: !!currentWorkspace,
  });
  const list = (flows.data ?? []).filter((w) => w.status !== "archived");

  const create = useMutation({
    mutationFn: (tpl: WorkflowTemplate | null) =>
      createWorkflow({
        name: tpl
          ? t("appointmentBook.flows.nameWith", "{{what}} — {{name}}", { what: t(tpl.labelKey, tpl.label), name: calendarName })
          : t("appointmentBook.flows.blankName", "New message — {{name}}", { name: calendarName }),
        graph: tpl ? tpl.graph(calendarId) : blankCalendarWorkflowGraph(calendarId),
        default_locale: i18n.language?.slice(0, 2),
      }),
    onSuccess: (w) => navigate(`/workflows/${w.id}`),
    onError: (e) => toast.error(extractErrorMessage(e)),
  });

  const reminderFlowOn = list.some((w) => w.status === "active" && isReminderFlow(w));

  return (
    <Panel className="space-y-4 px-4 py-5 sm:px-6">
      <div className="flex items-start gap-3">
        <Workflow className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-[16px] font-semibold text-foreground">{t("appointmentBook.flows.title", "Your own messages")}</h2>
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">
            {t(
              "appointmentBook.flows.hint",
              "Different words, a second reminder, a thank-you after the visit. Each one starts switched off until you turn it on.",
            )}
          </p>
        </div>
      </div>

      {flows.isLoading ? (
        <div className="h-12 animate-pulse rounded-lg bg-muted" />
      ) : flows.isError ? (
        <p className="text-[13.5px] text-muted-foreground">
          {t("appointmentBook.flows.loadError", "Your messages couldn't be loaded. Reload the page to try again.")}
        </p>
      ) : list.length === 0 ? (
        <p className="text-[13.5px] text-muted-foreground">
          {t("appointmentBook.flows.empty", "None yet for this calendar. Add a ready-made one and change it to suit you.")}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {list.map((w) => (
            <li key={w.id}>
              <Link
                to={`/workflows/${w.id}`}
                className="press flex min-h-14 items-center gap-3 px-3 py-2.5 hover:bg-muted/50 sm:px-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-medium text-foreground">{w.name}</span>
                  <span className="block text-[12.5px] text-muted-foreground">{sentence(w, t)}</span>
                </span>
                <StateBadge w={w} />
                <span className="hidden text-[13px] font-medium text-foreground sm:inline">{t("appointmentBook.flows.open", "Open")}</span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {builtInReminderOn && reminderFlowOn ? (
        <p className="flex items-center gap-1.5 rounded-lg bg-marker-soft px-3 py-2 text-[12.5px] text-marker-ink">
          <Bell className="size-3.5 shrink-0" aria-hidden />
          {t("appointmentBook.settings.doubleReminder", "The reminder above is on too — turn one off so nobody gets two.")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-10 gap-1.5 max-sm:h-11 max-sm:flex-1" onClick={() => setPicking(true)}>
          <Plus className="size-3.5" aria-hidden />
          {t("appointmentBook.flows.addReady", "Add a ready-made one")}
        </Button>
        <Button variant="ghost" className="h-10 max-sm:h-11 max-sm:flex-1" disabled={create.isPending} onClick={() => create.mutate(null)}>
          {t("appointmentBook.flows.scratch", "Start from scratch")}
        </Button>
      </div>

      {picking ? (
        <BottomSheet
          open
          onOpenChange={setPicking}
          title={t("appointmentBook.flows.pickTitle", "Pick a ready-made message")}
          description={t("appointmentBook.flows.pickHint", "It opens so you can read and change it. Nothing is sent until you turn it on.")}
        >
          <ul className="space-y-2">
            {WORKFLOW_TEMPLATES.map((tpl) => (
              <li key={tpl.id}>
                <button
                  type="button"
                  disabled={create.isPending}
                  onClick={() => create.mutate(tpl)}
                  className="press flex min-h-14 w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left hover:border-foreground/30 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium text-foreground">{t(tpl.labelKey, tpl.label)}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{t(tpl.hintKey, tpl.hint)}</span>
                    {tpl.isReminder && builtInReminderOn ? (
                      <span className="mt-1 block text-[12px] text-marker-ink">
                        {t("appointmentBook.flows.reminderClash", "Your built-in reminder is on — turn it off once this one is on.")}
                      </span>
                    ) : null}
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet>
      ) : null}
    </Panel>
  );
}

function isReminderFlow(w: WorkflowSummary): boolean {
  const tr = w.trigger;
  return !!tr && tr.type === "date_field_relative" && tr.dateField === "starts_at" && (tr.offsetMinutes ?? 0) < 0;
}

function StateBadge({ w }: { w: WorkflowSummary }) {
  const { t } = useTranslation();
  const on = w.status === "active";
  const pending = on && w.has_unpublished_changes;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium",
        pending ? "bg-secondary text-secondary-foreground" : on ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
      )}
    >
      {pending
        ? t("appointmentBook.flows.stateChanges", "Changes not live")
        : on
          ? t("appointmentBook.flows.stateOn", "On")
          : t("appointmentBook.flows.stateOff", "Off")}
    </span>
  );
}

type T = ReturnType<typeof useTranslation>["t"];

function span(minutes: number, t: T): string {
  const m = Math.abs(minutes);
  if (m % 10080 === 0) return t("appointmentBook.flows.weeks", "{{count}} weeks", { count: m / 10080 });
  if (m % 1440 === 0) return t("appointmentBook.flows.days", "{{count}} days", { count: m / 1440 });
  if (m % 60 === 0) return t("appointmentBook.flows.hours", "{{count}} hours", { count: m / 60 });
  return t("appointmentBook.flows.minutes", "{{count}} minutes", { count: m });
}

/** The trigger, said as the owner would say it. */
function sentence(w: WorkflowSummary, t: T): string {
  const tr = w.trigger;
  if (!tr) return t("appointmentBook.flows.whenUnknown", "Runs on its own rule");
  if (tr.type === "date_field_relative") {
    const off = tr.offsetMinutes ?? 0;
    const ends = tr.dateField === "ends_at";
    if (off === 0) return ends ? t("appointmentBook.flows.atEnd", "Sent when it ends") : t("appointmentBook.flows.atStart", "Sent when it starts");
    if (off < 0)
      return ends
        ? t("appointmentBook.flows.beforeEnd", "Sent {{span}} before it ends", { span: span(off, t) })
        : t("appointmentBook.flows.beforeStart", "Sent {{span}} before it starts", { span: span(off, t) });
    return ends
      ? t("appointmentBook.flows.afterEnd", "Sent {{span}} after it ends", { span: span(off, t) })
      : t("appointmentBook.flows.afterStart", "Sent {{span}} after it starts", { span: span(off, t) });
  }
  if (tr.type === "record_created") return t("appointmentBook.flows.onBooked", "Sent when someone books");
  if (tr.type === "field_changed_to" && tr.path === "status") {
    if (tr.value === "no_show") return t("appointmentBook.flows.onNoShow", "Sent when you mark that they didn't come");
    if (tr.value === "completed") return t("appointmentBook.flows.onCame", "Sent when you mark that they came");
    if (tr.value === "cancelled") return t("appointmentBook.flows.onCancelled", "Sent when it's cancelled");
  }
  if (tr.type === "record_updated" || tr.type === "field_changed_to") return t("appointmentBook.flows.onChange", "Sent when the appointment changes");
  return t("appointmentBook.flows.whenUnknown", "Runs on its own rule");
}
