import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowDown, ArrowUp, Loader2, Monitor, Smartphone } from "lucide-react";
import type {
  ReAppointmentTarget,
  ReAppointmentTargetPosition,
} from "~/lib/wordpress/plugin-settings-types";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { TARGET_POSITIONS } from "./constants";

const PICKER_MIN_HEIGHT = 420;
const PICKER_MAX_HEIGHT = 20000;
const PICKER_MOBILE_WIDTH = 390;
const PICKER_READY_TIMEOUT_MS = 8000;

/** Why the live picker gave up, so the fallback can say something useful. */
export type PickerFailure = "timeout" | "error";

/**
 * Whether a message origin belongs to the site we framed. The iframe's real
 * origin can differ from the one we derived from `picker_url`: WordPress stores
 * `home` as (say) `https://example.com` while the site canonically redirects to
 * `https://www.example.com`, so the framed document ends up on the redirected
 * origin. Treating those as different silently drops the `ready` handshake and
 * the picker looks broken. Accept a leading `www.` either way and an http→https
 * upgrade; everything else is still a stranger.
 */
function isFrameOrigin(expected: string, actual: string): boolean {
  if (expected === actual) return true;
  try {
    const e = new URL(expected);
    const a = new URL(actual);
    if (e.port !== a.port) return false;
    if (
      e.protocol !== a.protocol &&
      !(e.protocol === "http:" && a.protocol === "https:")
    ) {
      return false;
    }
    const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");
    return bare(e.hostname) === bare(a.hostname);
  } catch {
    return false;
  }
}

/**
 * The live placement picker: loads the customer's own front end (via a signed,
 * login-free URL) in an iframe where every theme slot becomes a clickable drop
 * zone. It mirrors the WordPress admin bridge (`admin-preview.js` +
 * `picker.js`): the iframe posts the current slot selection / picked selectors
 * up, and we push the form's selection back down.
 *
 * Message contract (must match `assets/js/picker.js`):
 *   iframe → parent : reappt-picker-select { slots }
 *   iframe → parent : reappt-picker-ready | reappt-picker-height { height }
 *   iframe → parent : reappt-picker-scroll-to { top }
 *   iframe → parent : reappt-picker-pick { target: { sel, pos } }
 *   parent → iframe : reappt-picker-set { slots }
 *   parent → iframe : reappt-picker-mode { mode: 'pick' | 'slots' }
 */
