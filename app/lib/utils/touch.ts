/**
 * Touch-first helpers (REDESIGN_PLAN.md §1: no surprise keyboard).
 *
 * On a phone, focusing a field raises the keyboard, which covers half the
 * sheet that just opened. So sheets, dialogs, popovers and searches open with
 * nothing focused on touch devices; the keyboard comes up when the owner taps
 * a field. Desktop keeps focusing the first field, as before.
 */

/** True on touch-first devices (no precise pointer). False during SSR. */
export function isCoarsePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches === true;
}

/**
 * For `autoFocus` on fields inside something that just opened: true on
 * desktop, false on phones. React doesn't render `autoFocus` as an attribute,
 * so this can't cause a hydration mismatch.
 *
 * Keep a plain `autoFocus` only where the tap itself asked to type
 * ("Type a note", "Rename", "Edit").
 */
export function desktopAutoFocus(): boolean {
  return !isCoarsePointer();
}

/**
 * Wraps a Radix `onOpenAutoFocus`. On touch devices it keeps focus on the
 * sheet itself (screen readers still land inside it) instead of the first
 * field. A caller's own handler runs first and can still decide.
 */
export function touchSafeOpenAutoFocus(handler?: (event: Event) => void) {
  return (event: Event) => {
    handler?.(event);
    if (event.defaultPrevented || !isCoarsePointer()) return;
    event.preventDefault();
    const el = event.currentTarget as HTMLElement | null;
    el?.focus?.({ preventScroll: true });
  };
}
