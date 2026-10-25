import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import TimezoneSelect from "react-timezone-select";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "~/lib/utils";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { Checkbox } from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Segmented } from "~/components/notebook/segmented";
import { Panel } from "~/components/notebook/panel";
import { getWorkspaceDetail } from "~/lib/api/workspaces";
import { calendarKeyFor, listCalendarAccounts } from "~/lib/api/calendar";
import { useAuthContext } from "~/providers/auth-provider";
import {
  WEEKDAYS,
  type AppointmentCalendar,
  type Closure,
  type SaveCalendarInput,
  type TimeRange,
  type WeekdayKey,
} from "~/lib/api/appointment-book";

export const CALENDAR_COLORS = ["#141516", "#c8414f", "#2e7d55", "#b7791f", "#6b4fa0", "#2c7a7b", "#8a5a44"];

export type CalendarDraft = Required<
  Pick<
    SaveCalendarInput,
    | "name"
    | "description"
    | "color"
    | "mode"
    | "location"
    | "meeting_url"
    | "timezone"
    | "booking_unit"
    | "duration_minutes"
    | "slot_step_minutes"
    | "buffer_before_minutes"
    | "buffer_after_minutes"
    | "min_notice_hours"
    | "max_days_ahead"
    | "capacity"
    | "weekly_hours"
    | "owner_user_id"
    | "busy_calendar_keys"
    | "copy_target_key"
    | "customer_messages"
    | "self_service"
  >
>;

