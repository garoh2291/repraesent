import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useSwUpdate } from "./use-sw-update";

/**
 * Mounted once in root.tsx. Client-only work (effects): registers the service
 * worker, offers updates, and follows a tapped alert when the worker asks the
 * page to route itself (a window the worker does not control yet).
 */
export function PwaBoot() {
  const navigate = useNavigate();
  useSwUpdate();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; url?: string } | null;
      if (data?.type !== "NAVIGATE" || typeof data.url !== "string") return;
      try {
        const url = new URL(data.url, window.location.origin);
        if (url.origin !== window.location.origin) return;
        navigate(url.pathname + url.search + url.hash);
      } catch {
        /* ignore malformed */
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [navigate]);

  return null;
}
