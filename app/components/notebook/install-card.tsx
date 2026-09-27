import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Check, Copy, EllipsisVertical, Loader2, Share, SquarePlus, X, Ellipsis } from "lucide-react";
import { cn } from "~/lib/utils";
import { Panel } from "~/components/notebook/panel";
import { Button } from "~/components/ui/button";
import { promptInstall, usePwa, type PwaEnv } from "~/lib/pwa/use-pwa";
import { INSTALL_CARD_KEY, isSnoozed, snooze } from "~/lib/pwa/snooze";
import { usePhoneAlertsConfig } from "~/lib/hooks/use-phone-alerts";

/** Written when the app runs from the home screen (Android shares storage with Chrome). */
const INSTALLED_KEY = "pwa-installed";

function readInstalled(): boolean {
  try {
    return window.localStorage.getItem(INSTALLED_KEY) === "1";
  } catch {
    return false;
  }
}

function markInstalled() {
  try {
    window.localStorage.setItem(INSTALLED_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** The app's own icon, so the steps show what will appear on the home screen. */
function AppTile({ className }: { className?: string }) {
  return (
    <img
      src="/icons/app-192.png"
      alt=""
      aria-hidden
      width={44}
      height={44}
      className={cn("size-11 shrink-0 rounded-[11px] border border-border shadow-xs", className)}
    />
  );
}

/** A small key-cap that looks like the control the person is looking for. */
function Glyph({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground [&_svg]:size-[18px]"
    >
      {children}
    </span>
  );
}

function Step({ n, glyph, title, hint }: { n: number; glyph: React.ReactNode; title: string; hint?: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden
        className="num mt-2 flex size-5 shrink-0 items-center justify-center rounded-full border border-foreground/70 text-[11px] font-semibold text-foreground"
      >
        {n}
      </span>
      {glyph}
      <div className="min-w-0 pt-0.5">
        <p className="text-[14px] font-medium leading-snug text-foreground">{title}</p>
        {hint ? <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{hint}</p> : null}
      </div>
    </li>
  );
}

async function copyCurrentLink(t: (k: string) => string) {
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    toast.success(t("pwa.install.inApp.copied"));
  } catch {
    // Old in-app browsers: fall back to a prompt the person can copy from.
    window.prompt(t("pwa.install.inApp.copy"), url);
  }
}

/**
 * How to add re:praesent to this phone's home screen: iPhone steps, the
 * Android steps (when Chrome gives us no install prompt), or "open this in
 * Safari/Chrome first" inside an in-app browser. Shared by the Today card and
 * Settings → Phone alerts.
 */
export function InstallSteps({ env, className }: { env: PwaEnv; className?: string }) {
  const { t } = useTranslation();

  if (env.inAppBrowser) {
    const browser = env.platform === "android" ? "Chrome" : "Safari";
    return (
      <div className={cn("space-y-3", className)}>
        <p className="text-[14px] font-medium text-foreground">{t("pwa.install.inApp.title", { browser })}</p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">{t("pwa.install.inApp.body", { browser })}</p>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full sm:w-auto"
          onClick={() => void copyCurrentLink(t)}
        >
          <Copy aria-hidden />
          {t("pwa.install.inApp.copy")}
        </Button>
      </div>
    );
  }

  if (env.platform === "android") {
    return (
      <ol className={cn("space-y-3", className)}>
        <Step n={1} glyph={<Glyph><EllipsisVertical /></Glyph>} title={t("pwa.install.android.step1")} />
        <Step n={2} glyph={<Glyph><SquarePlus /></Glyph>} title={t("pwa.install.android.step2")} />
        <Step n={3} glyph={<AppTile className="size-9 rounded-lg" />} title={t("pwa.install.step3")} />
      </ol>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <ol className="space-y-3">
        {/* iOS 26 Safari keeps Share inside the ••• menu, and "Add to Home
            Screen" sits below "More" in the share sheet (seen in the iOS 26.2
            Simulator), so the steps follow what the owner actually sees. */}
        <Step
          n={1}
          glyph={<Glyph>{env.ios26 ? <Ellipsis /> : <Share />}</Glyph>}
          title={t(env.ios26 ? "pwa.install.ios.step1_26" : "pwa.install.ios.step1")}
          hint={t(env.ios26 ? "pwa.install.ios.step1Hint26" : "pwa.install.ios.step1Hint")}
        />
        <Step
          n={2}
          glyph={<Glyph><SquarePlus /></Glyph>}
          title={t("pwa.install.ios.step2")}
          hint={t(env.ios26 ? "pwa.install.ios.step2Hint26" : "pwa.install.ios.step2Hint")}
        />
        <Step
          n={3}
          glyph={<AppTile className="size-9 rounded-lg" />}
          title={t("pwa.install.step3")}
          hint={t("pwa.install.ios.step3Hint")}
        />
      </ol>
      {env.ios26 ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-[12.5px] leading-snug text-muted-foreground">
          {t("pwa.install.ios.ios26")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Today, on a phone, in the browser: "Put re:praesent on your home screen".
 * Hidden inside the installed app, on computers, and for 14 days after ✕.
 */
export function InstallCard() {
  const { t } = useTranslation();
  const env = usePwa();
  const config = usePhoneAlertsConfig();
  const [hidden, setHidden] = useState(true);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!env) return;
    if (env.standalone) {
      markInstalled();
      setHidden(true);
      return;
    }
    setHidden(isSnoozed(INSTALL_CARD_KEY) || (readInstalled() && !env.justInstalled));
  }, [env]);

  if (!env || hidden || env.standalone || !env.isPhone || env.platform === "desktop") return null;

  const hide = () => {
    snooze(INSTALL_CARD_KEY, 14);
    setHidden(true);
  };

  const install = async () => {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  };

  const alertsAvailable = config.data?.enabled === true;

  if (env.justInstalled) {
    return (
      <Panel className="relative flex items-center gap-3 p-4 app-fade-up">
        <AppTile />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-foreground">{t("pwa.install.done.title")}</p>
          <p className="text-[13px] text-muted-foreground">{t("pwa.install.done.body")}</p>
        </div>
        <button
          type="button"
          onClick={hide}
          aria-label={t("pwa.install.hide")}
          className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Check className="size-5" />
        </button>
      </Panel>
    );
  }

  const nativePrompt = env.platform === "android" && !env.inAppBrowser && env.canPromptInstall;

  return (
    <Panel className="relative overflow-hidden app-fade-up" aria-labelledby="install-card-title">
      <button
        type="button"
        onClick={hide}
        aria-label={t("pwa.install.hide")}
        className="absolute right-1 top-1 flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
      <div className="flex items-start gap-3 p-4 pr-12">
        <AppTile />
        <div className="min-w-0">
          <h2 id="install-card-title" className="text-[15.5px] font-semibold leading-snug text-foreground">
            {t("pwa.install.title")}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
            {alertsAvailable ? t("pwa.install.body") : t("pwa.install.bodyNoAlerts")}
          </p>
        </div>
      </div>
      <div className="border-t border-border px-4 py-4">
        {nativePrompt ? (
          <Button type="button" className="h-11 w-full text-[15px]" onClick={install} disabled={installing}>
            {installing ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {installing ? t("pwa.install.android.installing") : t("pwa.install.android.install")}
          </Button>
        ) : (
          <InstallSteps env={env} />
        )}
      </div>
    </Panel>
  );
}
