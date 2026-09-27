import { useSyncExternalStore } from "react";
import {
  getDeferredPrompt,
  promptInstall,
  registerServiceWorker,
  subscribeInstallState,
  wasInstalledThisSession,
} from "./register";
import {
  deletePushSubscription,
  getPhoneAlertsConfig,
  savePushSubscription,
  type PushPlatform,
} from "~/lib/api/phone-alerts";

/**
 * What this phone / browser can do, for the install card, the alerts ask and
 * Settings → Phone alerts. Everything is read in the browser only: during SSR
 * and hydration `usePwa()` returns `null`, so no screen can mismatch.
 */

export type DevicePlatform = "ios" | "android" | "desktop";
export type AlertPermission = NotificationPermission | "unsupported";

export interface PwaEnv {
  platform: DevicePlatform;
  /** Opened from the home-screen icon (not a browser tab). */
  standalone: boolean;
  /** Instagram, Facebook, Gmail/Google app, LINE, Android WebView… */
  inAppBrowser: boolean;
  /** Touch device narrower than the desktop layout. */
  isPhone: boolean;
  /** iOS 26+ ("Open as Web App" switch in the Add to Home Screen sheet). */
  ios26: boolean;
  /** Push works here right now (iOS: only inside the installed app, 16.4+). */
  pushSupported: boolean;
  permission: AlertPermission;
  /** Chrome/Edge handed us an install prompt we can show. */
  canPromptInstall: boolean;
  /** `appinstalled` fired during this visit. */
  justInstalled: boolean;
}

export function detectPlatform(): DevicePlatform {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS 13+ asks for the desktop site and reports "Macintosh".
  if (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "desktop";
}

export function detectInAppBrowser(): boolean {
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FB_IAB|Instagram|Line\/|GSA\/|LinkedInApp|MicroMessenger|Snapchat|musical_ly|BytedanceWebview|TikTok|Twitter/i.test(ua)) {
    return true;
  }
  // Android WebView.
  if (/Android/i.test(ua) && /; wv\)/.test(ua)) return true;
  // iOS WKWebView inside another app: no "Safari" token, and not one of the
  // real browsers (which can all add to the home screen since iOS 16.4).
  if (/iPhone|iPad|iPod/i.test(ua) && !/Safari\//.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)) return true;
  return false;
}

export function detectStandalone(): boolean {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
  } catch {
    /* very old browsers */
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIos26(): boolean {
  const ua = navigator.userAgent;
  // iOS 26 Safari keeps "OS 18_6" in the UA but reports Version/26.
  const safari = /Version\/(\d+)/.exec(ua);
  const os = /OS (\d+)[_.]\d+/.exec(ua);
  return (!!safari && Number(safari[1]) >= 26) || (!!os && Number(os[1]) >= 26);
}

export function detectPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function detectPermission(): AlertPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function detectIsPhone(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches && window.innerWidth < 1024;
  } catch {
    return false;
  }
}

function compute(): PwaEnv {
  const platform = detectPlatform();
  return {
    platform,
    standalone: detectStandalone(),
    inAppBrowser: detectInAppBrowser(),
    isPhone: detectIsPhone(),
    ios26: platform === "ios" && detectIos26(),
    pushSupported: detectPushSupported(),
    permission: detectPermission(),
    canPromptInstall: !!getDeferredPrompt(),
    justInstalled: wasInstalledThisSession(),
  };
}

/* ── Store ─────────────────────────────────────────────────────────────── */

const listeners = new Set<() => void>();
let snapshot: PwaEnv | null = null;
let wired = false;

/** Re-reads everything (after a permission prompt, returning from Settings…). */
export function refreshPwaEnv() {
  if (typeof window === "undefined") return;
  snapshot = compute();
  listeners.forEach((l) => l());
}

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  subscribeInstallState(refreshPwaEnv);
  // Coming back from the phone's Settings app may have changed the permission.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshPwaEnv();
  });
  window.addEventListener("resize", refreshPwaEnv);
}

function subscribe(l: () => void) {
  wire();
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getSnapshot(): PwaEnv | null {
  if (typeof window === "undefined") return null;
  if (!snapshot) snapshot = compute();
  return snapshot;
}

const getServerSnapshot = () => null;

/** `null` on the server and during hydration; the device's facts after. */
export function usePwa(): PwaEnv | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { promptInstall };

/* ── Push subscription ─────────────────────────────────────────────────── */

/** Set when the person turns alerts off for this phone; stops silent re-subscribing. */
const OPT_OUT_KEY = "phone-alerts-off-here";

function readOptOut(): boolean {
  try {
    return window.localStorage.getItem(OPT_OUT_KEY) === "1";
  } catch {
    return false;
  }
}

/** The person turned alerts off for this phone (or signed out here). */
export function isAlertsOffHere(): boolean {
  return typeof window !== "undefined" && readOptOut();
}

function writeOptOut(off: boolean) {
  try {
    if (off) window.localStorage.setItem(OPT_OUT_KEY, "1");
    else window.localStorage.removeItem(OPT_OUT_KEY);
  } catch {
    /* private mode */
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return true; // browser doesn't expose it; assume unchanged
  const a = new Uint8Array(current);
  if (a.length !== key.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== key[i]) return false;
  return true;
}

function browserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

function toInput(sub: PushSubscription) {
  const json = sub.toJSON();
  const platform: PushPlatform = detectPlatform();
  return {
    endpoint: sub.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? "" },
    platform,
    timezone: browserTimezone(),
  };
}

/**
 * The active registration, kept once known. iOS only lets
 * `pushManager.subscribe()` run as the direct result of a tap — any await
 * before it (even an already-resolved one) loses the tap — so the "Turn on"
 * handler must be able to reach the registration synchronously.
 */
let knownRegistration: ServiceWorkerRegistration | null = null;

if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  void navigator.serviceWorker.ready.then((r) => {
    knownRegistration = r;
  });
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  if (knownRegistration) return knownRegistration;
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  knownRegistration = reg;
  return reg;
}

