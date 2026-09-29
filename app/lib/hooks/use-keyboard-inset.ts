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
    let blurTimer = 0;
    // Not while pinch-zoomed: there the offset is the owner's, on purpose.
    const resetShell = () => {
      if (vv.scale > 1.01 || !root.matches(":has([data-app-shell])")) return;
      if (window.scrollY !== 0 || root.scrollTop !== 0) window.scrollTo(0, 0);
    };
    // The keyboard can close without a resize event reaching us in time
    // (installed app); check again once the field has lost focus.
    const onFocusOut = () => {
      window.clearTimeout(blurTimer);
      blurTimer = window.setTimeout(() => {
        const active = document.activeElement;
        if (active && active.matches("input, textarea, select, [contenteditable]")) return;
        resetShell();
      }, 350);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        // Small differences are browser chrome, not a keyboard.
        const open = inset > 80;
        root.style.setProperty("--kb", open ? `${inset}px` : "0px");
        // Installed app on iOS: focusing a field scrolls the locked document
        // up to reveal it, and when the keyboard closes it stays there. <main>
        // is then shifted and stops scrolling (Safari tabs recover by
        // themselves). The app shell never scrolls the document, so put it
        // back once the keyboard is gone.
        if (!open) resetShell();
      });
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusout", onFocusOut);
    return () => {
      window.clearTimeout(blurTimer);
      document.removeEventListener("focusout", onFocusOut);
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      root.style.removeProperty("--kb");
    };
  }, []);
}
