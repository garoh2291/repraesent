import { useEffect } from "react";

/**
 * Publishes the on-screen keyboard's height as `--kb` on <html>
 * (REDESIGN_PLAN.md §4).
 *
 * iOS doesn't shrink the layout when the keyboard opens, so a sheet pinned to
 * the bottom ends up behind it together with its Save button. Phone sheets use
 * `bottom: var(--kb)` to ride on top of the keyboard instead. It's 0 when no
 * keyboard is up, and on desktop.
 */
export function useKeyboardInset() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv || !window.matchMedia("(pointer: coarse)").matches) return;
    const root = document.documentElement;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        // Small differences are browser chrome, not a keyboard.
        root.style.setProperty("--kb", inset > 80 ? `${inset}px` : "0px");
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb");
    };
  }, []);
}