/** This device's live push subscription, if any. */
export async function getThisDeviceSubscription(): Promise<PushSubscription | null> {
  if (!detectPushSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

/**
 * Subscribe this device (permission must already be granted) and tell the
 * server. Re-subscribes when the server key changed.
 */
export async function subscribeThisDevice(
  publicKey: string,
  opts: { reenable?: boolean } = {},
): Promise<PushSubscription> {
  const key = urlBase64ToUint8Array(publicKey);
  const reg = await readyRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, key)) {
    await sub.unsubscribe().catch(() => undefined);
    sub = null;
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  }
  await savePushSubscription({ ...toInput(sub), reenable: opts.reenable });
  writeOptOut(false);
  return sub;
}

export type EnableResult = "on" | "denied" | "dismissed";

/**
 * The "Turn on alerts" tap. Asks for permission FIRST — iOS only shows the
 * prompt when it is the direct result of a tap, so nothing may be awaited
 * before it — then subscribes.
 */
export async function enableAlerts(publicKey: string): Promise<EnableResult> {
  const reg = knownRegistration;
  if (reg) {
    // subscribe() is the FIRST thing the tap does: it shows the permission
    // prompt itself (Safari and Chrome), and iOS refuses it once anything
    // has been awaited before it ("NotAllowedError").
    let sub: PushSubscription;
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    } catch (err) {
      refreshPwaEnv();
      if (typeof Notification !== "undefined" && Notification.permission === "denied") return "denied";
      if (typeof Notification !== "undefined" && Notification.permission === "default") return "dismissed";
      // Subscribed before with another server key: replace it (rare; outside the tap is fine on Chrome).
      if ((err as DOMException)?.name === "InvalidStateError") {
        await subscribeThisDevice(publicKey, { reenable: true });
        return "on";
      }
      throw err;
    }
    refreshPwaEnv();
    await savePushSubscription({ ...toInput(sub), reenable: true });
    writeOptOut(false);
    return "on";
  }
  // No registration known yet (very first second after load): the classic order.
  const permission = await Notification.requestPermission();
  refreshPwaEnv();
  if (permission === "denied") return "denied";
  if (permission !== "granted") return "dismissed";
  await subscribeThisDevice(publicKey, { reenable: true });
  return "on";
}

/** "Turn off for this phone": server first, then the browser subscription. */
export async function disableAlertsHere(): Promise<void> {
  writeOptOut(true);
  const sub = await getThisDeviceSubscription();
  if (!sub) return;
  try {
    await deletePushSubscription(sub.endpoint);
  } finally {
    await sub.unsubscribe().catch(() => undefined);
  }
}

/**
 * Signing out: this phone stops getting alerts for this person (server row
 * and browser subscription), and is not silently re-subscribed for whoever
 * signs in next — they turn alerts on themselves.
 */
export async function forgetThisDeviceForAlerts(): Promise<void> {
  if (typeof window === "undefined" || !detectPushSupported()) return;
  await disableAlertsHere();
}

function isDeviceRemoved(err: unknown): boolean {
  const res = (err as { response?: { status?: number; data?: { code?: string } } })?.response;
  return res?.status === 410 && res.data?.code === "DEVICE_REMOVED";
}

let refreshedThisOpen = false;

/**
 * Once per app open: re-send this device's subscription so the server keeps
 * `last_seen_at` fresh and learns about a subscription the browser replaced
 * (`pushsubscriptionchange` — the worker cannot reach the API itself).
 * Silent, never prompts, and respects "Turn off for this phone".
 */
export async function refreshThisDeviceSubscription(force = false): Promise<void> {
  if (typeof window === "undefined") return;
  if (refreshedThisOpen && !force) return;
  refreshedThisOpen = true;
  if (!detectPushSupported() || Notification.permission !== "granted" || readOptOut()) return;
  try {
    const config = await getPhoneAlertsConfig();
    if (!config.enabled || !config.public_key) return;
    const sub = await getThisDeviceSubscription();
    if (sub && sameKey(sub, urlBase64ToUint8Array(config.public_key))) {
      try {
        await savePushSubscription(toInput(sub));
      } catch (err) {
        // Removed under "Your phones" (maybe from another device): honour it
        // here too — stop the browser subscription and don't re-subscribe.
        if (isDeviceRemoved(err)) {
          writeOptOut(true);
          await sub.unsubscribe().catch(() => undefined);
        }
      }
      return;
    }
    // Lost or stale (key rotated / replaced by the browser): subscribe again.
    await subscribeThisDevice(config.public_key);
  } catch {
    /* next open tries again */
  }
}
