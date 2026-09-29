import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BellOff,
  BellRing,
  Eye,
  Inbox,
  ListTodo,
  Loader2,
  Monitor,
  Send,
  Smartphone,
  Sunrise,
  Trash2,
  Clock,
  ChevronDown,
} from "lucide-react";
import i18n from "~/i18n";
import { cn } from "~/lib/utils";
import { extractErrorMessage } from "~/lib/api/axios-instance";
import { useDocumentMeta } from "~/lib/hooks/use-document-meta";
import { useAuthContext } from "~/providers/auth-provider";
import {
  deletePhoneAlertDevice,
  phoneAlertsKeys,
  sendPhoneAlertTest,
  updatePhoneAlertPreferences,
  type PhoneAlertDevice,
  type PhoneAlertPreferences,
} from "~/lib/api/phone-alerts";
import {
  usePhoneAlertDevices,
  usePhoneAlertPreferences,
  usePhoneAlertsConfig,
  useThisDeviceEndpoint,
} from "~/lib/hooks/use-phone-alerts";
import { disableAlertsHere, enableAlerts, usePwa, withAlertsTimeout, type PwaEnv } from "~/lib/pwa/use-pwa";
import { InstallSteps } from "~/components/notebook/install-card";
import { ExampleAlert, ReEnableSteps } from "~/components/notebook/alerts-ask-card";
import { Button } from "~/components/ui/button";
import { Switch } from "~/components/ui/switch";
import { Skeleton } from "~/components/ui/skeleton";

export function meta() {
  return [
    { title: `${i18n.t("settings.phoneAlerts.metaTitle")} - Repraesent` },
    { name: "description", content: i18n.t("settings.phoneAlerts.metaDescription") },
  ];
}

/** Matches the eyebrow used by every other settings page. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>;
}

type SwitchKey = "new_inquiry" | "morning_summary" | "task_due" | "show_names";
const SWITCHES: { key: SwitchKey; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "new_inquiry", Icon: Inbox },
  { key: "morning_summary", Icon: Sunrise },
  { key: "task_due", Icon: ListTodo },
  { key: "show_names", Icon: Eye },
];

const ISO_DAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Short weekday names in the UI language, ISO order (Mon … Sun). */
function weekdayNames(lang: string): Record<number, { short: string; long: string }> {
  const out: Record<number, { short: string; long: string }> = {};
  // 1 Jan 2024 was a Monday.
  for (const d of ISO_DAYS) {
    const date = new Date(Date.UTC(2024, 0, d, 12));
    try {
      out[d] = {
        short: new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" }).format(date),
        long: new Intl.DateTimeFormat(lang, { weekday: "long", timeZone: "UTC" }).format(date),
      };
    } catch {
      out[d] = { short: String(d), long: String(d) };
    }
  }
  return out;
}

const hhmm = (v: string | null | undefined, fallback: string) =>
  typeof v === "string" && /^\d{2}:\d{2}/.test(v) ? v.slice(0, 5) : fallback;

function browserTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

function lastUsed(iso: string | null, lang: string, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (!iso) return t("settings.phoneAlerts.devices.neverUsed");
  const then = new Date(iso);
  const days = Math.round((then.getTime() - Date.now()) / 86_400_000);
  let when: string;
  try {
    when =
      Math.abs(days) <= 30
        ? new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(days, "day")
        : new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric" }).format(then);
  } catch {
    when = then.toLocaleDateString();
  }
  return t("settings.phoneAlerts.devices.lastUsed", { when });
}

/* ── This phone ─────────────────────────────────────────────────────────── */

function StatusCard({
  icon,
  title,
  body,
  tone = "neutral",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  body?: string;
  tone?: "on" | "neutral";
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
            tone === "on" ? "bg-foreground text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </span>
        <div className="min-w-0 pt-0.5">
          <p className="text-[15px] font-semibold text-foreground">{title}</p>
          {body ? <p className="mt-0.5 text-sm text-muted-foreground">{body}</p> : null}
        </div>
      </div>
      {children}
    </div>
  );
}

