import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { isMacPlatform } from "~/lib/utils/platform";

/**
 * Cmd/Ctrl+F focuses the page's search input (Linear-style).
 * Pressing it again while the search input is focused falls through
 * to the browser's native find.
 */

const registry: Array<RefObject<HTMLInputElement | null>> = [];

const NON_TEXT_INPUT_TYPES = new Set([
  "button",
  "checkbox",
  "radio",
  "range",
  "submit",
  "reset",
  "file",
  "color",
  "image",
]);

function isTextEntry(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  if (el.tagName === "TEXTAREA") return true;
  return (
    el.tagName === "INPUT" &&
    !NON_TEXT_INPUT_TYPES.has((el as HTMLInputElement).type)
  );
}

function isVisible(el: HTMLElement): boolean {
  return el.checkVisibility ? el.checkVisibility() : el.offsetParent !== null;
}

function handleKeyDown(e: KeyboardEvent) {
  // Mac: Cmd only (Ctrl+F in a text field is emacs cursor-forward there);
  // elsewhere: Ctrl only. Shift/Alt combos are other shortcuts — leave them.
  const mod = isMacPlatform()
    ? e.metaKey && !e.ctrlKey
    : e.ctrlKey && !e.metaKey;
  if (!mod || e.altKey || e.shiftKey) return;

  // Layout-aware key match: on Latin layouts trust e.key (Dvorak types "u"
  // on physical KeyF — must not match); on non-Latin layouts (Cyrillic etc.)
  // e.key isn't a Latin letter, so fall back to the physical e.code.
  const key = e.key?.toLowerCase() ?? "";
  const isLatinLetter = key.length === 1 && key >= "a" && key <= "z";
  if (!(isLatinLetter ? key === "f" : e.code === "KeyF")) return;

  // Holding the shortcut must not pop native find right after we focused.
  if (e.repeat) {
    e.preventDefault();
    return;
  }

  const active = document.activeElement as HTMLElement | null;

  // Already in a registered search input → second press → native find.
  if (active && registry.some((r) => r.current === active)) return;

  // Focus inside an open modal → the page search is behind the overlay.
  if (active?.closest('[role="dialog"],[role="alertdialog"]')) return;

  // Typing in any other text-entry control → don't steal focus.
  if (active && isTextEntry(active)) return;

  const candidates = registry
    .map((r) => r.current)
    .filter(
      (el): el is HTMLInputElement => !!el && !el.disabled && isVisible(el)
    );
  if (candidates.length === 0) return;

  // First in DOM order wins when several searches are on one page.
  const target = candidates.sort((a, b) =>
    a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
  )[0];

  e.preventDefault();
  target.focus();
  target.select();
}

export function useSearchShortcut(): {
  /** Attach to the page's search input. */
  ref: RefObject<HTMLInputElement | null>;
  /** "⌘F" on Mac, "Ctrl F" elsewhere; null during SSR and first render. */
  hint: string | null;
  /** Appends the shortcut hint to a placeholder once known. */
  withHint: (placeholder: string) => string;
} {
  const ref = useRef<HTMLInputElement | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    setHint(isMacPlatform() ? "⌘F" : "Ctrl F");

    registry.push(ref);
    if (registry.length === 1) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      const index = registry.indexOf(ref);
      if (index !== -1) registry.splice(index, 1);
      if (registry.length === 0) {
        window.removeEventListener("keydown", handleKeyDown);
      }
    };
  }, []);

  const withHint = useMemo(
    () => (placeholder: string) => hint ? `${placeholder} (${hint})` : placeholder,
    [hint]
  );

  return { ref, hint, withHint };
}