export function LivePlacementPicker({
  pickerUrl,
  selectedSlots,
  onSlotsChange,
  onPickTarget,
  onUnavailable,
  pickMode,
}: {
  pickerUrl: string;
  selectedSlots: string[];
  onSlotsChange: (slots: string[]) => void;
  onPickTarget: (target: ReAppointmentTarget) => void;
  onUnavailable: (reason: PickerFailure) => void;
  pickMode: boolean;
}) {
  const { t } = useTranslation();

  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  const iframeOrigin = useMemo(() => {
    try {
      return new URL(pickerUrl).origin;
    } catch {
      return "";
    }
  }, [pickerUrl]);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState(PICKER_MIN_HEIGHT);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const guardRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markReady = useCallback(() => {
    loadedRef.current = true;
    setLoaded(true);
    if (guardRef.current) {
      clearTimeout(guardRef.current);
      guardRef.current = null;
    }
  }, []);

  // Start a watchdog as soon as we mount: if the framed site never speaks the
  // picker protocol within the window (older plugin, framing blocked by
  // X-Frame-Options/CSP, unreachable), give up and let the parent fall back to
  // the manual list rather than spin forever. `onLoad` alone isn't reliable —
  // a frame blocked by X-Frame-Options may never fire it.
  useEffect(() => {
    guardRef.current = setTimeout(() => {
      if (!loadedRef.current) onUnavailableRef.current("timeout");
    }, PICKER_READY_TIMEOUT_MS);
    return () => {
      if (guardRef.current) clearTimeout(guardRef.current);
    };
  }, []);

  // Keep the latest callbacks / selection in refs so the message listener can
  // stay bound for the iframe's lifetime instead of rebinding every render.
  const onSlotsChangeRef = useRef(onSlotsChange);
  onSlotsChangeRef.current = onSlotsChange;
  const onPickTargetRef = useRef(onPickTarget);
  onPickTargetRef.current = onPickTarget;
  const selectedSlotsRef = useRef(selectedSlots);
  selectedSlotsRef.current = selectedSlots;

  // The origin we actually talk to. Seeded from `picker_url` and replaced with
  // the frame's real origin the first time it speaks, so a canonical redirect
  // (www ↔ apex, http → https) doesn't leave us posting into the void.
  const frameOriginRef = useRef(iframeOrigin);
  useEffect(() => {
    frameOriginRef.current = iframeOrigin;
  }, [iframeOrigin]);

  const postToIframe = useCallback((message: Record<string, unknown>) => {
    const win = iframeRef.current?.contentWindow;
    const target = frameOriginRef.current;
    if (win && target) win.postMessage(message, target);
  }, []);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!iframeOrigin || !isFrameOrigin(iframeOrigin, event.origin)) return;
      frameOriginRef.current = event.origin;
      const data = (event.data ?? {}) as {
        type?: string;
        slots?: unknown;
        height?: unknown;
        top?: unknown;
        target?: { sel?: unknown; pos?: unknown };
      };
      switch (data.type) {
        case "reappt-picker-select":
          onSlotsChangeRef.current(
            Array.isArray(data.slots) ? data.slots.map(String) : [],
          );
          break;
        case "reappt-picker-ready":
          postToIframe({
            type: "reappt-picker-set",
            slots: selectedSlotsRef.current,
          });
          applyHeight(data.height);
          markReady();
          break;
        case "reappt-picker-height":
          applyHeight(data.height);
          break;
        case "reappt-picker-scroll-to": {
          const top = Math.max(0, Number(data.top) - 24);
          frameRef.current?.scrollTo({ top, behavior: "smooth" });
          break;
        }
        case "reappt-picker-pick": {
          const sel = String(data.target?.sel ?? "").trim();
          if (sel) {
            const pos = String(data.target?.pos ?? "after");
            onPickTargetRef.current({
              sel,
              pos: (TARGET_POSITIONS as readonly string[]).includes(pos)
                ? (pos as ReAppointmentTargetPosition)
                : "after",
            });
          }
          break;
        }
        default:
          break;
      }

      function applyHeight(value: unknown) {
        const n = Number(value);
        if (Number.isFinite(n) && n > 0) {
          setHeight(Math.min(PICKER_MAX_HEIGHT, Math.max(PICKER_MIN_HEIGHT, n)));
        }
      }
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [iframeOrigin, postToIframe, markReady]);

  // Push the form's selection into the iframe whenever it changes (after the
  // iframe has announced it's ready).
  useEffect(() => {
    if (loaded) postToIframe({ type: "reappt-picker-set", slots: selectedSlots });
  }, [selectedSlots, loaded, postToIframe]);

  // Toggle the iframe's free element-pick mode to match the parent button.
  useEffect(() => {
    if (loaded) {
      postToIframe({
        type: "reappt-picker-mode",
        mode: pickMode ? "pick" : "slots",
      });
    }
  }, [pickMode, loaded, postToIframe]);

  function jump(target: "header" | "footer") {
    const frame = frameRef.current;
    if (!frame) return;
    frame.scrollTo({
      top: target === "footer" ? frame.scrollHeight : 0,
      behavior: "smooth",
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => jump("header")}
          >
            <ArrowUp className="h-4 w-4" />
            {t("wordpress.reAppointment.jumpHeader", "Header")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => jump("footer")}
          >
            <ArrowDown className="h-4 w-4" />
            {t("wordpress.reAppointment.jumpFooter", "Footer")}
          </Button>
        </div>

        <div className="mx-1 hidden min-w-0 flex-1 items-center rounded-md border bg-background px-3 py-1 text-xs text-muted-foreground sm:flex">
          <span className="truncate">{iframeOrigin}</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant={device === "desktop" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            aria-label={t("wordpress.reAppointment.deviceDesktop", "Desktop")}
            aria-pressed={device === "desktop"}
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant={device === "mobile" ? "secondary" : "ghost"}
            size="icon"
            className="h-8 w-8"
            aria-label={t("wordpress.reAppointment.deviceMobile", "Mobile")}
            aria-pressed={device === "mobile"}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={frameRef}
        className="relative h-[540px] overflow-auto bg-muted/20"
      >
        {!loaded ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t(
              "wordpress.reAppointment.pickerLoading",
              "Loading the live preview of your site…",
            )}
          </div>
        ) : null}
        <iframe
          ref={iframeRef}
          src={pickerUrl}
          title={t(
            "wordpress.reAppointment.pickerTitle",
            "Live placement picker",
          )}
          className={cn(
            "block border-0 bg-white transition-[width] duration-200",
            device === "mobile" ? "mx-auto shadow-sm" : "w-full",
          )}
          style={{
            height,
            width: device === "mobile" ? PICKER_MOBILE_WIDTH : undefined,
          }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          onError={() => onUnavailableRef.current("error")}
        />
      </div>

      <div className="border-t px-3 py-2 text-xs text-muted-foreground">
        {pickMode
          ? t(
              "wordpress.reAppointment.pickerPickHint",
              "Click any element in the preview to pin the button next to it.",
            )
          : t(
              "wordpress.reAppointment.pickerHint",
              "Click a highlighted spot in your header or footer to place the button there.",
            )}
      </div>
    </div>
  );
}