function ThisDevice({
  env,
  publicKey,
  endpoint,
  onChanged,
}: {
  env: PwaEnv;
  publicKey: string;
  endpoint: string | null | undefined;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<"on" | "off" | "test" | null>(null);
  const [justDenied, setJustDenied] = useState(false);
  const DeviceIcon = env.platform === "desktop" ? Monitor : Smartphone;

  if (env.inAppBrowser) {
    return (
      <StatusCard icon={<DeviceIcon />} title={t("settings.phoneAlerts.device.notHereTitle")}>
        <InstallSteps env={env} />
      </StatusCard>
    );
  }

  // iPhone/iPad in Safari: alerts exist only inside the home-screen app.
  if (env.platform === "ios" && !env.standalone) {
    return (
      <StatusCard
        icon={<DeviceIcon />}
        title={t("settings.phoneAlerts.device.installFirstTitle")}
        body={t("settings.phoneAlerts.device.installFirstBody")}
      >
        <InstallSteps env={env} />
      </StatusCard>
    );
  }

  if (!env.pushSupported) {
    return (
      <StatusCard
        icon={<BellOff />}
        title={t("settings.phoneAlerts.device.unsupportedTitle")}
        body={
          env.platform === "ios"
            ? t("settings.phoneAlerts.device.unsupportedIos")
            : t("settings.phoneAlerts.device.unsupportedBrowser")
        }
      />
    );
  }

  if (env.permission === "denied" || justDenied) {
    return (
      <StatusCard
        icon={<BellOff />}
        title={env.platform === "desktop" ? t("pwa.alertsAsk.denied.titleComputer") : t("pwa.alertsAsk.denied.title")}
        body={env.platform === "desktop" ? t("pwa.alertsAsk.denied.bodyComputer") : t("pwa.alertsAsk.denied.body")}
      >
        <ReEnableSteps platform={env.platform} />
      </StatusCard>
    );
  }

  if (endpoint === undefined) return <Skeleton className="h-[132px] w-full rounded-2xl" />;

  const turnOn = async () => {
    setBusy("on");
    try {
      const r = await withAlertsTimeout(enableAlerts(publicKey), 60_000);
      if (r === "on") toast.success(t("pwa.alertsAsk.toastOn"));
      if (r === "denied") setJustDenied(true);
      onChanged();
    } catch (err) {
      console.error("[phone-alerts] turning on failed", err);
      // The phone itself refused (permission granted, subscription not): say so,
      // don't blame the connection.
      // The phone itself refused (permission granted, subscription not), or it
      // never got its background helper: say so, don't blame the connection.
      const name = (err as Error)?.name;
      const key =
        name === "NotAllowedError"
          ? "pwa.alertsAsk.failedDevice"
          : name === "AlertsNotReadyError"
            ? "pwa.alertsAsk.notReady"
            : "pwa.alertsAsk.failed";
      toast.error(t(key), {
        // Development only: the real reason, to tell a browser refusal from a server error.
        description: import.meta.env.DEV ? String(err) : undefined,
      });
    } finally {
      setBusy(null);
    }
  };

  const turnOff = async () => {
    setBusy("off");
    try {
      await disableAlertsHere();
      toast.success(t("settings.phoneAlerts.device.turnedOff"));
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const test = async () => {
    if (!endpoint) return;
    setBusy("test");
    try {
      const r = await sendPhoneAlertTest(endpoint);
      if (r.sent > 0) toast.success(t("settings.phoneAlerts.device.testSent"));
      else toast.info(t("settings.phoneAlerts.device.testNone"));
    } catch (error) {
      toast.error(extractErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  if (env.permission === "granted" && endpoint) {
    return (
      <StatusCard
        icon={<BellRing />}
        tone="on"
        title={
          env.platform === "desktop"
            ? t("settings.phoneAlerts.device.onTitleComputer")
            : t("settings.phoneAlerts.device.onTitle")
        }
        body={t("settings.phoneAlerts.device.onBody")}
      >
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="h-11 sm:h-10" onClick={test} disabled={busy !== null}>
            {busy === "test" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
            {t("settings.phoneAlerts.device.test")}
          </Button>
          <Button type="button" variant="outline" className="h-11 sm:h-10" onClick={turnOff} disabled={busy !== null}>
            {busy === "off" ? <Loader2 className="animate-spin" aria-hidden /> : <BellOff aria-hidden />}
            {env.platform === "desktop"
              ? t("settings.phoneAlerts.device.turnOffComputer")
              : t("settings.phoneAlerts.device.turnOff")}
          </Button>
        </div>
      </StatusCard>
    );
  }

  return (
    <StatusCard
      icon={<DeviceIcon />}
      title={
        env.platform === "desktop"
          ? t("settings.phoneAlerts.device.offTitleComputer")
          : t("settings.phoneAlerts.device.offTitle")
      }
      body={t("settings.phoneAlerts.device.offBody")}
    >
      <ExampleAlert />
      <Button type="button" className="h-11 w-full sm:h-10 sm:w-auto" onClick={turnOn} disabled={busy !== null}>
        {busy === "on" ? <Loader2 className="animate-spin" aria-hidden /> : <BellRing aria-hidden />}
        {busy === "on" ? t("pwa.alertsAsk.turningOn") : t("pwa.alertsAsk.turnOn")}
      </Button>
    </StatusCard>
  );
}

/* ── Active hours ───────────────────────────────────────────────────────── */

function HoursPreview({ days, start, end }: { days: number[]; start: string; end: string }) {
  const { t } = useTranslation();
  let line: string;
  if (start === end) line = t("settings.phoneAlerts.hours.sameTime");
  else if (start === "00:00" && (end === "23:59" || end === "24:00")) line = t("settings.phoneAlerts.hours.allDay");
  else if (end < start) line = t("settings.phoneAlerts.hours.overnight", { start, end });
  else line = t("settings.phoneAlerts.hours.preview", { start });
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      <p className={cn(start === end ? "text-destructive" : "text-foreground")}>{line}</p>
      {days.length > 0 && days.length < 7 ? (
        <p className="text-muted-foreground">{t("settings.phoneAlerts.hours.otherDays")}</p>
      ) : null}
    </div>
  );
}

function ActiveHours({
  prefs,
  onSave,
}: {
  prefs: PhoneAlertPreferences;
  onSave: (patch: Partial<PhoneAlertPreferences>) => void;
}) {
  const { t, i18n: i18nInstance } = useTranslation();
  const names = useMemo(() => weekdayNames(i18nInstance.language), [i18nInstance.language]);
  const [days, setDays] = useState<number[]>(() => [...(prefs.active_days ?? [])].sort());
  const [start, setStart] = useState(() => hhmm(prefs.active_start, "08:00"));
  const [end, setEnd] = useState(() => hhmm(prefs.active_end, "20:00"));
  const timer = useRef<number | null>(null);
  const tz = prefs.timezone ?? browserTimezone();

  // Save a moment after the last change: chips and time wheels fire often.
  const queue = (next: { days: number[]; start: string; end: string }) => {
    if (timer.current) window.clearTimeout(timer.current);
    if (next.start === next.end || next.days.length === 0) return;
    timer.current = window.setTimeout(() => {
      onSave({ active_days: next.days, active_start: next.start, active_end: next.end });
    }, 700);
  };
  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const toggleDay = (d: number) => {
    const has = days.includes(d);
    if (has && days.length === 1) {
      toast.error(t("settings.phoneAlerts.hours.pickOneDay"));
      return;
    }
    const next = has ? days.filter((x) => x !== d) : [...days, d].sort();
    setDays(next);
    queue({ days: next, start, end });
  };

  // Our own field look: iOS draws time inputs with an arrow glued to the
  // right edge — appearance-none drops it; clock + chevron are ours.
  const timeClass =
    // iOS draws the time at the top of a restyled time field: pin the line
  // height to the field's inner height and zero the inner margins so it sits
  // on the same centre line as the clock and chevron.
  "num block h-11 min-h-11 w-full appearance-none rounded-lg border border-border bg-background py-0 pl-10 pr-9 text-left text-[16px] leading-[42px] font-medium text-foreground outline-none transition-colors hover:border-foreground/30 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 [&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-date-and-time-value]:leading-[42px] [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:leading-[42px] [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-inner-spin-button]:hidden";
  const timeField = (value: string, onValue: (v: string) => void) => (
    <span className="relative block">
      <Clock className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input type="time" step={60} value={value} onChange={(e) => onValue(e.target.value)} className={timeClass} />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </span>
  );

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-foreground">{t("settings.phoneAlerts.hours.days")}</legend>
        <div className="grid grid-cols-7 gap-1.5">
          {ISO_DAYS.map((d) => {
            const on = days.includes(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={names[d].long}
                onClick={() => toggleDay(d)}
                className={cn(
                  "press min-h-11 rounded-lg border text-[13px] font-medium transition-colors",
                  on
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {names[d].short.replace(/\.$/, "")}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">{t("settings.phoneAlerts.hours.from")}</span>
          {timeField(start, (raw) => {
            const v = hhmm(raw, start);
            setStart(v);
            queue({ days, start: v, end });
          })}
        </label>
        <label className="space-y-1.5">
          <span className="block text-sm font-medium text-foreground">{t("settings.phoneAlerts.hours.to")}</span>
          {timeField(end, (raw) => {
            const v = hhmm(raw, end);
            setEnd(v);
            queue({ days, start, end: v });
          })}
        </label>
      </div>

      <HoursPreview days={days} start={start} end={end} />
      {tz ? (
        <p className="text-xs text-muted-foreground">
          {t("settings.phoneAlerts.hours.timezone", { tz: tz.replace(/_/g, " ") })}
        </p>
      ) : null}
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────────────── */

/**
 * Settings → Phone alerts: this phone's status with the one next step, what
 * to send, active hours, and every phone that gets this person's alerts.
 * Per person, not per workspace.
 */
export default function SettingsPhoneAlerts() {
  const { t, i18n: i18nInstance } = useTranslation();
  useDocumentMeta({
    titleKey: "settings.phoneAlerts.metaTitle",
    descriptionKey: "settings.phoneAlerts.metaDescription",
    titleSuffix: " - Repraesent",
  });
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const env = usePwa();
  const config = usePhoneAlertsConfig();
  const enabled = config.data?.enabled === true && !!config.data.public_key;
  const prefs = usePhoneAlertPreferences(enabled);
  const devices = usePhoneAlertDevices(enabled);
  const { endpoint, recheck } = useThisDeviceEndpoint();
  const prefsKey = phoneAlertsKeys.preferences(user?.id);
  const devicesKey = phoneAlertsKeys.devices(user?.id);

  const save = useMutation({
    mutationFn: (patch: Partial<PhoneAlertPreferences>) => updatePhoneAlertPreferences(patch),
    onMutate: (patch) => {
      const previous = queryClient.getQueryData<PhoneAlertPreferences>(prefsKey);
      if (previous) queryClient.setQueryData(prefsKey, { ...previous, ...patch });
      return { previous };
    },
    onSuccess: (fresh) => {
      queryClient.setQueryData(prefsKey, fresh);
      toast.success(t("settings.phoneAlerts.saved"), { id: "phone-alerts-saved" });
    },
    onError: (error, _patch, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(prefsKey, ctx.previous);
      toast.error(extractErrorMessage(error));
    },
  });

  const remove = useMutation({
    mutationFn: async (device: PhoneAlertDevice) => {
      // This phone: also drop the browser's subscription, so it stays off.
      if (endpoint && device.endpoint === endpoint) await disableAlertsHere();
      else await deletePhoneAlertDevice(device.id);
    },
    onSuccess: () => {
      toast.success(t("settings.phoneAlerts.devices.removed"));
      recheck();
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: devicesKey }),
  });

  const onDeviceChanged = () => {
    recheck();
    void queryClient.invalidateQueries({ queryKey: devicesKey });
  };

  if (config.isPending) {
    return <Skeleton className="h-[240px] w-full rounded-2xl" />;
  }

  if (!enabled) {
    return <p className="text-sm text-muted-foreground">{t("settings.phoneAlerts.unavailable")}</p>;
  }

  const deviceLabel = (d: PhoneAlertDevice) =>
    d.label?.trim() || t(`settings.phoneAlerts.devices.platform.${d.platform}`, { defaultValue: d.platform });

  return (
    <div className="space-y-8 app-fade-up app-fade-up-d2">
      <section className="space-y-4">
        <SectionLabel>
          {env?.platform === "desktop" ? t("settings.phoneAlerts.thisComputer") : t("settings.phoneAlerts.thisPhone")}
        </SectionLabel>
        {env ? (
          <ThisDevice env={env} publicKey={config.data!.public_key!} endpoint={endpoint} onChanged={onDeviceChanged} />
        ) : (
          <Skeleton className="h-[132px] w-full rounded-2xl" />
        )}
        {env?.platform === "desktop" ? (
          <p className="text-xs text-muted-foreground">{t("settings.phoneAlerts.desktopNote")}</p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>{t("settings.phoneAlerts.whatLabel")}</SectionLabel>
          <p className="text-sm text-muted-foreground">{t("settings.phoneAlerts.whatDescription")}</p>
        </div>
        {prefs.isPending || !prefs.data ? (
          <Skeleton className="h-[300px] w-full rounded-2xl" />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {SWITCHES.map(({ key, Icon }) => {
              const on = !!prefs.data![key];
              const titleId = `phone-alert-${key}`;
              return (
                <li key={key} className="flex gap-4 p-4 sm:p-5">
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors",
                      on ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p id={titleId} className="text-sm font-semibold text-foreground">
                        {t(`settings.phoneAlerts.kinds.${key}.title`)}
                      </p>
                      <p className="text-sm text-muted-foreground">{t(`settings.phoneAlerts.kinds.${key}.desc`)}</p>
                    </div>
                    {/* 44 px touch target around the switch. */}
                    <label className="-m-2 flex min-h-11 min-w-11 items-center justify-center p-2">
                      <Switch
                        checked={on}
                        disabled={save.isPending}
                        onCheckedChange={(v) => save.mutate({ [key]: v })}
                        aria-labelledby={titleId}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>{t("settings.phoneAlerts.hours.label")}</SectionLabel>
          <p className="text-sm text-muted-foreground">{t("settings.phoneAlerts.hours.description")}</p>
        </div>
        {prefs.data ? (
          <ActiveHours
            // The draft is read once; saves only write it back.
            prefs={prefs.data}
            onSave={(patch) => save.mutate(patch)}
          />
        ) : (
          <Skeleton className="h-[220px] w-full rounded-2xl" />
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-0.5">
          <SectionLabel>{t("settings.phoneAlerts.devices.label")}</SectionLabel>
          <p className="text-sm text-muted-foreground">{t("settings.phoneAlerts.devices.description")}</p>
        </div>
        {devices.isPending ? (
          <Skeleton className="h-[120px] w-full rounded-2xl" />
        ) : !devices.data?.length ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
            {t("settings.phoneAlerts.devices.empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {devices.data.map((d) => {
              const isThis = !!endpoint && d.endpoint === endpoint;
              const Icon = d.platform === "desktop" ? Monitor : Smartphone;
              return (
                <li key={d.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-medium text-foreground">
                      <span className="truncate">{deviceLabel(d)}</span>
                      {isThis ? (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {d.platform === "desktop"
                            ? t("settings.phoneAlerts.devices.thisComputer")
                            : t("settings.phoneAlerts.devices.thisPhone")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {lastUsed(d.last_seen_at, i18nInstance.language, t)}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 shrink-0 px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => remove.mutate(d)}
                    disabled={remove.isPending}
                    aria-label={`${t("settings.phoneAlerts.devices.remove")}: ${deviceLabel(d)}`}
                  >
                    {remove.isPending && remove.variables?.id === d.id ? (
                      <Loader2 className="animate-spin" aria-hidden />
                    ) : (
                      <Trash2 aria-hidden />
                    )}
                    <span className="hidden sm:inline">{t("settings.phoneAlerts.devices.remove")}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        {t("settings.phoneAlerts.emailNote")}{" "}
        <Link to="/settings/email-notifications" className="font-medium text-primary hover:underline">
          {t("settings.phoneAlerts.emailLink")}
        </Link>
      </p>
    </div>
  );
}
