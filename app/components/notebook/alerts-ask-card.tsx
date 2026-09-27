import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { BellRing, BellOff, Check, Loader2, X } from "lucide-react";
import { cn } from "~/lib/utils";
import { Panel } from "~/components/notebook/panel";
import { Button } from "~/components/ui/button";
import { enableAlerts, isAlertsOffHere, usePwa, withAlertsTimeout, type DevicePlatform } from "~/lib/pwa/use-pwa";
import { ALERTS_ASK_KEY, isSnoozed, snooze } from "~/lib/pwa/snooze";
import { usePhoneAlertsConfig, useThisDeviceEndpoint } from "~/lib/hooks/use-phone-alerts";

/**
 * How to allow alerts again after "Don't allow": the phone's own settings,
 * because a web page can't ask twice. Shared with Settings → Phone alerts.
 */
export function ReEnableSteps({ platform, className }: { platform: DevicePlatform; className?: string }) {
  const { t } = useTranslation();
  if (platform === "desktop") {
    return <p className={cn("text-[13px] leading-relaxed text-muted-foreground", className)}>{t("pwa.reenable.desktop")}</p>;
  }
  const steps = [1, 2, 3].map((n) => t(`pwa.reenable.${platform}.step${n}`));
  return (
    <ol className={cn("space-y-2", className)}>
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-snug text-foreground">
          <span
            aria-hidden
            className="num mt-px flex size-5 shrink-0 items-center justify-center rounded-full border border-foreground/70 text-[11px] font-semibold"
          >
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** What an alert looks like on the lock screen — labelled as an example. */
export function ExampleAlert() {
  const { t } = useTranslation();
  return (
    <figure className="rounded-2xl border border-border bg-background/80 p-3 shadow-xs" aria-label={t("pwa.example.label")}>
      <div className="flex items-start gap-2.5">
        <img src="/icons/app-192.png" alt="" aria-hidden className="size-8 shrink-0 rounded-[8px] border border-border" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13px] font-semibold text-foreground">{t("pwa.example.title")}</p>
            <span className="shrink-0 text-[11px] text-muted-foreground">{t("pwa.example.when")}</span>
          </div>
          <p className="truncate text-[12.5px] text-muted-foreground">{t("pwa.example.body")}</p>
        </div>
      </div>
      <figcaption className="mt-2 text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
        {t("pwa.example.label")}
      </figcaption>
    </figure>
  );
}

type Phase = "ask" | "working" | "on" | "denied";

/**
 * Today, inside the installed app, alerts not on yet: the soft ask. The
 * phone's permission prompt only ever opens from the "Turn on alerts" tap —
 * never on load — so the one chance to ask isn't wasted.
 */
export function AlertsAskCard() {
  const { t } = useTranslation();
  const env = usePwa();
  const config = usePhoneAlertsConfig();
  const { endpoint, recheck } = useThisDeviceEndpoint();
  const [snoozed, setSnoozed] = useState(true);
  const [phase, setPhase] = useState<Phase | null>(null);

  useEffect(() => {
    // "Turn off for this phone" in Settings is an answer too: don't re-ask.
    setSnoozed(isSnoozed(ALERTS_ASK_KEY) || (typeof Notification !== "undefined" && Notification.permission === "granted" && isAlertsOffHere()));
  }, []);

  useEffect(() => {
    if (!env || phase === "working" || phase === "on") return;
    setPhase(env.permission === "denied" ? "denied" : "ask");
  }, [env, phase]);

  const publicKey = config.data?.enabled ? config.data.public_key : null;
  if (!env || !env.standalone || !env.pushSupported || !publicKey || snoozed || phase === null) return null;
  // Already on for this phone (and not the success moment we're showing).
  if (phase !== "on" && env.permission === "granted" && endpoint !== null) return null;

  const notNow = () => {
    snooze(ALERTS_ASK_KEY, 7);
    setSnoozed(true);
  };

  const turnOn = async () => {
    setPhase("working");
    try {
      const result = await withAlertsTimeout(enableAlerts(publicKey), 60_000);
      if (result === "on") {
        setPhase("on");
        recheck();
        toast.success(t("pwa.alertsAsk.toastOn"));
      } else {
        setPhase(result === "denied" ? "denied" : "ask");
      }
    } catch (err) {
      setPhase("ask");
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
    }
  };

  if (phase === "on") {
    return (
      <Panel className="flex items-start gap-3 p-4 app-fade-up">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <Check className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-foreground">{t("pwa.alertsAsk.on.title")}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t("pwa.alertsAsk.on.body")}</p>
          <Link
            to="/settings/phone-alerts"
            className="mt-2 inline-flex min-h-11 items-center text-[13.5px] font-medium text-foreground underline underline-offset-4"
          >
            {t("pwa.alertsAsk.on.link")}
          </Link>
        </div>
        <button
          type="button"
          onClick={() => setSnoozed(true)}
          aria-label={t("pwa.install.hide")}
          className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </Panel>
    );
  }

  if (phase === "denied") {
    return (
      <Panel className="space-y-3 p-4 app-fade-up">
        <div className="flex items-start gap-3">
          <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BellOff className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[15px] font-semibold text-foreground">{t("pwa.alertsAsk.denied.title")}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{t("pwa.alertsAsk.denied.body")}</p>
          </div>
        </div>
        <ReEnableSteps platform={env.platform} />
        <Button type="button" variant="ghost" className="h-11 w-full" onClick={notNow}>
          {t("pwa.alertsAsk.notNow")}
        </Button>
      </Panel>
    );
  }

  const working = phase === "working";
  return (
    <Panel className="space-y-4 p-4 app-fade-up" aria-labelledby="alerts-ask-title">
      <div className="flex items-start gap-3">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <BellRing className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="alerts-ask-title" className="text-[15.5px] font-semibold leading-snug text-foreground">
            {t("pwa.alertsAsk.title")}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t("pwa.alertsAsk.body")}</p>
        </div>
      </div>
      <ExampleAlert />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" className="h-11 flex-1 text-[15px]" onClick={turnOn} disabled={working}>
          {working ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {working ? t("pwa.alertsAsk.turningOn") : t("pwa.alertsAsk.turnOn")}
        </Button>
        <Button type="button" variant="ghost" className="h-11 sm:w-auto" onClick={notNow} disabled={working}>
          {t("pwa.alertsAsk.notNow")}
        </Button>
      </div>
    </Panel>
  );
}
