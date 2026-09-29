import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { isBootDone } from "~/components/notebook/brand-splash";
import { cn } from "~/lib/utils";

/**
 * One pointer at one thing on screen: a soft marker ring around it and a
 * light bubble with a line of help and a button or two. Used for the
 * first-time search hint and the "Paid already?" nudge on won deals.
 *
 * It waits for the start screen to go and for no sheet or dialog to be open,
 * then finds the first visible element matching `selector`. A tap on the
 * element itself, or anywhere outside the bubble, calls `onDismiss`.
 */

const BUBBLE_W = 264;
const GAP = 12;
const EDGE = 12;

type Place = { ring: DOMRect; top: number; left: number; arrowLeft: number; side: "below" | "right" };

function findTarget(selector: string): HTMLElement | null {
  const els = Array.from(document.querySelectorAll<HTMLElement>(selector));
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

export function CoachHint({
  selector,
  icon,
  title,
  body,
  actions,
  onDismiss,
  delayMs = 1200,
}: {
  selector: string;
  icon?: ReactNode;
  title: ReactNode;
  body: ReactNode;
  /** The bubble's buttons. */
  actions: ReactNode;
  /** Tapped outside, or tapped the pointed-at element itself. */
  onDismiss: () => void;
  delayMs?: number;
}) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [pos, setPos] = useState<Place | null>(null);
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;

  useEffect(() => {
    let tries = 0;
    let timer = 0;
    const tick = () => {
      tries += 1;
      if (tries > 40) return; // ~40 s: the moment has passed.
      if (isBootDone() && !sheetOpen()) {
        const el = findTarget(selector);
        if (el) {
          setTarget(el);
          return;
        }
      }
      timer = window.setTimeout(tick, 1000);
    };
    timer = window.setTimeout(tick, delayMs);
    return () => window.clearTimeout(timer);
  }, [selector, delayMs]);

  useLayoutEffect(() => {
    if (!target) return;
    const update = () => setPos(place(target));
    update();
    const dismiss = () => dismissRef.current();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    target.addEventListener("click", dismiss);
    const onDown = (e: PointerEvent) => {
      const el = e.target as Element | null;
      if (el?.closest("[data-coach-hint-bubble]")) return;
      dismiss();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      target.removeEventListener("click", dismiss);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [target]);

  if (!target || !pos || typeof document === "undefined") return null;
  const { ring } = pos;

  return createPortal(
    <>
      {/* The ring around the thing: marker, two soft pulses. */}
      <span
        aria-hidden
        className="rp-hint-ring pointer-events-none fixed z-[70] rounded-xl"
        style={{ top: ring.top - 4, left: ring.left - 4, width: ring.width + 8, height: ring.height + 8 }}
      />
      <div
        data-coach-hint-bubble=""
        role="status"
        aria-live="polite"
        className="rp-hint-bubble fixed z-[71] rounded-2xl border border-border bg-card p-4 text-foreground shadow-[0_18px_40px_-14px_rgba(20,21,22,0.28)]"
        style={{ top: pos.top, left: pos.left, width: BUBBLE_W }}
      >
        {/* The little point towards it */}
        <span
          aria-hidden
          className={cn(
            "absolute size-3 rotate-45 rounded-[2px] border-border bg-card",
            pos.side === "below" ? "border-l border-t" : "border-b border-l",
          )}
          style={
            pos.side === "below"
              ? { top: -5, left: Math.min(Math.max(pos.arrowLeft - 6, 16), BUBBLE_W - 28) }
              : { left: -5, top: 22 }
          }
        />
        <p className="flex items-center gap-2 text-[15px] font-semibold">
          {icon ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-marker-soft">{icon}</span>
          ) : null}
          {title}
        </p>
        <p className="mt-1.5 text-[13.5px] leading-snug text-muted-foreground">{body}</p>
        <div className="mt-3 flex justify-end gap-2">{actions}</div>
      </div>
    </>,
    document.body,
  );
}

/** The bubble's main button. */
export const hintPrimaryClass =
  "press inline-flex h-10 items-center rounded-lg bg-foreground px-4 text-[14px] font-semibold text-background disabled:opacity-60";
/** A quieter second button. */
export const hintSecondaryClass =
  "press inline-flex h-10 items-center rounded-lg px-3 text-[14px] font-medium text-muted-foreground hover:text-foreground";
