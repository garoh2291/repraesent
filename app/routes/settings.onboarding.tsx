import { PricingSection } from "~/components/onboarding-settings/pricing-section";
import { HostRow } from "~/components/onboarding-settings/host-picker";
import { SaveBar, Section } from "~/components/onboarding-settings/settings-section";
import { AiAssistantTab } from "~/components/onboarding-settings/ai/ai-assistant-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  CircleCheck,
  FlaskConical,
  Plus,
  Route,
  UsersRound,
  X,
} from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useDebounce } from "~/lib/hooks/useDebounce";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import {
  calendarKeyFor,
  listCalendarAccounts,
  type BaikalConfig,
  type CalendarAccount,
} from "~/lib/api/calendar";
import type {
  AssignPolicy,
  MergedSlot,
  RootBookingConfig,
  RootOnboardingSettingsInput,
  RootPipelineOption,
  SalesHost,
  SalesRegion,
} from "~/lib/api/root-onboarding";
import { SALES_REGIONS } from "~/lib/api/root-onboarding";
import {
  useRootOnboardingSettings,
  useRootPipelines,
  useRootPreviewDays,
  useRootPreviewSlots,
  useRunRootTestIntake,
  useSaveRootOnboardingSettings,
} from "~/lib/hooks/useRootOnboarding";
import {
  useWorkspaceMembers,
  type WorkspaceMemberOption,
} from "~/lib/hooks/useWorkspaceMembers";
import {
  MemberAvatar,
  MemberPicker,
  NO_MEMBER,
  memberLabel,
} from "~/components/molecule/member-picker";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Skeleton } from "~/components/ui/skeleton";
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { cn } from "~/lib/utils";

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DURATIONS = [15, 20, 30, 45, 60, 90];
const MAX_HOSTS = 10;
const PREVIEW_DAYS = 14;

function toInput(s: {
  booking_enabled: boolean;
  booking: RootBookingConfig;
  meeting_title: string | null;
  pipeline_id: string | null;
  stage_key: string | null;
  assign_policy: AssignPolicy;
  assign_user_id: string | null;
}): RootOnboardingSettingsInput {
  return {
    booking_enabled: s.booking_enabled,
    booking: s.booking,
    meeting_title: s.meeting_title,
    pipeline_id: s.pipeline_id,
    stage_key: s.stage_key,
    assign_policy: s.assign_policy,
    assign_user_id: s.assign_user_id,
  };
}

