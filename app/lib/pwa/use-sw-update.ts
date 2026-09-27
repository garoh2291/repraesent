import { useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { registerServiceWorker } from "./register";

const TOAST_ID = "sw-update";

/**
 * A new service worker is waiting → "New version ready · Reload". Tapping
 * Reload activates it (SKIP_WAITING) and reloads once it has taken over.
 * Installed apps stay open for days, so we also check for an update whenever
 * the app comes back to the front.
 */
export function useSwUpdate() {
  const { t } = useTranslation();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let reloading = false;
    let reg: ServiceWorkerRegistration | null = null;

    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };

    const offer = (worker: ServiceWorker) => {
      toast(t("pwa.update.title"), {
        id: TOAST_ID,
        duration: Infinity,
        action: {
          label: t("pwa.update.reload"),
          onClick: () => {
            navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
            worker.postMessage({ type: "SKIP_WAITING" });
          },
        },
      });
    };

    const watch = (r: ServiceWorkerRegistration) => {
      // Only an *update* counts: the very first install has no controller.
      if (r.waiting && navigator.serviceWorker.controller) offer(r.waiting);
      r.addEventListener("updatefound", () => {
        const incoming = r.installing;
        if (!incoming) return;
        incoming.addEventListener("statechange", () => {
          if (incoming.state === "installed" && navigator.serviceWorker.controller) offer(incoming);
        });
      });
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") reg?.update().catch(() => undefined);
    };

    void registerServiceWorker().then((r) => {
      if (cancelled || !r) return;
      reg = r;
      watch(r);
    });
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
