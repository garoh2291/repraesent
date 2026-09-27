import { useEffect, useState } from "react";

/** Below Tailwind's `sm` (640px): the phone layouts in MOBILE_PACKAGE_PLAN.md. */
export const PHONE_QUERY = "(max-width: 639px)";

/**
 * True on phone-width screens. SSR-safe: always `false` on the server and on
 * the first client render, then follows the media query — so desktop never
 * renders phone markup, and a phone switches right after hydration.
 *
 * Prefer `max-sm:` / `sm:` utilities for pure styling; use this only when the
 * markup itself differs (a card list instead of a table, a sheet instead of a
 * stepper).
 */
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return phone;
}

/** True on touch-first devices (no precise pointer), e.g. to drop keyboard hints. */
export function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return coarse;
}