/** YYYY-MM-DD for today + n days, in the given timezone. */
function dateInTz(tz: string, addDays = 0): string {
  const d = new Date(Date.now() + addDays * 86_400_000);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function timezones(): string[] {
  try {
    const list = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (list?.length) return list;
  } catch {
    /* older engines */
  }
  return [
    "Europe/Berlin",
    "Europe/Vienna",
    "Europe/Zurich",
    "Europe/Amsterdam",
    "Europe/Brussels",
    "Europe/Paris",
    "Europe/London",
    "America/Toronto",
    "America/Montreal",
    "America/Vancouver",
    "UTC",
  ];
}

function GeneralTab() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const allowed =
    currentWorkspace?.is_root === true &&
    currentWorkspace.member_role === "admin";

  const settingsQuery = useRootOnboardingSettings();
  const pipelinesQuery = useRootPipelines();
  const membersQuery = useWorkspaceMembers();
  const calendarsQuery = useQuery({
    queryKey: ["calendar-accounts"],
    queryFn: listCalendarAccounts,
    enabled: allowed,
  });
  const save = useSaveRootOnboardingSettings();

  const [draft, setDraft] = useState<RootOnboardingSettingsInput | null>(null);
  const [teamRegion, setTeamRegion] = useState<SalesRegion>("europe");
  const saved = settingsQuery.data ? toInput(settingsQuery.data) : null;

  useEffect(() => {
    if (settingsQuery.data && !draft) setDraft(toInput(settingsQuery.data));
  }, [settingsQuery.data, draft]);

  const dirty = useMemo(
    () => !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  if (!currentWorkspace) return null;
  if (!allowed) return <Navigate to="/settings/profile" replace />;

  const members = membersQuery.data?.members ?? [];
  const accounts = calendarsQuery.data?.accounts ?? [];
  const baikal = calendarsQuery.data?.baikal_configs ?? [];

  if (!draft || settingsQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const patch = (p: Partial<RootOnboardingSettingsInput>) =>
    setDraft((d) => (d ? { ...d, ...p } : d));
  const patchBooking = (p: Partial<RootBookingConfig>) =>
    setDraft((d) => (d ? { ...d, booking: { ...d.booking, ...p } } : d));

  const completeHosts = draft.booking.hosts.filter(
    (h) => h.userId && h.targetKey,
  );
  const allHosts = [
    ...draft.booking.hosts,
    ...Object.values(draft.booking.regionHosts ?? {}).flat(),
  ];
  const incompleteHosts = allHosts.filter((h) => !h.userId || !h.targetKey).length;
  const regionTeam = (r: SalesRegion): SalesHost[] =>
    r === "europe" ? draft.booking.hosts : (draft.booking.regionHosts?.[r] ?? []);
  const setRegionTeam = (r: SalesRegion, hosts: SalesHost[]) =>
    r === "europe"
      ? patchBooking({ hosts })
      : patchBooking({ regionHosts: { ...(draft.booking.regionHosts ?? {}), [r]: hosts } });

  const onSave = () => {
    if (incompleteHosts > 0) {
      toast.error(t("settings.onboarding.hostIncomplete"));
      return;
    }
    save.mutate(draft, {
      onSuccess: (s) => {
        setDraft(toInput(s));
        toast.success(t("settings.onboarding.saved"));
      },
      onError: (err) =>
        toast.error(extractErrorMessage(err) || t("settings.onboarding.saveFailed")),
    });
  };

  return (
    <div className="space-y-6">
      <StatusCard
        enabled={draft.booking_enabled}
        hostCount={completeHosts.length}
        onToggle={(v) => patch({ booking_enabled: v })}
      />

      <Section
        icon={<UsersRound className="h-4 w-4" />}
        title={t("settings.onboarding.teamTitle")}
        hint={t("settings.onboarding.teamHint")}
      >
        {/* One team per sales region; a region without people uses Europe's. */}
        <div role="tablist" aria-label={t("settings.onboarding.regions.label")} className="mb-3 inline-flex flex-wrap gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {SALES_REGIONS.map((r) => {
            const count = regionTeam(r).length;
            return (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={teamRegion === r}
                onClick={() => setTeamRegion(r)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors",
                  teamRegion === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`settings.onboarding.regions.${r}`)}
                <span className="tabular-nums text-[11px] text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>
        {teamRegion !== "europe" && regionTeam(teamRegion).length === 0 ? (
          <p className="mb-2 text-xs text-muted-foreground">{t("settings.onboarding.regions.fallback", { region: t(`settings.onboarding.regions.${teamRegion}`) })}</p>
        ) : null}
        <SalesTeam
          key={teamRegion}
          hosts={regionTeam(teamRegion)}
          members={members}
          accounts={accounts}
          baikal={baikal}
          loading={membersQuery.isLoading || calendarsQuery.isLoading}
          onChange={(hosts) => setRegionTeam(teamRegion, hosts)}
        />
        <label className="mt-4 flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <Switch
            checked={draft.booking.checkAllOwnerCalendars}
            onCheckedChange={(v) => patchBooking({ checkAllOwnerCalendars: v })}
            className="mt-0.5"
          />
          <span className="text-sm">
            <span className="font-medium text-foreground">
              {t("settings.onboarding.checkAllTitle")}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t("settings.onboarding.checkAllHint")}
            </span>
          </span>
        </label>
      </Section>

      <Section
        icon={<CalendarClock className="h-4 w-4" />}
        title={t("settings.onboarding.meetingTitle")}
        hint={t("settings.onboarding.meetingHint")}
      >
        <MeetingRules
          booking={draft.booking}
          title={draft.meeting_title}
          onBooking={patchBooking}
          onTitle={(meeting_title) => patch({ meeting_title })}
        />
      </Section>

      <Section
        icon={<Route className="h-4 w-4" />}
        title={t("settings.onboarding.routingTitle")}
        hint={t("settings.onboarding.routingHint")}
      >
        <DealRouting
          draft={draft}
          pipelines={pipelinesQuery.data ?? []}
          members={members}
          onChange={patch}
        />
      </Section>

      {/* Prices: saved on their own (per region), not through the save bar. */}
      <PricingSection />

      <PreviewSection
        booking={{ ...draft.booking, hosts: completeHosts }}
        members={members}
        dirty={dirty}
      />

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onSave={onSave}
        onDiscard={() => saved && setDraft(saved)}
      />
    </div>
  );
}

const TABS = ["general", "ai"] as const;
type Tab = (typeof TABS)[number];

/** Settings → Onboarding (root admins): General | AI assistant, tab kept in `?tab=`. */
export default function OnboardingSettingsPage() {
  const { t } = useTranslation();
  const { currentWorkspace } = useAuthContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const allowed =
    currentWorkspace?.is_root === true &&
    currentWorkspace.member_role === "admin";

  useDocumentMeta({
    titleKey: "settings.onboarding.metaTitle",
    descriptionKey: "settings.onboarding.metaDescription",
    titleSuffix: " - Repraesent",
  });

  if (!currentWorkspace) return null;
  if (!allowed) return <Navigate to="/settings/profile" replace />;

  const wanted = searchParams.get("tab");
  const tab: Tab = wanted && (TABS as readonly string[]).includes(wanted) ? (wanted as Tab) : "general";
  const setTab = (next: string) =>
    setSearchParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        if (next === "general") p.delete("tab");
        else p.set("tab", next);
        return p;
      },
      { replace: true },
    );

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <TabsList variant="line" className="-mb-px">
        <TabsTrigger value="general">{t("settings.onboarding.tabs.general")}</TabsTrigger>
        <TabsTrigger value="ai">{t("settings.onboarding.tabs.ai")}</TabsTrigger>
      </TabsList>
      {/* Both stay mounted so switching tabs never drops unsaved edits. */}
      <TabsContent value="general" forceMount className="data-[state=inactive]:hidden">
        <GeneralTab />
      </TabsContent>
      <TabsContent value="ai" forceMount className="data-[state=inactive]:hidden">
        <AiAssistantTab />
      </TabsContent>
    </Tabs>
  );
}

