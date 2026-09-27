/**
 * Service worker registration + early capture of the install prompt.
 *
 * Imported from root.tsx so `beforeinstallprompt` is caught even when it fires
 * before the Today screen (where the install card lives) has loaded. Nothing
 * here runs during SSR.
 */

/** Chrome's install prompt event (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeInstallState(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getDeferredPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function wasInstalledThisSession(): boolean {
  return installedThisSession;
}

/** Shows Chrome's install dialog. Resolves true when the person accepted. */
export async function promptInstall(): Promise<boolean> {
  const e = deferredPrompt;
  if (!e) return false;
  // A prompt event can be used once.
  deferredPrompt = null;
  emit();
  try {
    await e.prompt();
    const choice = await e.userChoice;
    return choice.outcome === "accepted";
  } catch {
    return false;
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep it for our own "Install" button instead of the browser's banner.
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedThisSession = true;
    emit();
  });
}

function shouldRegister(): boolean {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return false;
  if (import.meta.env.PROD) return true;
  // Dev: only on localhost (a secure context), so push can be tested locally.
  const h = window.location.hostname;
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/**
 * Registers /sw.js once, after the page has loaded (never competes with the
 * first paint). Safe to call many times; returns the same promise.
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (registration) return registration;
  if (!shouldRegister()) {
    registration = Promise.resolve(null);
    return registration;
  }
  registration = new Promise((resolve) => {
    const go = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(resolve)
        .catch(() => resolve(null));
    };
    if (document.readyState === "complete") go();
    else window.addEventListener("load", go, { once: true });
  });
  return registration;
}
