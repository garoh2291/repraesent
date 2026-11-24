import { useEffect, type RefObject } from "react";
import { desktopAutoFocus } from "~/lib/utils/touch";

/**
 * Focus a field once a sheet has opened. `autoFocus` alone loses when the
 * sheet opens from a dropdown item: the menu hands focus back to its trigger
 * and the dialog then focuses its first button (Close), so typing goes
 * nowhere and Enter closes the sheet. Desktop only — no surprise keyboard.
 */
export function useFocusOnOpen(ref: RefObject<HTMLInputElement | null>, openKey: string | null) {
  useEffect(() => {
    if (!openKey || !desktopAutoFocus()) return;
    const id = window.setTimeout(() => {
      ref.current?.focus();
      ref.current?.select();
    }, 60);
    return () => window.clearTimeout(id);
  }, [openKey, ref]);
}