function StatusCard({
  enabled,
  hostCount,
  onToggle,
}: {
  enabled: boolean;
  hostCount: number;
  onToggle: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const live = enabled && hostCount > 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:p-5",
        live
          ? "border-[#a4dab8] bg-[#a4dab8]/15"
          : "border-border bg-muted/30",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1.5 size-2.5 shrink-0 rounded-full",
            live ? "bg-[#3f9a64]" : "bg-muted-foreground/40",
          )}
          aria-hidden
        />
        <div>
          <p className="text-sm font-semibold text-foreground">
            {live
              ? t("settings.onboarding.statusLive", { count: hostCount })
              : t("settings.onboarding.statusOff")}
          </p>
          <p className="text-sm text-muted-foreground">
            {live
              ? t("settings.onboarding.statusLiveHint")
              : t("settings.onboarding.statusOffHint")}
          </p>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium sm:ml-auto">
        <Switch checked={enabled} onCheckedChange={onToggle} />
        {t("settings.onboarding.bookingToggle")}
      </label>
    </div>
  );
}

function SalesTeam({
  hosts,
  members,
  accounts,
  baikal,
  loading,
  onChange,
}: {
  hosts: SalesHost[];
  members: WorkspaceMemberOption[];
  accounts: CalendarAccount[];
  baikal: BaikalConfig[];
  loading: boolean;
  onChange: (hosts: SalesHost[]) => void;
}) {
  const { t } = useTranslation();
  if (loading) return <Skeleton className="h-24 w-full" />;
  const taken = new Set(hosts.map((h) => h.userId).filter(Boolean));

  return (
    <div className="space-y-2">
      {hosts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          {t("settings.onboarding.teamEmpty")}
        </p>
      ) : null}

      {hosts.map((host, index) => (
        <HostRow
          key={`${index}-${host.userId}`}
          host={host}
          members={members.filter((m) => m.user_id === host.userId || !taken.has(m.user_id))}
          accounts={accounts}
          baikal={baikal}
          onChange={(next) => onChange(hosts.map((h, i) => (i === index ? next : h)))}
          onRemove={() => onChange(hosts.filter((_, i) => i !== index))}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={hosts.length >= MAX_HOSTS || taken.size >= members.length}
        onClick={() => onChange([...hosts, { targetKey: "", userId: "" }])}
      >
        <Plus className="h-3.5 w-3.5" />
        {t("settings.onboarding.addPerson")}
      </Button>
    </div>
  );
}

function MeetingRules({
  booking,
  title,
  onBooking,
  onTitle,
}: {
  booking: RootBookingConfig;
  title: string | null;
  onBooking: (p: Partial<RootBookingConfig>) => void;
  onTitle: (v: string | null) => void;
}) {
  const { t } = useTranslation();
  const zones = useMemo(timezones, []);
  const windowInvalid = booking.window.start >= booking.window.end;

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label={t("settings.onboarding.duration")}>
        <Select
          value={String(booking.durationMinutes)}
          onValueChange={(v) => onBooking({ durationMinutes: Number(v) })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DURATIONS.map((d) => (
              <SelectItem key={d} value={String(d)}>
                {t("settings.onboarding.minutes", { count: d })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field
        label={t("settings.onboarding.hours")}
        error={windowInvalid ? t("settings.onboarding.hoursInvalid") : undefined}
      >
        <div className="flex items-center gap-2">
          <Input
            type="time"
            value={booking.window.start}
            onChange={(e) =>
              onBooking({ window: { ...booking.window, start: e.target.value } })
            }
            className="h-9"
            aria-label={t("settings.onboarding.hoursFrom")}
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="time"
            value={booking.window.end}
            onChange={(e) =>
              onBooking({ window: { ...booking.window, end: e.target.value } })
            }
            className="h-9"
            aria-label={t("settings.onboarding.hoursTo")}
          />
        </div>
      </Field>

      <Field label={t("settings.onboarding.days")} className="md:col-span-2">
        <div className="flex flex-wrap gap-1.5" role="group">
          {WEEKDAYS.map((d) => {
            const on = booking.weekdays.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = on
                    ? booking.weekdays.filter((x) => x !== d)
                    : WEEKDAYS.filter(
                        (x) => x === d || booking.weekdays.includes(x),
                      );
                  if (next.length > 0) onBooking({ weekdays: [...next] });
                }}
                className={cn(
                  "h-9 min-w-12 rounded-lg border px-3 text-sm font-medium transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`settings.onboarding.weekday.${d}`)}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label={t("settings.onboarding.timezone")}>
        <Select
          value={booking.timezone}
          onValueChange={(timezone) => onBooking({ timezone })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {zones.map((z) => (
              <SelectItem key={z} value={z}>
                {z.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={t("settings.onboarding.notice")}>
          <NumberInput
            value={booking.minNoticeHours}
            min={0}
            max={168}
            suffix={t("settings.onboarding.hoursUnit")}
            onChange={(minNoticeHours) => onBooking({ minNoticeHours })}
          />
        </Field>
        <Field label={t("settings.onboarding.horizon")}>
          <NumberInput
            value={booking.maxDaysAhead}
            min={1}
            max={60}
            suffix={t("settings.onboarding.daysUnit")}
            onChange={(maxDaysAhead) => onBooking({ maxDaysAhead })}
          />
        </Field>
      </div>

      <Field
        label={t("settings.onboarding.eventTitle")}
        hint={t("settings.onboarding.eventTitleHint")}
        className="md:col-span-2"
      >
        <Input
          value={title ?? ""}
          placeholder="re:praesent intro — {{business}}"
          maxLength={200}
          onChange={(e) => onTitle(e.target.value || null)}
          className="h-9"
        />
      </Field>
    </div>
  );
}

function DealRouting({
  draft,
  pipelines,
  members,
  onChange,
}: {
  draft: RootOnboardingSettingsInput;
  pipelines: RootPipelineOption[];
  members: WorkspaceMemberOption[];
  onChange: (p: Partial<RootOnboardingSettingsInput>) => void;
}) {
  const { t } = useTranslation();
  const DEFAULT = "__default__";
  const ENTRY = "__entry__";
  const pipeline =
    pipelines.find((p) => p.id === draft.pipeline_id) ??
    pipelines.find((p) => p.is_default) ??
    pipelines[0];
  const entry = pipeline?.stages.find((s) => s.is_entry);

  const policies: Array<{ value: AssignPolicy; label: string; hint: string }> = [
    {
      value: "booked_host",
      label: t("settings.onboarding.assignBooked"),
      hint: t("settings.onboarding.assignBookedHint"),
    },
    {
      value: "fixed",
      label: t("settings.onboarding.assignFixed"),
      hint: t("settings.onboarding.assignFixedHint"),
    },
    {
      value: "none",
      label: t("settings.onboarding.assignNone"),
      hint: t("settings.onboarding.assignNoneHint"),
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label={t("settings.onboarding.pipeline")}>
        <Select
          value={draft.pipeline_id ?? DEFAULT}
          onValueChange={(v) =>
            onChange({ pipeline_id: v === DEFAULT ? null : v, stage_key: null })
          }
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={DEFAULT}>
              {t("settings.onboarding.defaultPipeline")}
            </SelectItem>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t("settings.onboarding.stage")}>
        <Select
          value={draft.stage_key ?? ENTRY}
          onValueChange={(v) => onChange({ stage_key: v === ENTRY ? null : v })}
        >
          <SelectTrigger className="h-9 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ENTRY}>
              {t("settings.onboarding.entryStage", {
                stage: entry?.label ?? entry?.key ?? "—",
              })}
            </SelectItem>
            {(pipeline?.stages ?? []).map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.label ?? s.key}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label={t("settings.onboarding.assign")} className="md:col-span-2">
        <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
          {policies.map((p) => {
            const on = draft.assign_policy === p.value;
            return (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() =>
                  onChange({
                    assign_policy: p.value,
                    assign_user_id: p.value === "fixed" ? draft.assign_user_id : null,
                  })
                }
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  on
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border bg-background hover:border-foreground/20",
                )}
              >
                <span className="block text-sm font-medium text-foreground">
                  {p.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {p.hint}
                </span>
              </button>
            );
          })}
        </div>
        {draft.assign_policy === "fixed" ? (
          <div className="mt-3 max-w-sm">
            <MemberPicker
              members={members}
              value={draft.assign_user_id ?? undefined}
              placeholder={t("settings.onboarding.pickPerson")}
              searchPlaceholder={t("settings.onboarding.searchPeople")}
              emptyText={t("settings.onboarding.noPeople")}
              noneLabel={t("settings.onboarding.nobody")}
              onChange={(id) =>
                onChange({ assign_user_id: id === NO_MEMBER ? null : id })
              }
            />
          </div>
        ) : null}
      </Field>
    </div>
  );
}

/**
 * The page's signature: what a new customer will actually see — the next two
 * weeks, the bookable times, and which sales people are free at each one.
 * Runs on the DRAFT, so every edit above shows its effect before saving.
 */
function PreviewSection({
  booking,
  members,
  dirty,
}: {
  booking: RootBookingConfig;
  members: WorkspaceMemberOption[];
  dirty: boolean;
}) {
  const { t, i18n } = useTranslation();
  const debounced = useDebounce(booking, 600);
  const from = dateInTz(debounced.timezone, 0);
  const to = dateInTz(debounced.timezone, PREVIEW_DAYS - 1);
  const daysQuery = useRootPreviewDays(debounced, from, to);
  const [picked, setPicked] = useState<string | null>(null);

  const firstOpen = daysQuery.data?.days.find(
    (d) => d.state === "open" && d.free > 0,
  )?.date;
  const date = picked ?? firstOpen ?? null;
  const slotsQuery = useRootPreviewSlots(debounced, date);
  const [chosenSlot, setChosenSlot] = useState<string | null>(null);
  const test = useRunRootTestIntake();
  const navigate = useNavigate();

  useEffect(() => setChosenSlot(null), [date]);

  const dayFmt = new Intl.DateTimeFormat(i18n.language, {
    weekday: "short",
    timeZone: "UTC",
  });
  const numFmt = new Intl.DateTimeFormat(i18n.language, {
    day: "numeric",
    timeZone: "UTC",
  });
  const timeFmt = new Intl.DateTimeFormat(i18n.language, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: debounced.timezone,
  });

  const runTest = () =>
    test.mutate(chosenSlot ?? undefined, {
      onSuccess: (r) => {
        toast.success(
          r.booking
            ? t("settings.onboarding.testBooked", {
                person: r.booking.host_label ?? "—",
              })
            : t("settings.onboarding.testCreated"),
          r.dealId
            ? {
                action: {
                  label: t("settings.onboarding.openDeal"),
                  onClick: () => navigate(`/pipeline/${r.dealId}`),
                },
              }
            : undefined,
        );
      },
      onError: (err) =>
        toast.error(extractErrorMessage(err) || t("settings.onboarding.testFailed")),
    });

  const hasHosts = booking.hosts.length > 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-6">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {t("settings.onboarding.previewTitle")}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {dirty
              ? t("settings.onboarding.previewDraft")
              : t("settings.onboarding.previewHint")}
          </p>
        </div>
        <Button
          variant="outline"
          className="sm:ml-auto"
          onClick={runTest}
          disabled={test.isPending || dirty}
          title={dirty ? t("settings.onboarding.testSaveFirst") : undefined}
        >
          <FlaskConical className="h-4 w-4" />
          {chosenSlot
            ? t("settings.onboarding.testWithBooking")
            : t("settings.onboarding.testRun")}
        </Button>
      </div>

      {!hasHosts ? (
        <p className="p-6 text-sm text-muted-foreground">
          {t("settings.onboarding.previewNoHosts")}
        </p>
      ) : daysQuery.isLoading ? (
        <div className="p-6">
          <Skeleton className="h-16 w-full" />
        </div>
      ) : daysQuery.isError ? (
        <p className="flex items-center gap-2 p-6 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {extractErrorMessage(daysQuery.error) ||
            t("settings.onboarding.previewFailed")}
        </p>
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          {daysQuery.data && daysQuery.data.failedHostIndexes.length > 0 ? (
            <p className="flex items-start gap-2 rounded-lg bg-[#f5d74f]/20 px-3 py-2 text-xs text-foreground">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {t("settings.onboarding.previewSomeFailed", {
                names: daysQuery.data.failedHostIndexes
                  .map((i) => booking.hosts[i]?.label ?? "?")
                  .join(", "),
              })}
            </p>
          ) : null}

          {/* Day strip */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="listbox">
            {(daysQuery.data?.days ?? []).map((d) => {
              const bookable = d.state === "open" && d.free > 0;
              const active = d.date === date;
              const noon = new Date(`${d.date}T12:00:00Z`);
              return (
                <button
                  key={d.date}
                  type="button"
                  role="option"
                  aria-selected={active}
                  disabled={!bookable}
                  onClick={() => setPicked(d.date)}
                  className={cn(
                    "flex w-14 shrink-0 flex-col items-center gap-1 rounded-lg border py-2 transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : bookable
                        ? "border-border bg-background hover:border-primary/50"
                        : "border-transparent bg-muted/40 text-muted-foreground/60",
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wide">
                    {dayFmt.format(noon)}
                  </span>
                  <span className="text-lg font-semibold tabular-nums leading-none">
                    {numFmt.format(noon)}
                  </span>
                  <span className="flex h-3 items-center -space-x-1">
                    {bookable
                      ? d.hostIndexes.slice(0, 3).map((i) => (
                          <span
                            key={i}
                            className={cn(
                              "size-2 rounded-full ring-1",
                              active ? "bg-primary-foreground ring-primary" : "bg-primary ring-background",
                            )}
                          />
                        ))
                      : null}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Slots for the day, each showing who is free */}
          {date ? (
            slotsQuery.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : (slotsQuery.data?.slots.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("settings.onboarding.previewDayFull")}
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
                {slotsQuery.data!.slots.map((s) => (
                  <SlotPill
                    key={s.slot}
                    slot={s}
                    label={timeFmt.format(new Date(s.slot.split("--")[0]))}
                    members={members}
                    hosts={booking.hosts}
                    selected={chosenSlot === s.slot}
                    onSelect={() =>
                      setChosenSlot((c) => (c === s.slot ? null : s.slot))
                    }
                  />
                ))}
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("settings.onboarding.previewNothing")}
            </p>
          )}

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CircleCheck className="h-3.5 w-3.5 text-[#3f9a64]" />
            {chosenSlot
              ? t("settings.onboarding.testHintSlot")
              : t("settings.onboarding.testHint")}
          </p>
        </div>
      )}
    </section>
  );
}

function SlotPill({
  slot,
  label,
  members,
  hosts,
  selected,
  onSelect,
}: {
  slot: MergedSlot;
  label: string;
  members: WorkspaceMemberOption[];
  hosts: SalesHost[];
  selected: boolean;
  onSelect: () => void;
}) {
  const people = slot.hostIndexes
    .map((i) => members.find((m) => m.user_id === hosts[i]?.userId))
    .filter((m): m is WorkspaceMemberOption => !!m);
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      title={people.map(memberLabel).join(", ")}
      className={cn(
        "flex items-center justify-between gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-sm font-medium tabular-nums transition-colors active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        selected
          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
          : "border-border bg-background hover:border-primary/50",
      )}
    >
      {label}
      <span className="flex -space-x-2">
        {people.slice(0, 3).map((m) => (
          <span key={m.user_id} className="rounded-full ring-2 ring-background">
            <MemberAvatar member={m} />
          </span>
        ))}
      </span>
    </button>
  );
}

function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  suffix: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="relative">
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (!Number.isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
        className="h-9 pr-12 tabular-nums"
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">
        {suffix}
      </span>
    </div>
  );
}
