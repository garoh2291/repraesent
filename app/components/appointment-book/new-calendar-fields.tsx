import { useState } from "react";
import { useNavigate } from "react-router";
import { Button } from "~/components/ui/button";
import { BottomSheet } from "~/components/notebook/bottom-sheet";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Input } from "~/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { TimezonePicker } from "~/components/ui/timezone-picker";
import { Segmented } from "~/components/notebook/segmented";
import { appointmentKeys, createAppointmentCalendar, type AppointmentCalendar } from "~/lib/api/appointment-book";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useInvalidateAppointments } from "~/lib/hooks/useAppointmentBook";
import { useWorkspaceMembers } from "~/lib/hooks/useWorkspaceMembers";
import { DEFAULT_ZONE } from "~/lib/time/zones";
import { useAuthContext } from "~/providers/auth-provider";

export type CalendarKind = "in_person" | "online" | "day";

export interface NewCalendarDraft {
  name: string;
  kind: CalendarKind;
  minutes: number;
  timezone: string;
  ownerUserId: string | null;
}

const ALL_DAY = [{ start: "00:00", end: "23:59" }];

/**
 * The few things a calendar needs before it can take appointments. The time
 * zone starts at Berlin for a workspace's first calendar (never the browser's:
 * that is often our team's, not the customer's); later ones copy the
 * calendar used by default, so a business keeps one zone unless it picks
 * another.
 */
export function useNewCalendarDraft(calendars: AppointmentCalendar[] | undefined) {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const first = !calendars?.length;
  const inherited = calendars?.find((c) => c.is_default)?.timezone ?? calendars?.[0]?.timezone;
  return useState<NewCalendarDraft>(() => ({
    name: first ? t("appointmentBook.setup.defaultName", "Appointments") : "",
    kind: "in_person",
    minutes: 30,
    timezone: inherited || DEFAULT_ZONE,
    ownerUserId: user?.id ?? null,
  }));
}

export function useCreateCalendar(onCreated: (c: AppointmentCalendar) => void) {
  const { t } = useTranslation();
  const invalidate = useInvalidateAppointments();
  const qc = useQueryClient();
  const { currentWorkspace } = useAuthContext();
  return useMutation({
    mutationFn: (d: NewCalendarDraft) =>
      createAppointmentCalendar({
        name: d.name.trim(),
        mode: d.kind === "online" ? "online" : "in_person",
        booking_unit: d.kind === "day" ? "day" : "slot",
        duration_minutes: d.kind === "day" ? 1440 : d.minutes,
        timezone: d.timezone,
        owner_user_id: d.ownerUserId,
        ...(d.kind === "day"
          ? {
              weekly_hours: { mon: ALL_DAY, tue: ALL_DAY, wed: ALL_DAY, thu: ALL_DAY, fri: ALL_DAY, sat: ALL_DAY, sun: ALL_DAY },
              max_days_ahead: 730,
              min_notice_hours: 24,
            }
          : {}),
      }),
    onSuccess: (c) => {
      // In the list at once, so screens waiting for "a calendar exists" move on
      // without a flash of the setup step while the list reloads.
      qc.setQueryData<AppointmentCalendar[]>(appointmentKeys.calendars(currentWorkspace?.id), (old) => [...(old ?? []), c]);
      invalidate();
      toast.success(t("appointmentBook.calendars.created", "Calendar added"));
      onCreated(c);
    },
    onError: (e) => toast.error(extractErrorMessage(e)),
  });
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[13px] font-medium text-foreground">{children}</p>;
}

