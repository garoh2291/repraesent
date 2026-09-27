import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useAuthContext } from "~/providers/auth-provider";
import { isBootDone } from "~/components/notebook/brand-splash";
import { cn } from "~/lib/utils";

/**
 * First time on this device: point once at search (the header button on
 * phones, the sidebar search on the web). One ink bubble and a soft marker
 * ring around the button. Tapping "Got it", the search itself or anywhere
 * else puts it away for good. No tour library: it's a single step.
 */

const storageKey = (userId: string) => `rp-search-hint:${userId}`;

function seen(userId: string): boolean {
  try {
    return window.localStorage.getItem(storageKey(userId)) === "1";
  } catch {
    return true; // Storage blocked: never nag.
  }
}

function markSeen(userId: string) {
  try {
    window.localStorage.setItem(storageKey(userId), "1");
  } catch {
    /* ignore */
  }
}

function findTarget(): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>("[data-search-hint]"));
  return (
    els.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
    }) ?? null
  );
}

const sheetOpen = () =>
  !!document.querySelector(
    '[role="dialog"][data-state="open"], [data-vaul-drawer][data-state="open"], [role="alertdialog"][data-state="open"]',
  );

type Place = { ring: DOMRect; top: number; left: number; arrowLeft: number; side: "below" | "right" };

const BUBBLE_W = 264;
const GAP = 12;
const EDGE = 12;

function place(target: HTMLElement): Place {
  const r = target.getBoundingClientRect();
  const vw = window.innerWidth;
  // Room on the right (desktop sidebar): sit beside it. Otherwise below.
  if (vw - r.right > BUBBLE_W + GAP + EDGE && r.left < vw / 2) {
    return { ring: r, side: "right", top: r.top + r.height / 2 - 28, left: r.right + GAP, arrowLeft: 0 };
  }
  const left = Math.min(Math.max(EDGE, r.right - BUBBLE_W), vw - BUBBLE_W - EDGE);
  return { ring: r, side: "below", top: r.bottom + GAP, left, arrowLeft: r.left + r.width / 2 - left };
}

export function SearchHint() {
  const { t } = useTranslation();
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<Place | null>(null);

  // Wait for the start screen to go and the first page to settle, then show
  // once, when no sheet or dialog is in the way.
  useEffect(() => {
    if (!userId || seen(userId)) return;
    let tries = 0;
    let timer = 0;
    const tick = () => {
      tries += 1;
      if (tries > 40) return; // ~40 s: the moment has passed, try next visit.
      if (isBootDone() && !sheetOpen()) {
        const el = findTarget();
        if (el) {
          setTarget(el);
          return;
        }
      }
      timer = window.setTimeout(tick, 1000);
    };
    timer = window.setTimeout(tick, 1200);
    return () => window.clearTimeout(timer);
  }, [userId]);

  const dismiss = useCallback(() => {
    if (userId) markSeen(userId);
    setTarget(null);
    setPos(null);
  }, [userId]);

  useLayoutEffect(() => {
    if (!target) return;
    const update = () => setPos(place(target));
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    // Tapping the search itself counts: it opens as usual, the hint goes.
    target.addEventListener("click", dismiss);
    // A tap anywhere else puts it away too.
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest("[data-search-hint-bubble]")) return;
      dismiss();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      target.removeEventListener("click", dismiss);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [target, dismiss]);

  if (!target || !pos || typeof document === "undefined") return null;
  const { ring } = pos;

  return createPortal(
    <>
      {/* The ring around the button: marker, two soft pulses. */}
      <span
        aria-hidden
        className="rp-hint-ring pointer-events-none fixed z-[70] rounded-xl"
        style={{ top: ring.top - 4, left: ring.left - 4, width: ring.width + 8, height: ring.height + 8 }}
      />
      <div
        data-search-hint-bubble=""
        role="status"
        aria-live="polite"
        className="rp-hint-bubble fixed z-[71] rounded-2xl border border-border bg-card p-4 text-foreground shadow-[0_18px_40px_-14px_rgba(20,21,22,0.28)]"
        style={{ top: pos.top, left: pos.left, width: BUBBLE_W }}
      >
        {/* The little point towards the button */}
        <span
          aria-hidden
          className={cn("absolute size-3 rotate-45 rounded-[2px] border-border bg-card", pos.side === "below" ? "border-l border-t" : "border-b border-l")}
          style={
            pos.side === "below"
              ? { top: -5, left: Math.min(Math.max(pos.arrowLeft - 6, 16), BUBBLE_W - 28) }
              : { left: -5, top: 22 }
          }
        />
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-marker-soft">
            <Search className="size-4 text-foreground" aria-hidden />
          </span>
          {t("searchHint.title", "Find anything here")}
        </p>
        <p className="mt-1.5 text-[13.5px] leading-snug text-muted-foreground">
          {t("searchHint.body", "People, deals, tasks and pages — tap to search.")}
        </p>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="press inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-[14px] font-semibold text-background"
          >
            {t("searchHint.ok", "Got it")}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