export function draftOf(c: AppointmentCalendar): CalendarDraft {
  return {
    name: c.name,
    description: c.description,
    color: c.color,
    mode: c.mode,
    location: c.location,
    meeting_url: c.meeting_url,
    timezone: c.timezone,
    booking_unit: c.booking_unit,
    duration_minutes: c.duration_minutes,
    slot_step_minutes: c.slot_step_minutes,
    buffer_before_minutes: c.buffer_before_minutes,
    buffer_after_minutes: c.buffer_after_minutes,
    min_notice_hours: c.min_notice_hours,
    max_days_ahead: c.max_days_ahead,
    capacity: c.capacity,
    weekly_hours: c.weekly_hours,
    owner_user_id: c.owner_user_id,
    busy_calendar_keys: c.busy_calendar_keys,
    copy_target_key: c.copy_target_key,
    customer_messages: c.customer_messages,
    self_service: c.self_service,
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <Panel className="space-y-4 px-4 py-5 sm:px-6">
      <div className="space-y-1">
        <h2 className="text-[16px] font-semibold text-foreground">{title}</h2>
        {hint ? <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </Panel>
  );
}

function FieldRow({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[13px] font-medium text-foreground">{label}</p>
      {children}
      {hint ? <p className="text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumberSelect({
  value,
  options,
  onChange,
  className,
}: {
  value: number;
  options: Array<{ value: number; label: string }>;
  onChange: (n: number) => void;
  className?: string;
}) {
  const known = options.some((o) => o.value === value);
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger className={cn("h-10 w-full max-sm:h-11 sm:w-[220px]", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {!known ? <SelectItem value={String(value)}>{value}</SelectItem> : null}
        {options.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Every rule of one Repraesent calendar, in the order a business owner
 * thinks about it: what it is, how people meet, when you are open, the
 * rules, who handles it, your other calendars, and what customers hear.
 */
export function CalendarForm({
  calendarId,
  draft,
  onChange,
  closures,
  onClosuresChange,
  otherCalendars,
}: {
  calendarId: string;
  draft: CalendarDraft;
  onChange: (next: CalendarDraft) => void;
  closures: Closure[];
  onClosuresChange: (next: Closure[]) => void;
  otherCalendars: AppointmentCalendar[];
}) {
  const { t, i18n } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const set = <K extends keyof CalendarDraft>(key: K, value: CalendarDraft[K]) => onChange({ ...draft, [key]: value });
  const members = useQuery({ queryKey: ["workspace-detail"], queryFn: () => getWorkspaceDetail(), enabled: !!currentWorkspace });
  const accounts = useQuery({ queryKey: ["calendar-accounts"], queryFn: listCalendarAccounts, enabled: !!currentWorkspace });

  const connected = useMemo(
    () =>
      (accounts.data?.accounts ?? []).flatMap((a) =>
        a.calendars.map((c) => ({
          key: calendarKeyFor(a, c.id),
          label: c.summary || c.id,
          owner: a.user_name || a.google_email,
          writable: c.accessRole === "owner" || c.accessRole === "writer",
          broken: a.auth_failed,
        })),
      ),
    [accounts.data],
  );
  const mins = (n: number) => t("appointmentBook.settings.minutes", "{{count}} min", { count: n });
  const hours = (n: number) => t("appointmentBook.settings.hours", "{{count}} h", { count: n });
  const days = (n: number) => t("appointmentBook.settings.days", "{{count}} days", { count: n });
  const dayName = (d: WeekdayKey) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: "long" }).format(new Date(Date.UTC(2030, 0, 7 + WEEKDAYS.indexOf(d))));

  const wholeDay = draft.booking_unit === "day";
  const setRanges = (day: WeekdayKey, ranges: TimeRange[]) => set("weekly_hours", { ...draft.weekly_hours, [day]: ranges });

  return (
    <div className="space-y-5">
      <Section title={t("appointmentBook.settings.about", "About this calendar")}>
        <FieldRow label={t("appointmentBook.settings.name", "Name")} hint={t("appointmentBook.settings.nameHint", "Your customers see it, e.g. “Viewings” or “Event dates”.")}>
          <Input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} className="h-10 max-sm:h-11 sm:max-w-md" />
        </FieldRow>
        <FieldRow label={t("appointmentBook.settings.color", "Colour")}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("appointmentBook.settings.color", "Colour")}>
            {CALENDAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={draft.color === c}
                aria-label={c}
                onClick={() => set("color", c)}
                className={cn(
                  "press size-9 rounded-full border-2 transition-transform max-sm:size-11",
                  draft.color === c ? "scale-105 border-foreground ring-2 ring-background ring-offset-2 ring-offset-foreground" : "border-transparent",
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </FieldRow>
        <FieldRow label={t("appointmentBook.settings.description", "Note for your team (optional)")}>
          <Textarea value={draft.description ?? ""} onChange={(e) => set("description", e.target.value || null)} rows={2} className="sm:max-w-xl" />
        </FieldRow>
      </Section>

      <Section title={t("appointmentBook.settings.how", "How people meet you")}>
        <Segmented
          label={t("appointmentBook.settings.how", "How people meet you")}
          value={draft.mode ?? "in_person"}
          onChange={(v) => set("mode", v)}
          stretch
          options={[
            { value: "in_person", label: t("appointmentBook.settings.inPerson", "In person") },
            { value: "online", label: t("appointmentBook.settings.online", "Online") },
          ]}
        />
        {draft.mode === "online" ? (
          <FieldRow
            label={t("appointmentBook.settings.meetingUrl", "Meeting link")}
            hint={t(
              "appointmentBook.settings.meetingUrlHint",
              "Your fixed Zoom, Meet or Teams room. Leave empty if appointments go into a connected Google or Microsoft calendar — it makes a fresh link for each one.",
            )}
          >
            <Input
              type="url"
              value={draft.meeting_url ?? ""}
              onChange={(e) => set("meeting_url", e.target.value || null)}
              placeholder="https://"
              className="h-10 max-sm:h-11 sm:max-w-xl"
            />
          </FieldRow>
        ) : (
          <FieldRow label={t("appointmentBook.settings.address", "Address")} hint={t("appointmentBook.settings.addressHint", "Goes into every confirmation and reminder.")}>
            <Input
              value={draft.location ?? ""}
              onChange={(e) => set("location", e.target.value || null)}
              className="h-10 max-sm:h-11 sm:max-w-xl"
            />
          </FieldRow>
        )}
      </Section>

      <Section title={t("appointmentBook.settings.what", "What gets booked")}>
        <Segmented
          label={t("appointmentBook.settings.what", "What gets booked")}
          value={draft.booking_unit ?? "slot"}
          onChange={(v) => set("booking_unit", v)}
          stretch
          options={[
            { value: "slot", label: t("appointmentBook.settings.unitSlot", "A time") },
            { value: "day", label: t("appointmentBook.settings.unitDay", "A whole day") },
          ]}
        />
        {wholeDay ? (
          <p className="text-[13.5px] text-muted-foreground">
            {t("appointmentBook.settings.unitDayHint", "Each booking takes the whole day — for an event date, a rental, a shoot.")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label={t("appointmentBook.settings.length", "How long")}>
              <NumberSelect
                value={draft.duration_minutes ?? 30}
                onChange={(n) => set("duration_minutes", n)}
                options={[15, 20, 30, 45, 60, 90, 120, 180, 240, 480].map((n) => ({ value: n, label: n < 60 ? mins(n) : n % 60 === 0 ? hours(n / 60) : `${hours(Math.floor(n / 60))} ${mins(n % 60)}` }))}
              />
            </FieldRow>
            <FieldRow label={t("appointmentBook.settings.step", "Times start every")} hint={t("appointmentBook.settings.stepHint", "Usually the same as the length.")}>
              <NumberSelect
                value={draft.slot_step_minutes ?? draft.duration_minutes ?? 30}
                onChange={(n) => set("slot_step_minutes", n === draft.duration_minutes ? null : n)}
                options={[15, 30, 45, 60, 90, 120].map((n) => ({ value: n, label: n < 60 ? mins(n) : hours(n / 60) }))}
              />
            </FieldRow>
          </div>
        )}
      </Section>

      <Section title={t("appointmentBook.settings.hoursTitle", "When you are open")} hint={t("appointmentBook.settings.hoursHint", "Only these times are offered. Add a break to split a day.")}>
        <div className="divide-y divide-border">
          {WEEKDAYS.map((day) => {
            const ranges = draft.weekly_hours?.[day] ?? [];
            const open = ranges.length > 0;
            return (
              <div key={day} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
                <label className="flex min-h-11 w-40 shrink-0 cursor-pointer items-center gap-3 sm:min-h-10">
                  <Switch
                    checked={open}
                    onCheckedChange={(on) => setRanges(day, on ? [{ start: wholeDay ? "00:00" : "09:00", end: wholeDay ? "23:59" : "17:00" }] : [])}
                  />
                  <span className="text-[14px] font-medium capitalize text-foreground">{dayName(day)}</span>
                </label>
                {open && !wholeDay ? (
                  <div className="flex flex-1 flex-col gap-2">
                    {ranges.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={r.start}
                          onChange={(e) => setRanges(day, ranges.map((x, j) => (j === idx ? { ...x, start: e.target.value } : x)))}
                          className="h-10 w-[120px] max-sm:h-11"
                          aria-label={t("appointmentBook.settings.from", "From")}
                        />
                        <span className="text-muted-foreground">–</span>
                        <Input
                          type="time"
                          value={r.end}
                          onChange={(e) => setRanges(day, ranges.map((x, j) => (j === idx ? { ...x, end: e.target.value } : x)))}
                          className="h-10 w-[120px] max-sm:h-11"
                          aria-label={t("appointmentBook.settings.until", "Until")}
                        />
                        {ranges.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => setRanges(day, ranges.filter((_, j) => j !== idx))}
                            className="press flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground max-sm:size-11"
                            aria-label={t("common.remove", "Remove")}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        ) : null}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setRanges(day, withBreak(ranges))}
                      className="inline-flex min-h-11 items-center gap-1 self-start text-[13px] sm:min-h-0 font-medium text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      {t("appointmentBook.settings.addBreak", "Add a break")}
                    </button>
                  </div>
                ) : !open ? (
                  <span className="text-[14px] text-muted-foreground sm:pt-2">{t("appointmentBook.settings.closed", "Closed")}</span>
                ) : (
                  <span className="text-[14px] text-muted-foreground sm:pt-2">{t("appointmentBook.settings.bookable", "Bookable")}</span>
                )}
              </div>
            );
          })}
        </div>
        <FieldRow label={t("appointmentBook.settings.timezone", "Time zone")}>
          <TimezoneSelect
            value={draft.timezone ?? "Europe/Berlin"}
            onChange={(tz) => set("timezone", typeof tz === "string" ? tz : tz.value)}
            className="sm:max-w-md [&_.react-select__control]:min-h-10 [&_.react-select__control]:rounded-lg [&_.react-select__control]:border-border [&_.react-select__control]:text-sm"
          />
        </FieldRow>
      </Section>

      <ClosuresSection closures={closures} onChange={onClosuresChange} />

      <Section title={t("appointmentBook.settings.rules", "Booking rules")}>
        <div className="grid gap-4 sm:grid-cols-2">
          {!wholeDay ? (
            <>
              <FieldRow label={t("appointmentBook.settings.before", "Free time before each one")}>
                <NumberSelect
                  value={draft.buffer_before_minutes ?? 0}
                  onChange={(n) => set("buffer_before_minutes", n)}
                  options={[0, 5, 10, 15, 30, 45, 60].map((n) => ({ value: n, label: n === 0 ? t("appointmentBook.settings.none", "None") : mins(n) }))}
                />
              </FieldRow>
              <FieldRow label={t("appointmentBook.settings.after", "Free time after each one")}>
                <NumberSelect
                  value={draft.buffer_after_minutes ?? 0}
                  onChange={(n) => set("buffer_after_minutes", n)}
                  options={[0, 5, 10, 15, 30, 45, 60].map((n) => ({ value: n, label: n === 0 ? t("appointmentBook.settings.none", "None") : mins(n) }))}
                />
              </FieldRow>
            </>
          ) : null}
          <FieldRow label={t("appointmentBook.settings.notice", "How soon people can book")}>
            <NumberSelect
              value={draft.min_notice_hours ?? 2}
              onChange={(n) => set("min_notice_hours", n)}
              options={[0, 1, 2, 4, 12, 24, 48, 72, 168].map((n) => ({
                value: n,
                label: n === 0 ? t("appointmentBook.settings.anyTime", "Right away") : n >= 24 ? t("appointmentBook.settings.daysAhead", "{{count}} days ahead", { count: n / 24 }) : t("appointmentBook.settings.hoursAhead", "{{count}} h ahead", { count: n }),
              }))}
            />
          </FieldRow>
          <FieldRow label={t("appointmentBook.settings.horizon", "How far ahead")}>
            <NumberSelect
              value={draft.max_days_ahead ?? 60}
              onChange={(n) => set("max_days_ahead", n)}
              options={[7, 14, 30, 60, 90, 180, 365, 730].map((n) => ({ value: n, label: days(n) }))}
            />
          </FieldRow>
          <FieldRow
            label={t("appointmentBook.settings.capacity", "How many at the same time")}
            hint={t("appointmentBook.settings.capacityHint", "1 for one room or one person. More for a showroom with several advisors.")}
          >
            <Input
              type="number"
              min={1}
              max={1000}
              value={draft.capacity ?? 1}
              onChange={(e) => set("capacity", Math.max(1, Math.min(1000, e.target.valueAsNumber || 1)))}
              className="h-10 w-[120px] max-sm:h-11"
            />
          </FieldRow>
          <FieldRow label={t("appointmentBook.settings.owner", "Who handles it")} hint={t("appointmentBook.settings.ownerHint", "Gets told when a customer moves or cancels.")}>
            <Select value={draft.owner_user_id ?? "nobody"} onValueChange={(v) => set("owner_user_id", v === "nobody" ? null : v)}>
              <SelectTrigger className="h-10 w-full max-sm:h-11 sm:w-[260px]">
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
          </FieldRow>
        </div>
      </Section>

      <Section
        title={t("appointmentBook.settings.connected", "Your other calendars")}
        hint={t("appointmentBook.settings.connectedHint", "Optional. Connect Google or Microsoft in Settings → Calendars first.")}
      >
        <FieldRow label={t("appointmentBook.settings.busy", "Block times when I'm busy in…")}>
          {connected.length === 0 && otherCalendars.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">{t("appointmentBook.settings.noConnected", "No other calendars yet.")}</p>
          ) : (
            <div className="space-y-1">
              {[
                ...otherCalendars.filter((c) => c.id !== calendarId).map((c) => ({ key: c.key, label: c.name, owner: t("appointmentBook.settings.repraesentCalendar", "Repraesent calendar"), broken: false })),
                ...connected,
              ].map((c) => {
                const on = (draft.busy_calendar_keys ?? []).includes(c.key);
                return (
                  <label key={c.key} className="flex min-h-11 cursor-pointer items-center gap-3 text-[14px]">
                    <Checkbox
                      checked={on}
                      onCheckedChange={(v) =>
                        set(
                          "busy_calendar_keys",
                          v === true ? [...(draft.busy_calendar_keys ?? []), c.key] : (draft.busy_calendar_keys ?? []).filter((k) => k !== c.key),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="text-foreground">{c.label}</span>
                      <span className="text-muted-foreground"> · {c.owner}</span>
                      {c.broken ? <span className="text-overdue"> · {t("appointmentBook.settings.reconnect", "needs reconnecting")}</span> : null}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </FieldRow>
        <FieldRow
          label={t("appointmentBook.settings.copy", "Also put appointments in…")}
          hint={t("appointmentBook.settings.copyHint", "A copy lands in that calendar, with a Meet or Teams link for online appointments.")}
        >
          <Select value={draft.copy_target_key ?? "none"} onValueChange={(v) => set("copy_target_key", v === "none" ? null : v)}>
            <SelectTrigger className="h-10 w-full max-sm:h-11 sm:max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t("appointmentBook.settings.copyNone", "Nowhere else")}</SelectItem>
              {connected
                .filter((c) => c.writable && !c.broken)
                .map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label} · {c.owner}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </FieldRow>
      </Section>

      <Section
        title={t("appointmentBook.settings.messages", "Messages to your customers")}
        hint={t("appointmentBook.settings.messagesHint", "Sent by email from your business name. Text messages can be added later.")}
      >
        <SwitchRow
          checked={draft.customer_messages?.confirmation ?? true}
          onChange={(v) => set("customer_messages", { ...draft.customer_messages!, confirmation: v })}
          label={t("appointmentBook.settings.msgConfirmation", "Confirmation right after booking")}
          hint={t("appointmentBook.settings.msgConfirmationHint", "With the date, the place and a calendar file.")}
        />
        <SwitchRow
          checked={draft.customer_messages?.changes ?? true}
          onChange={(v) => set("customer_messages", { ...draft.customer_messages!, changes: v })}
          label={t("appointmentBook.settings.msgChanges", "A note when the time changes or it's cancelled")}
        />
        <div className="space-y-2">
          <SwitchRow
            checked={draft.customer_messages?.reminder.enabled ?? false}
            onChange={(v) => set("customer_messages", { ...draft.customer_messages!, reminder: { ...draft.customer_messages!.reminder, enabled: v } })}
            label={t("appointmentBook.settings.msgReminder", "A reminder before the appointment")}
          />
          {draft.customer_messages?.reminder.enabled ? (
            <div className="pl-14">
              <NumberSelect
                value={draft.customer_messages.reminder.minutes_before}
                onChange={(n) => set("customer_messages", { ...draft.customer_messages!, reminder: { ...draft.customer_messages!.reminder, minutes_before: n } })}
                options={[60, 120, 240, 1440, 2880, 10080].map((n) => ({
                  value: n,
                  label: n < 1440 ? t("appointmentBook.settings.hoursBefore", "{{count}} h before", { count: n / 60 }) : t("appointmentBook.settings.daysBefore", "{{count}} days before", { count: n / 1440 }),
                }))}
              />
            </div>
          ) : null}
        </div>
        <SwitchRow
          checked={draft.self_service ?? true}
          onChange={(v) => set("self_service", v)}
          label={t("appointmentBook.settings.selfService", "Let customers move or cancel from the email")}
          hint={t("appointmentBook.settings.selfServiceHint", "They pick another free time themselves; whoever handles it gets told.")}
        />
      </Section>
    </div>
  );
}

const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));
const toHHMM = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/**
 * "Add a break": split the longest stretch around its middle with a one-hour
 * gap (10:00–18:00 → 10:00–13:30 and 14:30–18:00, then the owner adjusts).
 * Too short a stretch to split gets an hour's opening added after it instead.
 */
function withBreak(ranges: TimeRange[]): TimeRange[] {
  if (ranges.length === 0) return [{ start: "09:00", end: "17:00" }];
  let longest = 0;
  ranges.forEach((r, i) => {
    if (toMin(r.end) - toMin(r.start) > toMin(ranges[longest].end) - toMin(ranges[longest].start)) longest = i;
  });
  const r = ranges[longest];
  const span = toMin(r.end) - toMin(r.start);
  if (span >= 180) {
    const mid = Math.round((toMin(r.start) + span / 2) / 30) * 30;
    const next = [...ranges];
    next.splice(longest, 1, { start: r.start, end: toHHMM(mid - 30) }, { start: toHHMM(mid + 30), end: r.end });
    return next;
  }
  const lastEnd = toMin(ranges[ranges.length - 1].end);
  if (lastEnd + 90 > 24 * 60 - 1) return ranges;
  return [...ranges, { start: toHHMM(lastEnd + 30), end: toHHMM(lastEnd + 90) }];
}

function SwitchRow({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
      <span>
        <span className="block text-[14px] text-foreground">{label}</span>
        {hint ? <span className="block text-[12.5px] text-muted-foreground">{hint}</span> : null}
      </span>
    </label>
  );
}

function ClosuresSection({ closures, onChange }: { closures: Closure[]; onChange: (next: Closure[]) => void }) {
  const { t, i18n } = useTranslation();
  const [date, setDate] = useState("");
  useEffect(() => setDate(""), [closures.length]);
  const fmt = (d: string) =>
    new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${d}T12:00:00`));
  return (
    <Section title={t("appointmentBook.settings.closures", "Closed days")} hint={t("appointmentBook.settings.closuresHint", "Holidays, trade fairs, a private event — no times on these days.")}>
      {closures.length > 0 ? (
        <ul className="divide-y divide-border">
          {closures.map((c, idx) => (
            <li key={c.date} className="flex items-center gap-3 py-2">
              <span className="w-56 shrink-0 text-[14px] text-foreground">{fmt(c.date)}</span>
              <Input
                value={c.note ?? ""}
                onChange={(e) => onChange(closures.map((x, j) => (j === idx ? { ...x, note: e.target.value || null } : x)))}
                placeholder={t("appointmentBook.settings.closureNote", "Why (optional)")}
                className="h-10 flex-1 max-sm:h-11"
              />
              <button
                type="button"
                onClick={() => onChange(closures.filter((_, j) => j !== idx))}
                className="press flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground max-sm:size-11"
                aria-label={t("common.remove", "Remove")}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-[180px] max-sm:h-11" />
        <button
          type="button"
          disabled={!date || closures.some((c) => c.date === date)}
          onClick={() => onChange([...closures, { date, ranges: null, note: null }].sort((a, b) => a.date.localeCompare(b.date)))}
          className="press inline-flex h-10 items-center gap-1 rounded-lg border border-border px-3 text-[13px] font-medium hover:bg-muted disabled:opacity-50 max-sm:h-11"
        >
          <Plus className="size-3.5" aria-hidden />
          {t("appointmentBook.settings.addClosure", "Add closed day")}
        </button>
      </div>
    </Section>
  );
}