export function NewCalendarFields({
  draft,
  onChange,
  onSubmit,
  autoFocusName,
}: {
  draft: NewCalendarDraft;
  onChange: (next: NewCalendarDraft) => void;
  onSubmit?: () => void;
  autoFocusName?: boolean;
}) {
  const { t } = useTranslation();
  const members = useWorkspaceMembers();
  const set = <K extends keyof NewCalendarDraft>(k: K, v: NewCalendarDraft[K]) => onChange({ ...draft, [k]: v });
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>{t("appointmentBook.settings.name", "Name")}</Label>
        <Input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder={t("appointmentBook.calendars.namePlaceholder", "e.g. Viewings")}
          className="h-10 max-sm:h-11"
          autoFocus={autoFocusName}
          onKeyDown={(e) => e.key === "Enter" && draft.name.trim() && onSubmit?.()}
        />
      </div>
      <Segmented
        label={t("appointmentBook.calendars.kind", "What kind")}
        value={draft.kind}
        onChange={(v) => set("kind", v)}
        stretch
        options={[
          { value: "in_person", label: t("appointmentBook.settings.inPerson", "In person") },
          { value: "online", label: t("appointmentBook.settings.online", "Online") },
          { value: "day", label: t("appointmentBook.settings.unitDay", "A whole day") },
        ]}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        {draft.kind !== "day" ? (
          <div className="space-y-1.5">
            <Label>{t("appointmentBook.setup.length", "How long")}</Label>
            <Select value={String(draft.minutes)} onValueChange={(v) => set("minutes", Number(v))}>
              <SelectTrigger className="h-10 w-full max-sm:h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 30, 45, 60, 90, 120].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {t("appointmentBook.settings.minutes", "{{count}} min", { count: n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label>{t("appointmentBook.settings.owner", "Who handles it")}</Label>
          <Select value={draft.ownerUserId ?? "nobody"} onValueChange={(v) => set("ownerUserId", v === "nobody" ? null : v)}>
            <SelectTrigger className="h-10 w-full max-sm:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="nobody">{t("appointmentBook.detail.nobody", "Nobody yet")}</SelectItem>
              {(members.data?.members ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {[m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || m.user_email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>{t("appointmentBook.settings.tzTitle", "Time zone")}</Label>
        <TimezonePicker value={draft.timezone} onChange={(z) => set("timezone", z)} />
        <p className="text-[12.5px] text-muted-foreground">{t("appointmentBook.setup.tzHint", "Your opening hours are set in this time zone.")}</p>
      </div>
    </div>
  );
}

/** A further calendar, from the page header — or the first one, opened in place from elsewhere. */
export function NewCalendarSheet({
  onOpenChange,
  calendars,
  onCreated,
  title,
  description,
  submitLabel,
}: {
  onOpenChange: (open: boolean) => void;
  calendars: AppointmentCalendar[] | undefined;
  /** Default: close and open the new calendar's page. Given: the caller decides (the sheet stays). */
  onCreated?: (c: AppointmentCalendar) => void;
  title?: string;
  description?: string;
  submitLabel?: string;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [draft, setDraft] = useNewCalendarDraft(calendars);
  const create = useCreateCalendar((c) => {
    if (onCreated) return onCreated(c);
    onOpenChange(false);
    navigate(`/appointments/calendars/${c.id}`);
  });
  const submit = () => draft.name.trim() && !create.isPending && create.mutate(draft);
  return (
    <BottomSheet
      open
      onOpenChange={onOpenChange}
      title={title ?? (calendars?.length ? t("appointmentBook.calendars.new", "New calendar") : t("appointmentBook.setup.title", "Set up your appointment calendar"))}
      description={description ?? t("appointmentBook.calendars.newSubV2", "A name and a time zone now; hours and rules come next.")}
      footer={
        <Button className="w-full sm:w-auto max-sm:h-11" disabled={!draft.name.trim() || create.isPending} onClick={submit}>
          {create.isPending ? t("common.saving", "Saving…") : (submitLabel ?? t("appointmentBook.calendars.create", "Add calendar"))}
        </Button>
      }
    >
      <NewCalendarFields draft={draft} onChange={setDraft} onSubmit={submit} autoFocusName={!!calendars?.length} />
    </BottomSheet>
  );
}
